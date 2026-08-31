import { HttpStatus, Inject, Injectable } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import type { PublicStaffUser } from '../auth/auth.types';
import { getAccessibleUnits, isRoleCode, type UnitCode } from '../rbac/rbac.types';
import type { CreateMenuItemDto } from './dto/create-menu-item.dto';
import type { ListMenuItemsDto } from './dto/list-menu-items.dto';
import type { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { MenuItemNameConflictError, MENU_REPOSITORY } from './menu.repository';
import type { MenuRepository } from './menu.repository';
import type {
  CreateMenuItemRecordInput,
  LocalizedText,
  MenuItemRecord,
  MenuItemResponse,
  UpdateMenuItemRecordInput,
} from './menu.types';

const MENU_KIND_BY_UNIT: Readonly<Record<UnitCode, 'PRODUCT' | 'SERVICE'>> = {
  SPA: 'SERVICE',
  RESTAURANT: 'PRODUCT',
  LOUNGE: 'PRODUCT',
  HOUSEKEEPING: 'SERVICE',
  BEAUTY_AND_SALON: 'SERVICE',
  CAFE: 'PRODUCT',
};

@Injectable()
export class MenuService {
  public constructor(@Inject(MENU_REPOSITORY) private readonly repository: MenuRepository) {}

  public async listItems(staff: PublicStaffUser, query: ListMenuItemsDto) {
    const units = this.resolveUnits(staff, query.unit);
    const result = await this.repository.listItems({
      units,
      includeInactive: query.includeInactive ?? false,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 100,
    });
    const items = await Promise.all(result.items.map((item) => this.toResponse(item)));

    return {
      items,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 100,
      total: result.total,
    };
  }

  public async getItem(staff: PublicStaffUser, menuItemId: string): Promise<MenuItemResponse> {
    const item = await this.requireItemInScope(staff, menuItemId);
    return this.toResponse(item);
  }

  public async createItem(staff: PublicStaffUser, input: CreateMenuItemDto) {
    const unit = this.resolveSingleUnit(staff, input.unit);
    this.assertKindForUnit(unit, input.kind);

    const price = input.price ?? null;
    const currency = input.currency?.trim().toUpperCase() ?? null;
    this.assertPriceCurrency(price, currency);

    const recordInput: CreateMenuItemRecordInput = {
      unit,
      kind: input.kind,
      localizedName: this.toLocalizedText(input.localizedName, 'localizedName'),
      localizedDescription:
        input.localizedDescription === undefined || input.localizedDescription === null
          ? null
          : this.toLocalizedText(input.localizedDescription, 'localizedDescription'),
      price,
      currency,
      durationMinutes: input.durationMinutes ?? null,
      imageMediaId: input.imageMediaId ?? null,
      available: input.available ?? true,
      quantityAllowed: input.quantityAllowed ?? false,
      sortOrder: input.sortOrder ?? 0,
    };

    try {
      return await this.toResponse(await this.repository.createItem(recordInput));
    } catch (error) {
      this.rethrowConflict(
        error,
        'MENU_ITEM_NAME_CONFLICT',
        'A menu item with this name already exists.',
      );
      throw error;
    }
  }

  public async updateItem(
    staff: PublicStaffUser,
    menuItemId: string,
    input: UpdateMenuItemDto,
  ): Promise<MenuItemResponse> {
    const item = await this.requireItemInScope(staff, menuItemId);
    this.assertNonEmptyUpdate(input);
    const price = input.price === undefined ? item.price : input.price;
    const currency =
      input.currency === undefined
        ? item.currency
        : input.currency === null
          ? null
          : input.currency.trim().toUpperCase();
    this.assertPriceCurrency(price, currency);

    const update: UpdateMenuItemRecordInput = {
      ...(input.localizedName === undefined
        ? {}
        : { localizedName: this.toLocalizedText(input.localizedName, 'localizedName') }),
      ...(input.localizedDescription === undefined
        ? {}
        : {
            localizedDescription:
              input.localizedDescription === null
                ? null
                : this.toLocalizedText(input.localizedDescription, 'localizedDescription'),
          }),
      ...(input.price === undefined ? {} : { price: input.price }),
      ...(input.currency === undefined
        ? {}
        : { currency: input.currency === null ? null : input.currency.trim().toUpperCase() }),
      ...(input.durationMinutes === undefined ? {} : { durationMinutes: input.durationMinutes }),
      ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
      ...(input.available === undefined ? {} : { available: input.available }),
      ...(item.kind === 'PRODUCT'
        ? input.quantityAllowed === undefined
          ? {}
          : { quantityAllowed: input.quantityAllowed }
        : { quantityAllowed: false }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    };

    try {
      const updated = await this.repository.updateItem(item.id, update);
      if (updated === null) throw this.itemNotFound();
      return this.toResponse(updated);
    } catch (error) {
      this.rethrowConflict(
        error,
        'MENU_ITEM_NAME_CONFLICT',
        'A menu item with this name already exists.',
      );
      throw error;
    }
  }

  public async setItemActive(
    staff: PublicStaffUser,
    menuItemId: string,
    active: boolean,
  ): Promise<MenuItemResponse> {
    const item = await this.requireItemInScope(staff, menuItemId);
    try {
      const updated = await this.repository.setItemActive(item.id, active);
      if (updated === null) throw this.itemNotFound();
      return this.toResponse(updated);
    } catch (error) {
      this.rethrowConflict(
        error,
        'MENU_ITEM_NAME_CONFLICT',
        'A menu item with this name already exists.',
      );
      throw error;
    }
  }

  private resolveUnits(staff: PublicStaffUser, requestedUnit?: UnitCode): UnitCode[] {
    if (!staff.permissions.includes('menu:manage')) {
      throw new ApiException(HttpStatus.FORBIDDEN, {
        code: 'MENU_PERMISSION_REQUIRED',
        message: 'The staff account does not have menu management permission.',
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

  private resolveSingleUnit(staff: PublicStaffUser, requestedUnit: UnitCode): UnitCode {
    const unit = this.resolveUnits(staff, requestedUnit)[0];
    if (unit === undefined) throw this.unitForbidden();
    return unit;
  }

  private async requireItemInScope(
    staff: PublicStaffUser,
    menuItemId: string,
  ): Promise<MenuItemRecord> {
    const item = await this.repository.findItemById(menuItemId);
    if (item === null) throw this.itemNotFound();
    const units = this.resolveUnits(staff, item.unit);
    if (!units.includes(item.unit)) throw this.itemNotFound();
    return item;
  }

  private async toResponse(item: MenuItemRecord): Promise<MenuItemResponse> {
    return item;
  }

  private toLocalizedText(
    value: {
      uz: string;
      ru: string;
      en: string;
    },
    field: string,
  ): LocalizedText {
    const localizedText = {
      uz: value.uz.trim(),
      ru: value.ru.trim(),
      en: value.en.trim(),
    };
    const emptyLanguage = (['uz', 'ru', 'en'] as const).find(
      (language) => localizedText[language].length === 0,
    );
    if (emptyLanguage !== undefined) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'VALIDATION_ERROR',
        message: 'Every localized menu field must contain Uzbek, Russian, and English text.',
        details: [
          {
            field: `${field}.${emptyLanguage}`,
            message: 'Localized text cannot be blank.',
          },
        ],
      });
    }
    return localizedText;
  }

  private assertPriceCurrency(price: number | null, currency: string | null): void {
    if (price !== null && (currency === null || currency.length !== 3)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'MENU_CURRENCY_REQUIRED',
        message: 'Currency is required when a menu item has a price.',
      });
    }
  }

  private assertNonEmptyUpdate(input: object): void {
    if (Object.keys(input).length === 0) {
      throw new ApiException(HttpStatus.BAD_REQUEST, {
        code: 'MENU_UPDATE_EMPTY',
        message: 'At least one menu field must be provided.',
      });
    }
  }

  private assertKindForUnit(unit: UnitCode, kind: 'PRODUCT' | 'SERVICE'): void {
    if (MENU_KIND_BY_UNIT[unit] === kind) return;
    throw new ApiException(HttpStatus.BAD_REQUEST, {
      code: 'MENU_ITEM_KIND_INVALID',
      message: `The ${unit} catalog accepts ${MENU_KIND_BY_UNIT[unit]} entries only.`,
    });
  }

  private rethrowConflict(error: unknown, code: string, message: string): void {
    if (
      error instanceof MenuItemNameConflictError ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: unknown }).code === '23505')
    ) {
      throw new ApiException(HttpStatus.CONFLICT, { code, message });
    }
  }

  private itemNotFound(): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, {
      code: 'MENU_ITEM_NOT_FOUND',
      message: 'The requested menu item does not exist.',
    });
  }

  private unitForbidden(): ApiException {
    return new ApiException(HttpStatus.FORBIDDEN, {
      code: 'MENU_UNIT_FORBIDDEN',
      message: 'The staff account cannot manage this hotel unit.',
    });
  }
}
