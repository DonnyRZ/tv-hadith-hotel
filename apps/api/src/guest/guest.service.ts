import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import { MENU_REPOSITORY } from '../menu/menu.repository';
import type { MenuRepository } from '../menu/menu.repository';
import type { MenuItemRecord } from '../menu/menu.types';
import { RequestClientIdConflictError, REQUEST_REPOSITORY } from '../requests/request.repository';
import type { RequestRepository } from '../requests/request.repository';
import type {
  CreateRequestRecordInput,
  RequestItemRecord,
  RequestRecord,
} from '../requests/request.types';
import { UNIT_CODES, type UnitCode } from '../rbac/rbac.types';
import type { CreateGuestRequestDto } from './dto/create-guest-request.dto';
import type { ListGuestMenusDto } from './dto/list-guest-menus.dto';
import type { ListGuestRequestsDto } from './dto/list-guest-requests.dto';
import type {
  GuestContextResponse,
  GuestDepartment,
  GuestDepartmentUnit,
  GuestRequestResponse,
  ResolvedGuestContext,
} from './guest.types';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

const GUEST_DEPARTMENT_UNITS: readonly GuestDepartmentUnit[] = [
  {
    code: 'CAFE',
    department: 'CAFE',
    name: 'Cafe 70z Espresso',
    roomManagerMonitoring: false,
    enabled: true,
    disabledReason: null,
  },
  {
    code: 'RESTAURANT',
    department: 'FOOD_AND_BEVERAGES',
    name: 'Saji Nusantara',
    roomManagerMonitoring: true,
    enabled: true,
    disabledReason: null,
  },
  {
    code: 'LOUNGE',
    department: 'FOOD_AND_BEVERAGES',
    name: 'Lounge',
    roomManagerMonitoring: true,
    enabled: false,
    disabledReason: 'MENU_NOT_CONFIGURED',
  },
  {
    code: 'SPA',
    department: 'SPA',
    name: 'SPA',
    roomManagerMonitoring: true,
    enabled: true,
    disabledReason: null,
  },
  {
    code: 'HOUSEKEEPING',
    department: 'HOUSEKEEPING',
    name: 'Housekeeping',
    roomManagerMonitoring: true,
    enabled: true,
    disabledReason: null,
  },
  {
    code: 'BEAUTY_AND_SALON',
    department: 'BEAUTY_AND_SALON',
    name: 'Beauty & Salon',
    roomManagerMonitoring: false,
    enabled: true,
    disabledReason: null,
  },
];

const GUEST_DEPARTMENTS: readonly GuestDepartment[] = [
  {
    code: 'CAFE',
    name: 'Cafe 70z Espresso',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'CAFE'),
  },
  {
    code: 'FOOD_AND_BEVERAGES',
    name: 'Food & Beverages',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'FOOD_AND_BEVERAGES'),
  },
  {
    code: 'SPA',
    name: 'SPA',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'SPA'),
  },
  {
    code: 'HOUSEKEEPING',
    name: 'Housekeeping',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'HOUSEKEEPING'),
  },
  {
    code: 'BEAUTY_AND_SALON',
    name: 'Beauty & Salon',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'BEAUTY_AND_SALON'),
  },
];

@Injectable()
export class GuestService {
  public constructor(
    @Inject(MENU_REPOSITORY) private readonly menuRepository: MenuRepository,
    @Inject(REQUEST_REPOSITORY) private readonly requestRepository: RequestRepository,
  ) {}

  public getContext(context: ResolvedGuestContext): GuestContextResponse {
    return {
      room: { ...context.room },
      roomStatus: 'OCCUPIED',
      welcome: {
        message: `Welcome, ${context.assignment.guestName}`,
        guestName: context.assignment.guestName,
        personalized: true,
      },
      availableUnits: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.enabled).map(
        (unit) => unit.code,
      ),
    };
  }

  public listDepartments(): { items: GuestDepartment[] } {
    return {
      items: GUEST_DEPARTMENTS.map((department) => ({
        ...department,
        units: department.units.map((unit) => ({ ...unit })),
      })),
    };
  }

  public async listMenus(_context: ResolvedGuestContext, query: ListGuestMenusDto) {
    this.assertGuestUnitEnabled(query.unit);
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.menuRepository.listItems({
      units: [query.unit],
      includeInactive: false,
      availableOnly: true,
      page,
      pageSize,
    });
    return { items: result.items, page, pageSize, total: result.total };
  }

  public async getMenuItem(
    _context: ResolvedGuestContext,
    menuItemId: string,
  ): Promise<MenuItemRecord> {
    const item = await this.menuRepository.findItemById(menuItemId);
    if (item === null || !item.active || !item.available) throw this.menuItemNotFound();
    this.assertGuestUnitEnabled(item.unit);
    return item;
  }

  public async listRequests(context: ResolvedGuestContext, query: ListGuestRequestsDto) {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const result = await this.requestRepository.list({
      units: UNIT_CODES,
      guestAssignmentId: context.assignment.id,
      ...(query.status === undefined ? {} : { status: query.status }),
      page,
      pageSize,
    });
    return {
      items: result.items.map((request) => this.toGuestRequest(request)),
      page,
      pageSize,
      total: result.total,
    };
  }

  public async createRequest(
    context: ResolvedGuestContext,
    input: CreateGuestRequestDto,
  ): Promise<GuestRequestResponse> {
    const menuItems = await Promise.all(
      input.items.map((item) => this.menuRepository.findItemById(item.menuItemId)),
    );
    if (menuItems.some((item) => item === null)) throw this.menuItemNotFound();

    const resolvedItems = menuItems as MenuItemRecord[];
    const unit = resolvedItems[0]?.unit;
    if (unit === undefined) throw this.validationError('items', 'At least one item is required.');
    this.assertGuestUnitEnabled(unit);
    for (const [index, item] of resolvedItems.entries()) {
      if (item.unit !== unit) throw this.crossUnitConflict(index);
      if (!item.active || !item.available) throw this.menuUnavailable(index);
      if (item.kind === 'SERVICE' && input.items[index]?.quantity !== 1) {
        throw new ApiException(HttpStatus.BAD_REQUEST, {
          code: 'SERVICE_QUANTITY_INVALID',
          message: 'Service items must always have quantity 1.',
          details: [{ field: `items[${index}].quantity`, message: 'Quantity must equal 1.' }],
        });
      }
      if (item.kind === 'PRODUCT' && !item.quantityAllowed && input.items[index]?.quantity !== 1) {
        throw new ApiException(HttpStatus.BAD_REQUEST, {
          code: 'PRODUCT_QUANTITY_INVALID',
          message: 'This product can only be requested with quantity 1.',
          details: [{ field: `items[${index}].quantity`, message: 'Quantity must equal 1.' }],
        });
      }
    }

    const requestInput: CreateRequestRecordInput = {
      clientRequestId: input.clientRequestId,
      guestAssignmentId: context.assignment.id,
      department: this.departmentForUnit(unit),
      unit,
      room: { ...context.room },
      items: resolvedItems.map((item, index) => this.toRequestItem(item, input.items[index])),
      guestNote: this.normalizeNote(input.guestNote),
    };

    try {
      return this.toGuestRequest(await this.requestRepository.create(requestInput));
    } catch (error) {
      if (error instanceof RequestClientIdConflictError) {
        const existing = await this.requestRepository.findByClientRequestId(
          input.clientRequestId,
          context.assignment.id,
        );
        if (existing !== null) return this.toGuestRequest(existing);
        throw new ApiException(HttpStatus.CONFLICT, {
          code: 'REQUEST_CLIENT_ID_CONFLICT',
          message: 'This client request ID has already been used.',
        });
      }
      throw error;
    }
  }

  public async getRequest(
    context: ResolvedGuestContext,
    requestId: string,
  ): Promise<GuestRequestResponse> {
    const request = await this.requestRepository.findById(requestId);
    if (request === null || request.guestAssignmentId !== context.assignment.id) {
      throw this.requestNotFound();
    }
    return this.toGuestRequest(request);
  }

  private toRequestItem(
    item: MenuItemRecord,
    input: CreateGuestRequestDto['items'][number] | undefined,
  ): RequestItemRecord {
    const quantity = item.kind === 'SERVICE' || !item.quantityAllowed ? 1 : (input?.quantity ?? 1);
    return {
      menuItemId: item.id,
      unit: item.unit,
      kind: item.kind,
      name: item.name,
      localizedName: { ...item.localizedName },
      quantity,
      note: this.normalizeNote(input?.note),
      unitPrice: item.price,
      currency: item.currency,
    };
  }

  private toGuestRequest(request: RequestRecord): GuestRequestResponse {
    const { room: _room, guestAssignmentId: _guestAssignmentId, ...guestRequest } = request;
    void _room;
    void _guestAssignmentId;
    return {
      ...guestRequest,
      items: guestRequest.items.map((item) => ({
        ...item,
        localizedName: { ...item.localizedName },
      })),
    };
  }

  private assertGuestUnitEnabled(unit: UnitCode): void {
    const definition = GUEST_DEPARTMENT_UNITS.find((candidate) => candidate.code === unit);
    if (definition === undefined || !definition.enabled) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'MENU_NOT_CONFIGURED',
        message: 'This guest menu is not configured yet.',
      });
    }
  }

  private departmentForUnit(unit: UnitCode) {
    const definition = GUEST_DEPARTMENT_UNITS.find((candidate) => candidate.code === unit);
    if (definition === undefined) throw this.menuItemNotFound();
    return definition.department;
  }

  private normalizeNote(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized === undefined || normalized.length === 0 ? null : normalized;
  }

  private validationError(field: string, message: string): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, {
      code: 'VALIDATION_ERROR',
      message,
      details: [{ field, message }],
    });
  }

  private crossUnitConflict(index: number): ApiException {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'GUEST_REQUEST_UNIT_CONFLICT',
      message: 'All items in one guest request must belong to the same unit.',
      details: [{ field: `items[${index}].menuItemId`, message: 'Item belongs to another unit.' }],
    });
  }

  private menuUnavailable(index: number): ApiException {
    return new ApiException(HttpStatus.CONFLICT, {
      code: 'MENU_ITEM_UNAVAILABLE',
      message: 'One or more selected menu items are no longer available.',
      details: [{ field: `items[${index}].menuItemId`, message: 'Menu item is unavailable.' }],
    });
  }

  private menuItemNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'MENU_ITEM_NOT_FOUND',
      message: 'The requested menu item does not exist.',
    });
  }

  private requestNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'REQUEST_NOT_FOUND',
      message: 'The requested guest request does not exist in the current stay.',
    });
  }
}
