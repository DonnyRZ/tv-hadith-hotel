import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import type { PublicStaffUser } from '../auth/auth.types';
import { BoutiqueService } from '../boutique/boutique.service';
import type { StockReservationLine } from '../boutique/boutique.types';
import { getAccessibleUnits, isRoleCode, type UnitCode } from '../rbac/rbac.types';
import { StaffRealtimePublisher } from '../realtime/staff-realtime.publisher';
import type { ListDepartmentRequestsDto } from './dto/list-department-requests.dto';
import type { ListRoomManagerRequestsDto } from './dto/list-room-manager-requests.dto';
import { REQUEST_REPOSITORY } from './request.repository';
import type { RequestRepository } from './request.repository';
import {
  ROOM_MANAGER_UNIT_CODES,
  type RequestActor,
  type RequestRecord,
  type RequestStatus,
  type RoomManagerUnitCode,
} from './request.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

@Injectable()
export class RequestService {
  public constructor(
    @Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository,
    private readonly boutiqueService: BoutiqueService,
    @Optional() private readonly realtimePublisher?: StaffRealtimePublisher,
  ) {}

  public async listDepartmentRequests(staff: PublicStaffUser, query: ListDepartmentRequestsDto) {
    const units = this.resolveUnits(staff, query.unit);
    return this.listRequests(staff, units, query);
  }

  public async listRoomManagerRequests(staff: PublicStaffUser, query: ListRoomManagerRequestsDto) {
    const units = this.resolveRoomManagerUnits(staff, query.unit);
    return this.listRequests(staff, units, query);
  }

  private async listRequests(
    staff: PublicStaffUser,
    units: readonly UnitCode[],
    query: RequestListQuery,
  ) {
    this.assertHistoryAccess(staff, query.status);
    this.assertDateRange(query.dateFrom, query.dateTo);
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.repository.list({
      units,
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.room?.trim() === undefined || query.room.trim().length === 0
        ? {}
        : { room: query.room.trim() }),
      ...(query.dateFrom === undefined ? {} : { dateFrom: query.dateFrom.slice(0, 10) }),
      ...(query.dateTo === undefined ? {} : { dateTo: query.dateTo.slice(0, 10) }),
      page,
      pageSize,
    });

    return {
      items: result.items,
      page,
      pageSize,
      total: result.total,
    };
  }

  public async getRoomManagerRequest(
    staff: PublicStaffUser,
    requestId: string,
  ): Promise<RequestRecord> {
    const units = this.resolveRoomManagerUnits(staff);
    const request = await this.repository.findById(requestId);
    if (request === null || !isRoomManagerUnit(request.unit) || !units.includes(request.unit)) {
      throw this.requestNotFound();
    }
    return request;
  }

  public async getDepartmentRequest(
    staff: PublicStaffUser,
    requestId: string,
  ): Promise<RequestRecord> {
    const request = await this.requireRequestInScope(staff, requestId);
    this.assertHistoryAccess(staff, request.status);
    return request;
  }

  public async confirmDepartmentRequest(
    staff: PublicStaffUser,
    requestId: string,
  ): Promise<RequestRecord> {
    return this.transition(staff, requestId, 'NEW', 'IN_PROCESS');
  }

  public async completeDepartmentRequest(
    staff: PublicStaffUser,
    requestId: string,
  ): Promise<RequestRecord> {
    return this.transition(staff, requestId, 'IN_PROCESS', 'COMPLETED');
  }

  public async cancelDepartmentRequest(
    staff: PublicStaffUser,
    requestId: string,
    reason?: string | null,
  ): Promise<RequestRecord> {
    const request = await this.requireRequestInScope(staff, requestId);
    if (request.status === 'COMPLETED' || request.status === 'CANCELLED') {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'REQUEST_STATUS_CONFLICT',
        message: 'The request is already in a terminal state.',
      });
    }
    return this.cancelRequestRecord(
      request,
      this.toActor(staff),
      reason?.trim() || 'Cancelled by the Butik Indonesia team.',
      'STAFF',
    );
  }

  public async expireBoutiqueReservations(): Promise<number> {
    const expired = await this.repository.listExpiredReservations(new Date().toISOString());
    let expiredCount = 0;
    for (const request of expired) {
      try {
        await this.cancelRequestRecord(
          request,
          { id: 'system', displayName: 'Reservation expiry', role: null },
          'Reservation expired after 30 minutes.',
          'AUTO_EXPIRY',
        );
        expiredCount += 1;
      } catch (error) {
        if (!(error instanceof ApiException) || error.getStatus() !== HttpStatus.CONFLICT)
          throw error;
      }
    }
    return expiredCount;
  }

  private async transition(
    staff: PublicStaffUser,
    requestId: string,
    expectedStatus: RequestStatus,
    nextStatus: RequestStatus,
  ): Promise<RequestRecord> {
    const request = await this.requireRequestInScope(staff, requestId);
    const changedBy = this.toActor(staff);
    const stockLines = this.stockLines(request);
    if (nextStatus === 'COMPLETED') {
      // Claim the terminal state before touching inventory. This prevents a
      // concurrent cancellation from winning after fulfillment has already
      // reduced stock. If fulfillment fails, the claim is reverted and the
      // reservation remains available for a retry.
      const claimed = await this.repository.transition(
        request.id,
        expectedStatus,
        nextStatus,
        changedBy,
      );
      if (claimed === null) {
        throw new ApiException(HttpStatus.CONFLICT, {
          code: 'REQUEST_STATUS_CONFLICT',
          message: `The request cannot be changed from ${expectedStatus}.`,
        });
      }
      try {
        if (stockLines.length > 0) {
          await this.boutiqueService.fulfillStock(stockLines, request.clientRequestId);
        }
        this.realtimePublisher?.publishRequestUpdated(claimed);
        return claimed;
      } catch (error) {
        await this.repository.revertCompletion(request.id, changedBy);
        throw error;
      }
    }

    const updated = await this.repository.transition(
      request.id,
      expectedStatus,
      nextStatus,
      changedBy,
    );

    if (updated === null) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'REQUEST_STATUS_CONFLICT',
        message: `The request cannot be changed from ${expectedStatus}.`,
      });
    }

    this.realtimePublisher?.publishRequestUpdated(updated);
    return updated;
  }

  private async cancelRequestRecord(
    request: RequestRecord,
    changedBy: RequestActor,
    reason: string,
    source: 'STAFF' | 'AUTO_EXPIRY',
  ): Promise<RequestRecord> {
    const stockLines = this.stockLines(request);
    const updated = await this.repository.transition(
      request.id,
      request.status,
      'CANCELLED',
      changedBy,
      { cancellationReason: reason, cancellationSource: source },
    );
    if (updated === null) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'REQUEST_STATUS_CONFLICT',
        message: 'The request changed before it could be cancelled.',
      });
    }

    // The conditional status transition is the cancellation claim. Only the
    // caller that won it may release stock; concurrent confirm/expiry attempts
    // cannot release the same reservation after the request has moved on.
    if (stockLines.length > 0) {
      await this.boutiqueService.releaseStock(stockLines, request.clientRequestId);
    }
    this.realtimePublisher?.publishRequestUpdated(updated);
    return updated;
  }

  private stockLines(request: RequestRecord): StockReservationLine[] {
    if (request.unit !== 'BUTIK_INDONESIA') return [];
    const quantities = new Map<string, number>();
    for (const item of request.items) {
      if (item.variantId === undefined || item.variantId === null) continue;
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    }
    return [...quantities.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private async requireRequestInScope(
    staff: PublicStaffUser,
    requestId: string,
  ): Promise<RequestRecord> {
    const request = await this.repository.findById(requestId);
    if (request === null) throw this.requestNotFound();

    const accessibleUnits = this.resolveUnits(staff);
    if (!accessibleUnits.includes(request.unit)) throw this.requestNotFound();
    return request;
  }

  private resolveRoomManagerUnits(
    staff: PublicStaffUser,
    requestedUnit?: RoomManagerUnitCode,
  ): RoomManagerUnitCode[] {
    if (!staff.permissions.includes('room-manager:monitor')) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'ROOM_MANAGER_PERMISSION_REQUIRED',
        message: 'The staff account does not have Room Manager monitoring access.',
      });
    }

    const roles = staff.roles.filter(isRoleCode);
    const accessibleUnits = getAccessibleUnits(roles).filter(isRoomManagerUnit);
    if (accessibleUnits.length === 0) throw this.unitForbidden();
    if (requestedUnit !== undefined && !accessibleUnits.includes(requestedUnit)) {
      throw this.unitForbidden();
    }
    return requestedUnit === undefined ? accessibleUnits : [requestedUnit];
  }

  private resolveUnits(staff: PublicStaffUser, requestedUnit?: UnitCode): UnitCode[] {
    if (!staff.permissions.includes('request:view')) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'REQUEST_PERMISSION_REQUIRED',
        message: 'The staff account does not have request access.',
      });
    }

    const roles = staff.roles.filter(isRoleCode);
    const accessibleUnits = getAccessibleUnits(roles);
    if (accessibleUnits.length === 0) throw this.unitForbidden();
    if (requestedUnit !== undefined && !accessibleUnits.includes(requestedUnit)) {
      throw this.unitForbidden();
    }
    return requestedUnit === undefined ? accessibleUnits : [requestedUnit];
  }

  private assertHistoryAccess(staff: PublicStaffUser, status?: RequestStatus): void {
    if (status === 'COMPLETED' && !staff.permissions.includes('request:history')) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'REQUEST_HISTORY_FORBIDDEN',
        message: 'The staff account cannot view completed request history.',
      });
    }
  }

  private assertDateRange(dateFrom?: string, dateTo?: string): void {
    if (
      dateFrom !== undefined &&
      dateTo !== undefined &&
      dateFrom.slice(0, 10) > dateTo.slice(0, 10)
    ) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'REQUEST_DATE_RANGE_INVALID',
        message: 'The request date range is invalid.',
      });
    }
  }

  private toActor(staff: PublicStaffUser): RequestActor {
    const role = staff.roles.find(
      (candidate) => isRoleCode(candidate) && candidate !== 'SUPERADMIN',
    );
    return {
      id: staff.id,
      displayName: staff.displayName,
      role: role === undefined ? null : (role as RequestActor['role']),
    };
  }

  private unitForbidden(): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, {
      code: 'REQUEST_UNIT_FORBIDDEN',
      message: 'The staff account cannot access this hotel unit.',
    });
  }

  private requestNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'REQUEST_NOT_FOUND',
      message: 'The requested service request does not exist.',
    });
  }
}

interface RequestListQuery {
  page?: number;
  pageSize?: number;
  status?: RequestStatus;
  room?: string;
  dateFrom?: string;
  dateTo?: string;
}

function isRoomManagerUnit(value: UnitCode): value is RoomManagerUnitCode {
  return (ROOM_MANAGER_UNIT_CODES as readonly string[]).includes(value);
}
