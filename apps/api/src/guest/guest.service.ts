import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import { BoutiqueService } from '../boutique/boutique.service';
import type {
  BoutiqueGuestProduct,
  BoutiqueVariantRecord,
  StockReservationLine,
} from '../boutique/boutique.types';
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
import { StaffRealtimePublisher } from '../realtime/staff-realtime.publisher';
import type {
  CreateGuestRequestDto,
  CreateGuestRequestGroupDto,
} from './dto/create-guest-request.dto';
import type { ListGuestMenusDto } from './dto/list-guest-menus.dto';
import type { ListGuestRequestsDto } from './dto/list-guest-requests.dto';
import type {
  GuestContextResponse,
  GuestDepartment,
  GuestDepartmentUnit,
  GuestRequestGroupResponse,
  GuestRequestResponse,
  ResolvedGuestContext,
} from './guest.types';
import { toGuestStay } from './guest-stay';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;

type GuestRequestCreationInput = Pick<
  CreateGuestRequestDto | CreateGuestRequestGroupDto,
  'clientRequestId' | 'items' | 'guestNote'
>;

interface ResolvedGuestItem {
  item: MenuItemRecord;
  input: CreateGuestRequestDto['items'][number];
  variant: BoutiqueVariantRecord | undefined;
}

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
  {
    code: 'BUTIK_INDONESIA',
    department: 'BUTIK_INDONESIA',
    name: 'Butik Indonesia',
    roomManagerMonitoring: false,
    enabled: false,
    disabledReason: 'MENU_NOT_CONFIGURED',
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
  {
    code: 'BUTIK_INDONESIA',
    name: 'Butik Indonesia',
    units: GUEST_DEPARTMENT_UNITS.filter((unit) => unit.department === 'BUTIK_INDONESIA'),
  },
];

@Injectable()
export class GuestService {
  public constructor(
    @Inject(MENU_REPOSITORY) private readonly menuRepository: MenuRepository,
    @Inject(REQUEST_REPOSITORY) private readonly requestRepository: RequestRepository,
    private readonly boutiqueService: BoutiqueService,
    @Optional() private readonly realtimePublisher?: StaffRealtimePublisher,
  ) {}

  public async getContext(context: ResolvedGuestContext): Promise<GuestContextResponse> {
    const visibleUnits = await this.visibleUnits();
    return {
      room: { ...context.room },
      roomStatus: 'OCCUPIED',
      welcome: {
        message: `Welcome, ${context.assignment.guestName}`,
        guestName: context.assignment.guestName,
        personalized: true,
      },
      stay: toGuestStay(context.assignment),
      availableUnits: visibleUnits.filter((unit) => unit.enabled).map((unit) => unit.code),
    };
  }

  public async listDepartments(): Promise<{ items: GuestDepartment[] }> {
    const visibleUnits = await this.visibleUnits();
    const unitsByCode = new Map(visibleUnits.map((unit) => [unit.code, unit]));
    return {
      items: GUEST_DEPARTMENTS.map((department) => ({
        ...department,
        units: department.units.map((unit) => ({ ...(unitsByCode.get(unit.code) ?? unit) })),
      })),
    };
  }

  public async listMenus(_context: ResolvedGuestContext, query: ListGuestMenusDto) {
    await this.assertGuestUnitEnabled(query.unit);
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    if (query.unit === 'BUTIK_INDONESIA') {
      return this.boutiqueService.listGuestProducts({
        page,
        pageSize,
        ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      });
    }
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
  ): Promise<MenuItemRecord | BoutiqueGuestProduct> {
    const item = await this.menuRepository.findItemById(menuItemId);
    if (item === null || !item.active || !item.available) throw this.menuItemNotFound();
    await this.assertGuestUnitEnabled(item.unit);
    if (item.unit === 'BUTIK_INDONESIA') return this.boutiqueService.getGuestProduct(menuItemId);
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
    const existingRequest = await this.requestRepository.findByClientRequestId(
      input.clientRequestId,
      context.assignment.id,
    );
    if (existingRequest !== null) return this.toGuestRequest(existingRequest);
    try {
      const resolvedItems = await this.resolveGuestItems(input);
      const units = new Set(resolvedItems.map(({ item }) => item.unit));
      if (units.size !== 1) {
        const firstUnit = resolvedItems[0]?.item.unit;
        const index = resolvedItems.findIndex(({ item }) => item.unit !== firstUnit);
        throw this.crossUnitConflict(index < 0 ? 1 : index);
      }
      const { requestInputs, reservationLines } = this.toRequestInputs(
        context,
        input,
        resolvedItems,
      );
      const [created] = await this.persistRequestBatch(
        requestInputs,
        reservationLines,
        input.clientRequestId,
      );
      if (created === undefined) throw new Error('The guest request could not be created.');
      this.realtimePublisher?.publishRequestCreated(created);
      return this.toGuestRequest(created);
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

  public async createRequestGroup(
    context: ResolvedGuestContext,
    input: CreateGuestRequestGroupDto,
  ): Promise<GuestRequestGroupResponse> {
    const existing = await this.requestRepository.listByClientRequestId(
      input.clientRequestId,
      context.assignment.id,
    );
    if (existing.length > 0) return this.toGuestRequestGroup(input.clientRequestId, existing);

    try {
      const resolvedItems = await this.resolveGuestItems(input);
      const { requestInputs, reservationLines } = this.toRequestInputs(
        context,
        input,
        resolvedItems,
      );
      const created = await this.persistRequestBatch(
        requestInputs,
        reservationLines,
        input.clientRequestId,
      );
      for (const request of created) this.realtimePublisher?.publishRequestCreated(request);
      return this.toGuestRequestGroup(input.clientRequestId, created);
    } catch (error) {
      if (error instanceof RequestClientIdConflictError) {
        const existing = await this.requestRepository.listByClientRequestId(
          input.clientRequestId,
          context.assignment.id,
        );
        if (existing.length > 0) return this.toGuestRequestGroup(input.clientRequestId, existing);
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

  private async resolveGuestItems(input: GuestRequestCreationInput): Promise<ResolvedGuestItem[]> {
    if (input.items.length === 0) {
      throw this.validationError('items', 'At least one item is required.');
    }
    const menuItems = await Promise.all(
      input.items.map((item) => this.menuRepository.findItemById(item.menuItemId)),
    );
    if (menuItems.some((item) => item === null)) throw this.menuItemNotFound();

    const resolvedItems = menuItems as MenuItemRecord[];
    const units = [...new Set(resolvedItems.map((item) => item.unit))];
    await Promise.all(units.map((unit) => this.assertGuestUnitEnabled(unit)));

    const boutiqueVariants: Array<BoutiqueVariantRecord | undefined> = [];
    const result: ResolvedGuestItem[] = [];
    for (const [index, item] of resolvedItems.entries()) {
      const itemInput = input.items[index];
      if (itemInput === undefined)
        throw this.validationError('items', 'At least one item is required.');
      if (!item.active || !item.available) throw this.menuUnavailable(index);
      if (item.unit === 'BUTIK_INDONESIA') {
        const variantId = itemInput.variantId;
        if (variantId === undefined || variantId === null) {
          throw this.validationError(
            `items[${index}].variantId`,
            'A Butik Indonesia product variant is required.',
          );
        }
        const variant = await this.boutiqueService.getVariantForProduct(item.id, variantId);
        if (!variant.active || variant.availableQuantity < itemInput.quantity) {
          throw new ApiException(HttpStatus.CONFLICT, {
            code: 'BOUTIQUE_STOCK_UNAVAILABLE',
            message: 'One or more Butik Indonesia variants do not have enough stock.',
            details: [{ field: `items[${index}].variantId`, message: 'Variant is out of stock.' }],
          });
        }
        boutiqueVariants[index] = variant;
      }
      if (item.kind === 'SERVICE' && itemInput.quantity !== 1) {
        throw new ApiException(HttpStatus.BAD_REQUEST, {
          code: 'SERVICE_QUANTITY_INVALID',
          message: 'Service items must always have quantity 1.',
          details: [{ field: `items[${index}].quantity`, message: 'Quantity must equal 1.' }],
        });
      }
      if (item.kind === 'PRODUCT' && !item.quantityAllowed && itemInput.quantity !== 1) {
        throw new ApiException(HttpStatus.BAD_REQUEST, {
          code: 'PRODUCT_QUANTITY_INVALID',
          message: 'This product can only be requested with quantity 1.',
          details: [{ field: `items[${index}].quantity`, message: 'Quantity must equal 1.' }],
        });
      }
      result.push({ item, input: itemInput, variant: boutiqueVariants[index] });
    }
    return result;
  }

  private toRequestInputs(
    context: ResolvedGuestContext,
    input: GuestRequestCreationInput,
    resolvedItems: readonly ResolvedGuestItem[],
  ): { requestInputs: CreateRequestRecordInput[]; reservationLines: StockReservationLine[] } {
    const grouped = new Map<UnitCode, ResolvedGuestItem[]>();
    for (const resolved of resolvedItems) {
      const entries = grouped.get(resolved.item.unit) ?? [];
      entries.push(resolved);
      grouped.set(resolved.item.unit, entries);
    }
    const requestedAt = new Date().toISOString();
    const requestInputs = [...grouped.entries()].map(([unit, entries]) => ({
      clientRequestId: input.clientRequestId,
      guestAssignmentId: context.assignment.id,
      guestName: context.assignment.guestName,
      department: this.departmentForUnit(unit),
      unit,
      room: { ...context.room },
      items: entries.map(({ item, input: itemInput, variant }) =>
        this.toRequestItem(item, itemInput, variant),
      ),
      guestNote: this.normalizeNote(input.guestNote),
      requestedAt,
      ...(unit === 'BUTIK_INDONESIA'
        ? { reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() }
        : {}),
    }));
    const reservationLines = this.toReservationLines(
      requestInputs.flatMap((request) => request.items),
    );
    return { requestInputs, reservationLines };
  }

  private async persistRequestBatch(
    requestInputs: readonly CreateRequestRecordInput[],
    reservationLines: readonly StockReservationLine[],
    clientRequestId: string,
  ): Promise<RequestRecord[]> {
    let reserved = false;
    try {
      if (reservationLines.length > 0) {
        reserved = await this.boutiqueService.reserveStock(reservationLines, clientRequestId);
      }
      return await this.requestRepository.createBatch(requestInputs);
    } catch (error) {
      if (reserved) await this.boutiqueService.releaseStock(reservationLines, clientRequestId);
      throw error;
    }
  }

  private toRequestItem(
    item: MenuItemRecord,
    input: CreateGuestRequestDto['items'][number] | undefined,
    variant?: BoutiqueVariantRecord,
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
      unitPrice: variant?.price ?? item.price,
      currency: variant?.currency ?? item.currency,
      ...(variant === undefined
        ? {}
        : {
            variantId: variant.id,
            sku: variant.sku,
            variantOptions: variant.options.map((option) => ({
              code: option.code,
              label: { ...option.label },
              value: { ...option.value },
            })),
          }),
    };
  }

  private toReservationLines(items: RequestItemRecord[]) {
    const quantities = new Map<string, number>();
    for (const item of items) {
      if (item.variantId === undefined || item.variantId === null) continue;
      quantities.set(item.variantId, (quantities.get(item.variantId) ?? 0) + item.quantity);
    }
    return [...quantities.entries()].map(([variantId, quantity]) => ({ variantId, quantity }));
  }

  private toGuestRequest(request: RequestRecord): GuestRequestResponse {
    const {
      room: _room,
      guestAssignmentId: _guestAssignmentId,
      guestName: _guestName,
      ...guestRequest
    } = request;
    void _room;
    void _guestAssignmentId;
    void _guestName;
    return {
      ...guestRequest,
      items: guestRequest.items.map((item) => ({
        ...item,
        localizedName: { ...item.localizedName },
      })),
    };
  }

  private toGuestRequestGroup(
    clientRequestId: string,
    requests: readonly RequestRecord[],
  ): GuestRequestGroupResponse {
    return {
      clientRequestId,
      requests: requests.map((request) => this.toGuestRequest(request)),
    };
  }

  private async assertGuestUnitEnabled(unit: UnitCode): Promise<void> {
    const definition = GUEST_DEPARTMENT_UNITS.find((candidate) => candidate.code === unit);
    const enabled =
      definition !== undefined &&
      (unit === 'BUTIK_INDONESIA'
        ? await this.boutiqueService.hasPublishedProducts()
        : definition.enabled);
    if (definition === undefined || !enabled) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'MENU_NOT_CONFIGURED',
        message: 'This guest menu is not configured yet.',
      });
    }
  }

  private async visibleUnits(): Promise<GuestDepartmentUnit[]> {
    const boutiqueEnabled = await this.boutiqueService.hasPublishedProducts();
    return GUEST_DEPARTMENT_UNITS.map((unit) =>
      unit.code === 'BUTIK_INDONESIA'
        ? {
            ...unit,
            enabled: boutiqueEnabled,
            disabledReason: boutiqueEnabled ? null : 'MENU_NOT_CONFIGURED',
          }
        : { ...unit },
    );
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
