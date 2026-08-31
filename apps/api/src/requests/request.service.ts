import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import type { PublicStaffUser } from '../auth/auth.types';
import { getAccessibleUnits, isRoleCode, type UnitCode } from '../rbac/rbac.types';
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
  public constructor(@Inject(REQUEST_REPOSITORY) private readonly repository: RequestRepository) {}

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

  private async transition(
    staff: PublicStaffUser,
    requestId: string,
    expectedStatus: RequestStatus,
    nextStatus: RequestStatus,
  ): Promise<RequestRecord> {
    const request = await this.requireRequestInScope(staff, requestId);
    const changedBy = this.toActor(staff);
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

    return updated;
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
