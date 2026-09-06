import { randomUUID } from 'node:crypto';

import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, type PoolClient } from 'pg';

import type { MenuRepository } from '../menu/menu.repository';
import type { LocalizedText } from '../menu/menu.types';
import type {
  BoutiqueCategoryRecord,
  BoutiqueProductListFilter,
  BoutiqueProductRecord,
  BoutiqueVariantOption,
  BoutiqueVariantRecord,
  CreateBoutiqueCategoryInput,
  CreateBoutiqueProductInput,
  CreateBoutiqueVariantInput,
  StockAdjustmentInput,
  StockMovementRecord,
  StockReservationLine,
  UpdateBoutiqueCategoryInput,
  UpdateBoutiqueProductInput,
  UpdateBoutiqueVariantInput,
} from './boutique.types';

export const BOUTIQUE_REPOSITORY = Symbol('BOUTIQUE_REPOSITORY');

export class BoutiqueCategoryNameConflictError extends Error {
  public constructor() {
    super('A Butik Indonesia category with this name already exists.');
    this.name = 'BoutiqueCategoryNameConflictError';
  }
}

export class BoutiqueSkuConflictError extends Error {
  public constructor() {
    super('A Butik Indonesia variant with this SKU or option combination already exists.');
    this.name = 'BoutiqueSkuConflictError';
  }
}

export class BoutiqueResourceNotFoundError extends Error {
  public constructor(message = 'The requested Butik Indonesia resource does not exist.') {
    super(message);
    this.name = 'BoutiqueResourceNotFoundError';
  }
}

export class BoutiqueStockUnavailableError extends Error {
  public constructor(public readonly variantId: string) {
    super('One or more Butik Indonesia variants do not have enough stock.');
    this.name = 'BoutiqueStockUnavailableError';
  }
}

export class BoutiqueReservedStockConflictError extends Error {
  public constructor() {
    super('Stock on hand cannot be reduced below the quantity already reserved.');
    this.name = 'BoutiqueReservedStockConflictError';
  }
}

export class BoutiqueReservationIdempotencyConflictError extends Error {
  public constructor() {
    super('The client request ID is already associated with a different stock reservation.');
    this.name = 'BoutiqueReservationIdempotencyConflictError';
  }
}

export interface BoutiqueRepository {
  listCategories(includeInactive: boolean): Promise<BoutiqueCategoryRecord[]>;
  findCategoryById(id: string): Promise<BoutiqueCategoryRecord | null>;
  createCategory(input: CreateBoutiqueCategoryInput): Promise<BoutiqueCategoryRecord>;
  updateCategory(
    id: string,
    input: UpdateBoutiqueCategoryInput,
  ): Promise<BoutiqueCategoryRecord | null>;
  setCategoryActive(id: string, active: boolean): Promise<BoutiqueCategoryRecord | null>;

  listProducts(filter: BoutiqueProductListFilter): Promise<{
    items: BoutiqueProductRecord[];
    total: number;
  }>;
  findProductByMenuItemId(menuItemId: string): Promise<BoutiqueProductRecord | null>;
  createProduct(input: CreateBoutiqueProductInput): Promise<BoutiqueProductRecord>;
  updateProduct(
    menuItemId: string,
    input: UpdateBoutiqueProductInput,
  ): Promise<BoutiqueProductRecord | null>;
  setProductActive(menuItemId: string, active: boolean): Promise<BoutiqueProductRecord | null>;
  createVariant(input: CreateBoutiqueVariantInput): Promise<BoutiqueVariantRecord>;
  updateVariant(
    variantId: string,
    input: UpdateBoutiqueVariantInput,
  ): Promise<BoutiqueVariantRecord | null>;
  setVariantActive(variantId: string, active: boolean): Promise<BoutiqueVariantRecord | null>;
  adjustStock(input: StockAdjustmentInput): Promise<BoutiqueVariantRecord>;
  listStockMovements(variantId: string, limit: number): Promise<StockMovementRecord[]>;
  hasPublishedProducts(): Promise<boolean>;
  listLowStock(threshold: number): Promise<BoutiqueVariantRecord[]>;
  reserveStock(lines: readonly StockReservationLine[], requestId?: string): Promise<boolean>;
  releaseStock(lines: readonly StockReservationLine[], requestId?: string): Promise<void>;
  fulfillStock(lines: readonly StockReservationLine[], requestId?: string): Promise<void>;
}

function now(): string {
  return new Date().toISOString();
}

function cloneLocalized(value: LocalizedText): LocalizedText {
  return { uz: value.uz, ru: value.ru, en: value.en };
}

function cloneOptions(value: readonly BoutiqueVariantOption[]): BoutiqueVariantOption[] {
  return value.map((option) => ({
    code: option.code,
    label: cloneLocalized(option.label),
    value: cloneLocalized(option.value),
  }));
}

function cloneCategory(category: BoutiqueCategoryRecord): BoutiqueCategoryRecord {
  return {
    ...category,
    localizedName: cloneLocalized(category.localizedName),
    localizedDescription:
      category.localizedDescription === null ? null : cloneLocalized(category.localizedDescription),
  };
}

function cloneVariant(variant: BoutiqueVariantRecord): BoutiqueVariantRecord {
  return { ...variant, options: cloneOptions(variant.options) };
}

function cloneProduct(product: BoutiqueProductRecord): BoutiqueProductRecord {
  return {
    item: {
      ...product.item,
      localizedName: cloneLocalized(product.item.localizedName),
      localizedDescription:
        product.item.localizedDescription === null
          ? null
          : cloneLocalized(product.item.localizedDescription),
    },
    category: cloneCategory(product.category),
    categoryId: product.categoryId,
    variants: product.variants.map(cloneVariant),
  };
}

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase('en-US');
}

function sameLocalizedName(left: LocalizedText, right: LocalizedText): boolean {
  return (
    normalized(left.uz) === normalized(right.uz) ||
    normalized(left.ru) === normalized(right.ru) ||
    normalized(left.en) === normalized(right.en)
  );
}

function optionFingerprint(options: readonly BoutiqueVariantOption[]): string {
  return JSON.stringify(
    [...options]
      .sort((left, right) => left.code.localeCompare(right.code))
      .map((option) => [option.code, option.value.uz, option.value.ru, option.value.en]),
  );
}

function aggregateLines(lines: readonly StockReservationLine[]): StockReservationLine[] {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    quantities.set(line.variantId, (quantities.get(line.variantId) ?? 0) + line.quantity);
  }
  return [...quantities.entries()]
    .map(([variantId, quantity]) => ({ variantId, quantity }))
    .sort((left, right) => left.variantId.localeCompare(right.variantId));
}

function cloneMovement(movement: StockMovementRecord): StockMovementRecord {
  return { ...movement };
}

@Injectable()
export class InMemoryBoutiqueRepository implements BoutiqueRepository {
  private readonly categories = new Map<string, BoutiqueCategoryRecord>();
  private readonly products = new Map<string, { categoryId: string }>();
  private readonly variants = new Map<string, BoutiqueVariantRecord>();
  private readonly movements: StockMovementRecord[] = [];

  public constructor(private readonly menuRepository: MenuRepository) {}

  public async listCategories(includeInactive: boolean): Promise<BoutiqueCategoryRecord[]> {
    return [...this.categories.values()]
      .filter((category) => includeInactive || category.active)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id))
      .map(cloneCategory);
  }

  public async findCategoryById(id: string): Promise<BoutiqueCategoryRecord | null> {
    const category = this.categories.get(id);
    return category === undefined ? null : cloneCategory(category);
  }

  public async createCategory(input: CreateBoutiqueCategoryInput): Promise<BoutiqueCategoryRecord> {
    if (
      [...this.categories.values()].some((category) =>
        sameLocalizedName(category.localizedName, input.localizedName),
      )
    ) {
      throw new BoutiqueCategoryNameConflictError();
    }
    const timestamp = now();
    const category: BoutiqueCategoryRecord = {
      id: randomUUID(),
      localizedName: cloneLocalized(input.localizedName),
      localizedDescription:
        input.localizedDescription === null ? null : cloneLocalized(input.localizedDescription),
      imageMediaId: input.imageMediaId,
      active: true,
      sortOrder: input.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.categories.set(category.id, category);
    return cloneCategory(category);
  }

  public async updateCategory(
    id: string,
    input: UpdateBoutiqueCategoryInput,
  ): Promise<BoutiqueCategoryRecord | null> {
    const category = this.categories.get(id);
    if (category === undefined) return null;
    const nextName = input.localizedName?.uz ?? category.localizedName.uz;
    if (
      [...this.categories.values()].some(
        (candidate) =>
          candidate.id !== id &&
          (normalized(candidate.localizedName.uz) === normalized(nextName) ||
            (input.localizedName !== undefined &&
              sameLocalizedName(candidate.localizedName, input.localizedName))),
      )
    ) {
      throw new BoutiqueCategoryNameConflictError();
    }
    if (input.localizedName !== undefined)
      category.localizedName = cloneLocalized(input.localizedName);
    if (input.localizedDescription !== undefined) {
      category.localizedDescription =
        input.localizedDescription === null ? null : cloneLocalized(input.localizedDescription);
    }
    if (input.imageMediaId !== undefined) category.imageMediaId = input.imageMediaId;
    if (input.sortOrder !== undefined) category.sortOrder = input.sortOrder;
    category.updatedAt = now();
    return cloneCategory(category);
  }

  public async setCategoryActive(
    id: string,
    active: boolean,
  ): Promise<BoutiqueCategoryRecord | null> {
    const category = this.categories.get(id);
    if (category === undefined) return null;
    category.active = active;
    category.updatedAt = now();
    return cloneCategory(category);
  }

  public async listProducts(filter: BoutiqueProductListFilter): Promise<{
    items: BoutiqueProductRecord[];
    total: number;
  }> {
    const products: BoutiqueProductRecord[] = [];
    for (const [menuItemId, mapping] of this.products.entries()) {
      const product = await this.findProductByMenuItemId(menuItemId);
      if (product === null) continue;
      if (!filter.includeInactive && (!product.item.active || !product.category.active)) continue;
      if (filter.categoryId !== undefined && mapping.categoryId !== filter.categoryId) continue;
      products.push(product);
    }
    products.sort(
      (left, right) =>
        left.item.sortOrder - right.item.sortOrder || left.item.name.localeCompare(right.item.name),
    );
    const offset = (filter.page - 1) * filter.pageSize;
    return {
      items: products.slice(offset, offset + filter.pageSize).map(cloneProduct),
      total: products.length,
    };
  }

  public async findProductByMenuItemId(menuItemId: string): Promise<BoutiqueProductRecord | null> {
    const mapping = this.products.get(menuItemId);
    if (mapping === undefined) return null;
    const item = await this.menuRepository.findItemById(menuItemId);
    const category = this.categories.get(mapping.categoryId);
    if (item === null || category === undefined) return null;
    const variants = [...this.variants.values()]
      .filter((variant) => variant.menuItemId === menuItemId)
      .sort((left, right) => left.sortOrder - right.sortOrder || left.sku.localeCompare(right.sku));
    return cloneProduct({
      item,
      categoryId: mapping.categoryId,
      category,
      variants,
    });
  }

  public async createProduct(input: CreateBoutiqueProductInput): Promise<BoutiqueProductRecord> {
    const category = this.categories.get(input.categoryId);
    if (category === undefined)
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia category does not exist.');
    const firstVariant = input.variants[0];
    if (firstVariant === undefined)
      throw new BoutiqueResourceNotFoundError('A product requires at least one variant.');
    const item = await this.menuRepository.createItem({
      unit: 'BUTIK_INDONESIA',
      kind: 'PRODUCT',
      localizedName: cloneLocalized(input.localizedName),
      localizedDescription:
        input.localizedDescription === null ? null : cloneLocalized(input.localizedDescription),
      price: Math.min(...input.variants.map((variant) => variant.price)),
      currency: firstVariant.currency,
      durationMinutes: null,
      imageMediaId: input.imageMediaId,
      available: input.available,
      quantityAllowed: true,
      sortOrder: input.sortOrder,
    });
    this.products.set(item.id, { categoryId: input.categoryId });
    try {
      for (const variant of input.variants) {
        this.createVariantRecord(item.id, variant);
      }
    } catch (error) {
      this.products.delete(item.id);
      await this.menuRepository.deleteItem(item.id);
      throw error;
    }
    return (await this.findProductByMenuItemId(item.id)) as BoutiqueProductRecord;
  }

  public async updateProduct(
    menuItemId: string,
    input: UpdateBoutiqueProductInput,
  ): Promise<BoutiqueProductRecord | null> {
    const existing = await this.findProductByMenuItemId(menuItemId);
    if (existing === null) return null;
    if (input.categoryId !== undefined && !this.categories.has(input.categoryId)) {
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia category does not exist.');
    }
    await this.menuRepository.updateItem(menuItemId, {
      ...(input.localizedName === undefined
        ? {}
        : { localizedName: cloneLocalized(input.localizedName) }),
      ...(input.localizedDescription === undefined
        ? {}
        : {
            localizedDescription:
              input.localizedDescription === null
                ? null
                : cloneLocalized(input.localizedDescription),
          }),
      ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
      ...(input.available === undefined ? {} : { available: input.available }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    });
    if (input.categoryId !== undefined) {
      const mapping = this.products.get(menuItemId);
      if (mapping !== undefined) mapping.categoryId = input.categoryId;
    }
    return this.findProductByMenuItemId(menuItemId);
  }

  public async setProductActive(
    menuItemId: string,
    active: boolean,
  ): Promise<BoutiqueProductRecord | null> {
    if (!this.products.has(menuItemId)) return null;
    await this.menuRepository.setItemActive(menuItemId, active);
    return this.findProductByMenuItemId(menuItemId);
  }

  public async createVariant(input: CreateBoutiqueVariantInput): Promise<BoutiqueVariantRecord> {
    if (!this.products.has(input.menuItemId))
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia product does not exist.');
    const variant = this.createVariantRecord(input.menuItemId, input);
    await this.syncBasePrice(input.menuItemId);
    return cloneVariant(variant);
  }

  public async updateVariant(
    variantId: string,
    input: UpdateBoutiqueVariantInput,
  ): Promise<BoutiqueVariantRecord | null> {
    const variant = this.variants.get(variantId);
    if (variant === undefined) return null;
    const nextOptions = input.options === undefined ? variant.options : input.options;
    const nextSku = input.sku ?? variant.sku;
    this.assertVariantUnique(variant.menuItemId, variantId, nextSku, nextOptions);
    if (input.sku !== undefined) variant.sku = input.sku.trim();
    if (input.options !== undefined) variant.options = cloneOptions(input.options);
    if (input.price !== undefined) variant.price = input.price;
    if (input.currency !== undefined) variant.currency = input.currency;
    if (input.sortOrder !== undefined) variant.sortOrder = input.sortOrder;
    variant.updatedAt = now();
    await this.syncBasePrice(variant.menuItemId);
    return cloneVariant(variant);
  }

  public async setVariantActive(
    variantId: string,
    active: boolean,
  ): Promise<BoutiqueVariantRecord | null> {
    const variant = this.variants.get(variantId);
    if (variant === undefined) return null;
    variant.active = active;
    variant.updatedAt = now();
    return cloneVariant(variant);
  }

  public async adjustStock(input: StockAdjustmentInput): Promise<BoutiqueVariantRecord> {
    const variant = this.variants.get(input.variantId);
    if (variant === undefined)
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
    const nextStock = variant.stockOnHand + input.delta;
    if (nextStock < variant.reservedQuantity) throw new BoutiqueReservedStockConflictError();
    if (nextStock < 0) throw new BoutiqueReservedStockConflictError();
    variant.stockOnHand = nextStock;
    this.refreshAvailableQuantity(variant);
    variant.updatedAt = now();
    this.movements.push({
      id: randomUUID(),
      variantId: variant.id,
      type: 'ADJUSTMENT',
      quantity: input.delta,
      reason: input.reason.trim(),
      requestId: null,
      actorId: input.actorId,
      createdAt: now(),
    });
    return cloneVariant(variant);
  }

  public async listStockMovements(
    variantId: string,
    limit: number,
  ): Promise<StockMovementRecord[]> {
    return this.movements
      .filter((movement) => movement.variantId === variantId)
      .slice(-limit)
      .reverse()
      .map(cloneMovement);
  }

  public async hasPublishedProducts(): Promise<boolean> {
    for (const menuItemId of this.products.keys()) {
      const product = await this.findProductByMenuItemId(menuItemId);
      if (product?.item.active && product.category.active && product.item.available) return true;
    }
    return false;
  }

  public async listLowStock(threshold: number): Promise<BoutiqueVariantRecord[]> {
    return [...this.variants.values()]
      .filter((variant) => variant.active && variant.availableQuantity <= threshold)
      .sort((left, right) => left.availableQuantity - right.availableQuantity)
      .map(cloneVariant);
  }

  public async reserveStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<boolean> {
    const aggregated = aggregateLines(lines);
    if (aggregated.length === 0) return true;
    if (requestId !== undefined) {
      const existing = this.activeReservationFor(requestId);
      if (existing.size > 0) {
        const matches =
          existing.size === aggregated.length &&
          aggregated.every((line) => existing.get(line.variantId) === line.quantity);
        if (!matches) throw new BoutiqueReservationIdempotencyConflictError();
        return false;
      }
    }
    for (const line of aggregated) {
      const variant = this.variants.get(line.variantId);
      if (variant === undefined || !variant.active || variant.availableQuantity < line.quantity) {
        throw new BoutiqueStockUnavailableError(line.variantId);
      }
    }
    for (const line of aggregated) {
      const variant = this.variants.get(line.variantId) as BoutiqueVariantRecord;
      variant.reservedQuantity += line.quantity;
      this.refreshAvailableQuantity(variant);
      variant.updatedAt = now();
      this.recordMovement(
        variant.id,
        'RESERVE',
        line.quantity,
        'Guest reservation',
        requestId,
        null,
      );
    }
    return true;
  }

  public async releaseStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    const aggregated = aggregateLines(lines);
    if (aggregated.length === 0) return;
    // Validate resource identity before comparing a request's reservation
    // fingerprint. This preserves the repository contract for malformed
    // release calls while keeping valid retries idempotent.
    for (const line of aggregated) {
      if (!this.variants.has(line.variantId))
        throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
    }
    if (requestId !== undefined) {
      const previous = this.activeReservationFor(requestId);
      const hasHistory = this.movements.some((movement) => movement.requestId === requestId);
      if (hasHistory) {
        if (previous.size === 0) return;
        const matches =
          previous.size === aggregated.length &&
          aggregated.every((line) => previous.get(line.variantId) === line.quantity);
        if (!matches) throw new BoutiqueReservationIdempotencyConflictError();
      }
    }
    for (const line of aggregated) {
      const variant = this.variants.get(line.variantId);
      if (variant === undefined)
        throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
      if (variant.reservedQuantity < line.quantity) throw new BoutiqueReservedStockConflictError();
    }
    for (const line of aggregated) {
      const variant = this.variants.get(line.variantId) as BoutiqueVariantRecord;
      variant.reservedQuantity -= line.quantity;
      this.refreshAvailableQuantity(variant);
      variant.updatedAt = now();
      this.recordMovement(
        variant.id,
        'RELEASE',
        line.quantity,
        'Reservation released',
        requestId,
        null,
      );
    }
  }

  public async fulfillStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    for (const line of aggregateLines(lines)) {
      const variant = this.variants.get(line.variantId);
      if (
        variant === undefined ||
        variant.reservedQuantity < line.quantity ||
        variant.stockOnHand < line.quantity
      ) {
        throw new BoutiqueStockUnavailableError(line.variantId);
      }
    }
    for (const line of aggregateLines(lines)) {
      const variant = this.variants.get(line.variantId) as BoutiqueVariantRecord;
      variant.reservedQuantity -= line.quantity;
      variant.stockOnHand -= line.quantity;
      this.refreshAvailableQuantity(variant);
      variant.updatedAt = now();
      this.recordMovement(variant.id, 'FULFILL', line.quantity, 'Order fulfilled', requestId, null);
    }
  }

  private createVariantRecord(
    menuItemId: string,
    input: Omit<CreateBoutiqueVariantInput, 'menuItemId'>,
  ): BoutiqueVariantRecord {
    this.assertVariantUnique(menuItemId, undefined, input.sku, input.options);
    const timestamp = now();
    const variant: BoutiqueVariantRecord = {
      id: randomUUID(),
      menuItemId,
      sku: input.sku.trim(),
      options: cloneOptions(input.options),
      price: input.price,
      currency: input.currency,
      active: true,
      stockOnHand: input.stockOnHand,
      reservedQuantity: 0,
      availableQuantity: input.stockOnHand,
      sortOrder: input.sortOrder,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.variants.set(variant.id, variant);
    return variant;
  }

  private refreshAvailableQuantity(variant: BoutiqueVariantRecord): void {
    variant.availableQuantity = variant.stockOnHand - variant.reservedQuantity;
  }

  private assertVariantUnique(
    menuItemId: string,
    variantId: string | undefined,
    sku: string,
    options: readonly BoutiqueVariantOption[],
  ): void {
    const fingerprint = optionFingerprint(options);
    if (
      [...this.variants.values()].some(
        (variant) =>
          variant.id !== variantId &&
          (normalized(variant.sku) === normalized(sku) ||
            (variant.menuItemId === menuItemId &&
              optionFingerprint(variant.options) === fingerprint)),
      )
    ) {
      throw new BoutiqueSkuConflictError();
    }
  }

  private async syncBasePrice(menuItemId: string): Promise<void> {
    const variants = [...this.variants.values()].filter(
      (variant) => variant.menuItemId === menuItemId && variant.active,
    );
    const cheapest = variants.sort((left, right) => left.price - right.price)[0];
    if (cheapest === undefined) return;
    await this.menuRepository.updateItem(menuItemId, {
      price: cheapest.price,
      currency: cheapest.currency,
    });
  }

  private recordMovement(
    variantId: string,
    type: StockMovementRecord['type'],
    quantity: number,
    reason: string,
    requestId: string | undefined,
    actorId: string | null,
  ): void {
    this.movements.push({
      id: randomUUID(),
      variantId,
      type,
      quantity,
      reason,
      requestId: requestId ?? null,
      actorId,
      createdAt: now(),
    });
  }

  private activeReservationFor(requestId: string): Map<string, number> {
    const quantities = new Map<string, number>();
    for (const movement of this.movements) {
      if (movement.requestId !== requestId) continue;
      const sign =
        movement.type === 'RESERVE'
          ? 1
          : movement.type === 'RELEASE' || movement.type === 'FULFILL'
            ? -1
            : 0;
      if (sign === 0) continue;
      quantities.set(
        movement.variantId,
        (quantities.get(movement.variantId) ?? 0) + sign * movement.quantity,
      );
    }
    for (const [variantId, quantity] of quantities) {
      if (quantity <= 0) quantities.delete(variantId);
    }
    return quantities;
  }
}

interface CategoryRow {
  id: string;
  name_uz: string;
  name_ru: string;
  name_en: string;
  description_uz: string | null;
  description_ru: string | null;
  description_en: string | null;
  image_media_id: string | null;
  active: boolean;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface ProductRow {
  menu_item_id: string;
  category_id: string;
  total_count?: number | string;
}

interface VariantRow {
  id: string;
  menu_item_id: string;
  sku: string;
  options: unknown;
  price: number | string;
  currency: string;
  active: boolean;
  stock_on_hand: number;
  reserved_quantity: number;
  sort_order: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MovementRow {
  id: string;
  variant_id: string;
  type: StockMovementRecord['type'];
  quantity: number;
  reason: string;
  request_id: string | null;
  actor_id: string | null;
  created_at: Date | string;
}

function isVariantOptions(value: unknown): value is BoutiqueVariantOption[] {
  return Array.isArray(value);
}

@Injectable()
export class PostgresBoutiqueRepository implements BoutiqueRepository, OnModuleDestroy {
  private readonly pool: Pool;
  private initialization?: Promise<void>;

  public constructor(
    config: ConfigService,
    private readonly menuRepository: MenuRepository,
  ) {
    const connectionString = config.get<string>('DATABASE_URL');
    if (connectionString === undefined || connectionString.trim().length === 0) {
      throw new Error('DATABASE_URL is required when AUTH_STORE=postgres');
    }
    this.pool = new Pool({ connectionString });
  }

  public async listCategories(includeInactive: boolean): Promise<BoutiqueCategoryRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<CategoryRow>(
      `SELECT id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
              image_media_id, active, sort_order, created_at, updated_at
         FROM boutique_categories
        WHERE $1::boolean OR active = true
        ORDER BY sort_order ASC, id ASC`,
      [includeInactive],
    );
    return result.rows.map((row) => this.toCategory(row));
  }

  public async findCategoryById(id: string): Promise<BoutiqueCategoryRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<CategoryRow>(
      `SELECT id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
              image_media_id, active, sort_order, created_at, updated_at
         FROM boutique_categories WHERE id::text = $1 LIMIT 1`,
      [id],
    );
    return result.rows[0] === undefined ? null : this.toCategory(result.rows[0]);
  }

  public async createCategory(input: CreateBoutiqueCategoryInput): Promise<BoutiqueCategoryRecord> {
    await this.ensureInitialized();
    try {
      const result = await this.pool.query<CategoryRow>(
        `INSERT INTO boutique_categories
          (id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
           image_media_id, active, sort_order)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8::uuid, true, $9)
         RETURNING id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
                   image_media_id, active, sort_order, created_at, updated_at`,
        [
          randomUUID(),
          input.localizedName.uz,
          input.localizedName.ru,
          input.localizedName.en,
          input.localizedDescription?.uz ?? null,
          input.localizedDescription?.ru ?? null,
          input.localizedDescription?.en ?? null,
          input.imageMediaId,
          input.sortOrder,
        ],
      );
      return this.toCategory(result.rows[0] as CategoryRow);
    } catch (error) {
      if (isUniqueViolation(error)) throw new BoutiqueCategoryNameConflictError();
      throw error;
    }
  }

  public async updateCategory(
    id: string,
    input: UpdateBoutiqueCategoryInput,
  ): Promise<BoutiqueCategoryRecord | null> {
    const current = await this.findCategoryById(id);
    if (current === null) return null;
    await this.ensureInitialized();
    try {
      const result = await this.pool.query<CategoryRow>(
        `UPDATE boutique_categories
            SET name_uz = $2, name_ru = $3, name_en = $4,
                description_uz = $5, description_ru = $6, description_en = $7,
                image_media_id = $8::uuid, sort_order = $9, updated_at = now()
          WHERE id::text = $1
          RETURNING id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
                    image_media_id, active, sort_order, created_at, updated_at`,
        [
          id,
          input.localizedName?.uz ?? current.localizedName.uz,
          input.localizedName?.ru ?? current.localizedName.ru,
          input.localizedName?.en ?? current.localizedName.en,
          input.localizedDescription === undefined
            ? (current.localizedDescription?.uz ?? null)
            : (input.localizedDescription?.uz ?? null),
          input.localizedDescription === undefined
            ? (current.localizedDescription?.ru ?? null)
            : (input.localizedDescription?.ru ?? null),
          input.localizedDescription === undefined
            ? (current.localizedDescription?.en ?? null)
            : (input.localizedDescription?.en ?? null),
          input.imageMediaId === undefined ? current.imageMediaId : input.imageMediaId,
          input.sortOrder ?? current.sortOrder,
        ],
      );
      return result.rows[0] === undefined ? null : this.toCategory(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new BoutiqueCategoryNameConflictError();
      throw error;
    }
  }

  public async setCategoryActive(
    id: string,
    active: boolean,
  ): Promise<BoutiqueCategoryRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<CategoryRow>(
      `UPDATE boutique_categories SET active = $2, updated_at = now()
        WHERE id::text = $1
        RETURNING id, name_uz, name_ru, name_en, description_uz, description_ru, description_en,
                  image_media_id, active, sort_order, created_at, updated_at`,
      [id, active],
    );
    return result.rows[0] === undefined ? null : this.toCategory(result.rows[0]);
  }

  public async listProducts(filter: BoutiqueProductListFilter): Promise<{
    items: BoutiqueProductRecord[];
    total: number;
  }> {
    await this.ensureInitialized();
    const values: unknown[] = [filter.includeInactive, filter.categoryId ?? null];
    values.push(filter.pageSize);
    values.push((filter.page - 1) * filter.pageSize);
    const result = await this.pool.query<ProductRow>(
      `SELECT p.menu_item_id, p.category_id, COUNT(*) OVER() AS total_count
         FROM boutique_products p
         JOIN menu_items m ON m.id = p.menu_item_id
         JOIN boutique_categories c ON c.id = p.category_id
        WHERE ($1::boolean OR (m.active = true AND c.active = true))
          AND ($2::uuid IS NULL OR p.category_id = $2::uuid)
        ORDER BY m.sort_order ASC, m.name ASC
        LIMIT $3 OFFSET $4`,
      values,
    );
    const items = await Promise.all(
      result.rows.map(async (row) => this.findProductByMenuItemId(row.menu_item_id)),
    );
    return {
      items: items.filter((item): item is BoutiqueProductRecord => item !== null),
      total: result.rows[0] === undefined ? 0 : Number(result.rows[0].total_count ?? 0),
    };
  }

  public async findProductByMenuItemId(menuItemId: string): Promise<BoutiqueProductRecord | null> {
    await this.ensureInitialized();
    const item = await this.menuRepository.findItemById(menuItemId);
    if (item === null) return null;
    const mapping = await this.pool.query<{ category_id: string }>(
      'SELECT category_id FROM boutique_products WHERE menu_item_id = $1::uuid LIMIT 1',
      [menuItemId],
    );
    const categoryId = mapping.rows[0]?.category_id;
    if (categoryId === undefined) return null;
    const category = await this.findCategoryById(categoryId);
    if (category === null) return null;
    const variants = await this.pool.query<VariantRow>(
      `SELECT id, menu_item_id, sku, options, price, currency, active,
              stock_on_hand, reserved_quantity, sort_order, created_at, updated_at
         FROM boutique_product_variants
        WHERE menu_item_id = $1::uuid
        ORDER BY sort_order ASC, sku ASC`,
      [menuItemId],
    );
    return {
      item,
      categoryId,
      category,
      variants: variants.rows.map((row) => this.toVariant(row)),
    };
  }

  public async createProduct(input: CreateBoutiqueProductInput): Promise<BoutiqueProductRecord> {
    const category = await this.findCategoryById(input.categoryId);
    if (category === null)
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia category does not exist.');
    const firstVariant = input.variants[0];
    if (firstVariant === undefined)
      throw new BoutiqueResourceNotFoundError('A product requires at least one variant.');
    const item = await this.menuRepository.createItem({
      unit: 'BUTIK_INDONESIA',
      kind: 'PRODUCT',
      localizedName: input.localizedName,
      localizedDescription: input.localizedDescription,
      price: Math.min(...input.variants.map((variant) => variant.price)),
      currency: firstVariant.currency,
      durationMinutes: null,
      imageMediaId: input.imageMediaId,
      available: input.available,
      quantityAllowed: true,
      sortOrder: input.sortOrder,
    });
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        'UPDATE menu_items SET boutique_category_id = $2::uuid WHERE id = $1::uuid',
        [item.id, input.categoryId],
      );
      await client.query(
        'INSERT INTO boutique_products (menu_item_id, category_id) VALUES ($1::uuid, $2::uuid)',
        [item.id, input.categoryId],
      );
      for (const variant of input.variants) {
        await this.insertVariant(client, item.id, variant);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      await this.menuRepository.deleteItem(item.id).catch(() => false);
      if (isUniqueViolation(error)) throw new BoutiqueSkuConflictError();
      throw error;
    } finally {
      client.release();
    }
    return (await this.findProductByMenuItemId(item.id)) as BoutiqueProductRecord;
  }

  public async updateProduct(
    menuItemId: string,
    input: UpdateBoutiqueProductInput,
  ): Promise<BoutiqueProductRecord | null> {
    const existing = await this.findProductByMenuItemId(menuItemId);
    if (existing === null) return null;
    if (
      input.categoryId !== undefined &&
      (await this.findCategoryById(input.categoryId)) === null
    ) {
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia category does not exist.');
    }
    await this.menuRepository.updateItem(menuItemId, {
      ...(input.localizedName === undefined ? {} : { localizedName: input.localizedName }),
      ...(input.localizedDescription === undefined
        ? {}
        : { localizedDescription: input.localizedDescription }),
      ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
      ...(input.available === undefined ? {} : { available: input.available }),
      ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
    });
    await this.ensureInitialized();
    await this.pool.query(
      `UPDATE boutique_products SET category_id = COALESCE($2::uuid, category_id), updated_at = now()
        WHERE menu_item_id = $1::uuid`,
      [menuItemId, input.categoryId ?? null],
    );
    if (input.categoryId !== undefined) {
      await this.pool.query(
        'UPDATE menu_items SET boutique_category_id = $2::uuid, updated_at = now() WHERE id = $1::uuid',
        [menuItemId, input.categoryId],
      );
    }
    return this.findProductByMenuItemId(menuItemId);
  }

  public async setProductActive(
    menuItemId: string,
    active: boolean,
  ): Promise<BoutiqueProductRecord | null> {
    if ((await this.findProductByMenuItemId(menuItemId)) === null) return null;
    await this.menuRepository.setItemActive(menuItemId, active);
    return this.findProductByMenuItemId(menuItemId);
  }

  public async createVariant(input: CreateBoutiqueVariantInput): Promise<BoutiqueVariantRecord> {
    if ((await this.findProductByMenuItemId(input.menuItemId)) === null) {
      throw new BoutiqueResourceNotFoundError('The Butik Indonesia product does not exist.');
    }
    await this.ensureInitialized();
    try {
      const result = await this.pool.query<VariantRow>(
        `INSERT INTO boutique_product_variants
          (id, menu_item_id, sku, options, option_fingerprint, price, currency,
           active, stock_on_hand, reserved_quantity, sort_order)
         VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, true, $8, 0, $9)
         RETURNING id, menu_item_id, sku, options, price, currency, active,
                   stock_on_hand, reserved_quantity, sort_order, created_at, updated_at`,
        [
          randomUUID(),
          input.menuItemId,
          input.sku.trim(),
          JSON.stringify(input.options),
          optionFingerprint(input.options),
          input.price,
          input.currency,
          input.stockOnHand,
          input.sortOrder,
        ],
      );
      await this.syncBasePrice(input.menuItemId);
      return this.toVariant(result.rows[0] as VariantRow);
    } catch (error) {
      if (isUniqueViolation(error)) throw new BoutiqueSkuConflictError();
      throw error;
    }
  }

  public async updateVariant(
    variantId: string,
    input: UpdateBoutiqueVariantInput,
  ): Promise<BoutiqueVariantRecord | null> {
    await this.ensureInitialized();
    const currentResult = await this.pool.query<VariantRow>(
      `SELECT id, menu_item_id, sku, options, price, currency, active,
              stock_on_hand, reserved_quantity, sort_order, created_at, updated_at
         FROM boutique_product_variants WHERE id::text = $1 LIMIT 1`,
      [variantId],
    );
    const current = currentResult.rows[0];
    if (current === undefined) return null;
    const currentOptions = this.toVariant(current).options;
    try {
      const result = await this.pool.query<VariantRow>(
        `UPDATE boutique_product_variants
            SET sku = $2, options = $3::jsonb, option_fingerprint = $4,
                price = $5, currency = $6, sort_order = $7, updated_at = now()
          WHERE id::text = $1
          RETURNING id, menu_item_id, sku, options, price, currency, active,
                    stock_on_hand, reserved_quantity, sort_order, created_at, updated_at`,
        [
          variantId,
          input.sku?.trim() ?? current.sku,
          JSON.stringify(input.options ?? currentOptions),
          optionFingerprint(input.options ?? currentOptions),
          input.price ?? Number(current.price),
          input.currency ?? current.currency,
          input.sortOrder ?? current.sort_order,
        ],
      );
      await this.syncBasePrice(current.menu_item_id);
      return result.rows[0] === undefined ? null : this.toVariant(result.rows[0]);
    } catch (error) {
      if (isUniqueViolation(error)) throw new BoutiqueSkuConflictError();
      throw error;
    }
  }

  public async setVariantActive(
    variantId: string,
    active: boolean,
  ): Promise<BoutiqueVariantRecord | null> {
    await this.ensureInitialized();
    const result = await this.pool.query<VariantRow>(
      `UPDATE boutique_product_variants SET active = $2, updated_at = now()
        WHERE id::text = $1
        RETURNING id, menu_item_id, sku, options, price, currency, active,
                  stock_on_hand, reserved_quantity, sort_order, created_at, updated_at`,
      [variantId, active],
    );
    return result.rows[0] === undefined ? null : this.toVariant(result.rows[0]);
  }

  public async adjustStock(input: StockAdjustmentInput): Promise<BoutiqueVariantRecord> {
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const current = await client.query<VariantRow>(
        `SELECT id, menu_item_id, sku, options, price, currency, active,
                stock_on_hand, reserved_quantity, sort_order, created_at, updated_at
           FROM boutique_product_variants WHERE id::text = $1 FOR UPDATE`,
        [input.variantId],
      );
      const row = current.rows[0];
      if (row === undefined)
        throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
      const nextStock = row.stock_on_hand + input.delta;
      if (nextStock < row.reserved_quantity || nextStock < 0) {
        throw new BoutiqueReservedStockConflictError();
      }
      const result = await client.query<VariantRow>(
        `UPDATE boutique_product_variants SET stock_on_hand = $2, updated_at = now()
          WHERE id::text = $1
          RETURNING id, menu_item_id, sku, options, price, currency, active,
                    stock_on_hand, reserved_quantity, sort_order, created_at, updated_at`,
        [input.variantId, nextStock],
      );
      await client.query(
        `INSERT INTO boutique_inventory_movements
          (id, variant_id, movement_type, quantity, reason, request_id, actor_id)
         VALUES ($1::uuid, $2::uuid, 'ADJUSTMENT', $3, $4, NULL, $5::uuid)`,
        [randomUUID(), input.variantId, input.delta, input.reason.trim(), input.actorId],
      );
      await client.query('COMMIT');
      return this.toVariant(result.rows[0] as VariantRow);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async listStockMovements(
    variantId: string,
    limit: number,
  ): Promise<StockMovementRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<MovementRow>(
      `SELECT id, variant_id, movement_type AS type, quantity, reason, request_id, actor_id, created_at
         FROM boutique_inventory_movements
        WHERE variant_id::text = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [variantId, limit],
    );
    return result.rows.map((row) => ({
      id: row.id,
      variantId: row.variant_id,
      type: row.type,
      quantity: row.quantity,
      reason: row.reason,
      requestId: row.request_id,
      actorId: row.actor_id,
      createdAt: this.toIsoString(row.created_at),
    }));
  }

  public async hasPublishedProducts(): Promise<boolean> {
    await this.ensureInitialized();
    const result = await this.pool.query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM boutique_products p
         JOIN menu_items m ON m.id = p.menu_item_id
         JOIN boutique_categories c ON c.id = p.category_id
        WHERE m.active = true AND m.available = true AND c.active = true
       ) AS exists`,
    );
    return result.rows[0]?.exists === true;
  }

  public async listLowStock(threshold: number): Promise<BoutiqueVariantRecord[]> {
    await this.ensureInitialized();
    const result = await this.pool.query<VariantRow>(
      `SELECT id, menu_item_id, sku, options, price, currency, active,
              stock_on_hand, reserved_quantity, sort_order, created_at, updated_at
         FROM boutique_product_variants
        WHERE active = true AND stock_on_hand - reserved_quantity <= $1
        ORDER BY stock_on_hand - reserved_quantity ASC, sku ASC`,
      [threshold],
    );
    return result.rows.map((row) => this.toVariant(row));
  }

  public async reserveStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<boolean> {
    return this.adjustReservedStock(lines, 'RESERVE', requestId);
  }

  public async releaseStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    await this.adjustReservedStock(lines, 'RELEASE', requestId);
  }

  public async fulfillStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    const aggregated = aggregateLines(lines);
    if (aggregated.length === 0) return;
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const line of aggregated) {
        const current = await this.lockVariant(client, line.variantId);
        if (
          current === null ||
          current.reserved_quantity < line.quantity ||
          current.stock_on_hand < line.quantity
        ) {
          throw new BoutiqueStockUnavailableError(line.variantId);
        }
      }
      for (const line of aggregated) {
        await client.query(
          `UPDATE boutique_product_variants
              SET stock_on_hand = stock_on_hand - $2,
                  reserved_quantity = reserved_quantity - $2,
                  updated_at = now()
            WHERE id = $1::uuid`,
          [line.variantId, line.quantity],
        );
        await this.insertMovement(
          client,
          line.variantId,
          'FULFILL',
          line.quantity,
          'Order fulfilled',
          requestId,
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async adjustReservedStock(
    lines: readonly StockReservationLine[],
    type: 'RESERVE' | 'RELEASE',
    requestId?: string,
  ): Promise<boolean> {
    const aggregated = aggregateLines(lines);
    if (aggregated.length === 0) return true;
    await this.ensureInitialized();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const line of aggregated) {
        const row = await this.lockVariant(client, line.variantId);
        if (row === null)
          throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
      }
      if (requestId !== undefined && (type === 'RESERVE' || type === 'RELEASE')) {
        const previous = await client.query<{
          variant_id: string;
          active_quantity: number | string;
          movement_count: number | string;
        }>(
          `SELECT variant_id, COALESCE(SUM(
             CASE WHEN movement_type = 'RESERVE' THEN quantity
                  WHEN movement_type IN ('RELEASE', 'FULFILL') THEN -quantity
                  ELSE 0 END
           ), 0) AS active_quantity,
           COUNT(*) AS movement_count
             FROM boutique_inventory_movements
            WHERE request_id = $1::uuid
            GROUP BY variant_id
          `,
          [requestId],
        );
        const previousReservations = new Map(
          previous.rows
            .map((row) => [row.variant_id, Number(row.active_quantity)] as const)
            .filter(([, quantity]) => quantity > 0),
        );
        const hasHistory = previous.rows.some((row) => Number(row.movement_count) > 0);
        if (hasHistory) {
          const matches =
            previousReservations.size === aggregated.length &&
            aggregated.every((line) => previousReservations.get(line.variantId) === line.quantity);
          if (type === 'RESERVE' && previousReservations.size === 0) {
            // A fully released/fulfilled request is not a new reservation. The
            // request repository handles the retry; avoid resurrecting stock.
            await client.query('COMMIT');
            return false;
          }
          if (previousReservations.size === 0 && type === 'RELEASE') {
            await client.query('COMMIT');
            return false;
          }
          if (!matches) throw new BoutiqueReservationIdempotencyConflictError();
          if (type === 'RELEASE') {
            // The exact active reservation is released below.
          } else {
            await client.query('COMMIT');
            return false;
          }
        }
      }
      for (const line of aggregated) {
        const row = await this.lockVariant(client, line.variantId);
        if (row === null)
          throw new BoutiqueResourceNotFoundError('The Butik Indonesia variant does not exist.');
        if (type === 'RELEASE' && row.reserved_quantity < line.quantity)
          throw new BoutiqueReservedStockConflictError();
        if (
          type === 'RESERVE' &&
          (!row.active || row.stock_on_hand - row.reserved_quantity < line.quantity)
        ) {
          throw new BoutiqueStockUnavailableError(line.variantId);
        }
      }
      for (const line of aggregated) {
        const delta = type === 'RESERVE' ? line.quantity : -line.quantity;
        await client.query(
          `UPDATE boutique_product_variants SET reserved_quantity = reserved_quantity + $2, updated_at = now()
            WHERE id = $1::uuid`,
          [line.variantId, delta],
        );
        await this.insertMovement(
          client,
          line.variantId,
          type,
          line.quantity,
          type === 'RESERVE' ? 'Guest reservation' : 'Reservation released',
          requestId,
        );
      }
      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async lockVariant(client: PoolClient, variantId: string): Promise<VariantRow | null> {
    const result = await client.query<VariantRow>(
      `SELECT id, menu_item_id, sku, options, price, currency, active,
              stock_on_hand, reserved_quantity, sort_order, created_at, updated_at
         FROM boutique_product_variants WHERE id = $1::uuid FOR UPDATE`,
      [variantId],
    );
    return result.rows[0] ?? null;
  }

  private async insertMovement(
    client: PoolClient,
    variantId: string,
    type: StockMovementRecord['type'],
    quantity: number,
    reason: string,
    requestId?: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO boutique_inventory_movements
        (id, variant_id, movement_type, quantity, reason, request_id, actor_id)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::uuid, NULL)`,
      [randomUUID(), variantId, type, quantity, reason, requestId ?? null],
    );
  }

  private async insertVariant(
    client: PoolClient,
    menuItemId: string,
    input: Omit<CreateBoutiqueVariantInput, 'menuItemId'>,
  ): Promise<void> {
    await client.query(
      `INSERT INTO boutique_product_variants
        (id, menu_item_id, sku, options, option_fingerprint, price, currency,
         active, stock_on_hand, reserved_quantity, sort_order)
       VALUES ($1::uuid, $2::uuid, $3, $4::jsonb, $5, $6, $7, true, $8, 0, $9)`,
      [
        randomUUID(),
        menuItemId,
        input.sku.trim(),
        JSON.stringify(input.options),
        optionFingerprint(input.options),
        input.price,
        input.currency,
        input.stockOnHand,
        input.sortOrder,
      ],
    );
  }

  private async syncBasePrice(menuItemId: string): Promise<void> {
    await this.ensureInitialized();
    const result = await this.pool.query<{ price: number | string; currency: string }>(
      `SELECT price, currency FROM boutique_product_variants
        WHERE menu_item_id = $1::uuid AND active = true
        ORDER BY price ASC LIMIT 1`,
      [menuItemId],
    );
    const cheapest = result.rows[0];
    if (cheapest === undefined) return;
    await this.menuRepository.updateItem(menuItemId, {
      price: Number(cheapest.price),
      currency: cheapest.currency,
    });
  }

  private async ensureInitialized(): Promise<void> {
    this.initialization ??= this.initialize();
    await this.initialization;
  }

  private async initialize(): Promise<void> {
    await this.menuRepository.listItems({
      units: ['BUTIK_INDONESIA'],
      includeInactive: true,
      page: 1,
      pageSize: 1,
    });
    await this.pool.query(`
      ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS boutique_category_id uuid
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS boutique_categories (
        id uuid PRIMARY KEY,
        name_uz text NOT NULL,
        name_ru text NOT NULL,
        name_en text NOT NULL,
        description_uz text,
        description_ru text,
        description_en text,
        image_media_id uuid,
        active boolean NOT NULL DEFAULT true,
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS boutique_products (
        menu_item_id uuid PRIMARY KEY REFERENCES menu_items(id) ON DELETE RESTRICT,
        category_id uuid NOT NULL REFERENCES boutique_categories(id) ON DELETE RESTRICT,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS boutique_product_variants (
        id uuid PRIMARY KEY,
        menu_item_id uuid NOT NULL REFERENCES menu_items(id) ON DELETE RESTRICT,
        sku text NOT NULL,
        options jsonb NOT NULL,
        option_fingerprint text NOT NULL,
        price numeric NOT NULL CHECK (price >= 0),
        currency text NOT NULL CHECK (char_length(currency) = 3),
        active boolean NOT NULL DEFAULT true,
        stock_on_hand integer NOT NULL DEFAULT 0 CHECK (stock_on_hand >= 0),
        reserved_quantity integer NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
        sort_order integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (menu_item_id, option_fingerprint)
      )
    `);
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS boutique_inventory_movements (
        id uuid PRIMARY KEY,
        variant_id uuid NOT NULL REFERENCES boutique_product_variants(id) ON DELETE RESTRICT,
        movement_type text NOT NULL,
        quantity integer NOT NULL,
        reason text NOT NULL,
        request_id uuid,
        actor_id uuid,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS boutique_products_category_idx ON boutique_products (category_id)',
    );
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS boutique_categories_name_uz_ci_idx ON boutique_categories (lower(name_uz))',
    );
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS boutique_categories_name_ru_ci_idx ON boutique_categories (lower(name_ru))',
    );
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS boutique_categories_name_en_ci_idx ON boutique_categories (lower(name_en))',
    );
    await this.pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS boutique_variants_sku_ci_idx ON boutique_product_variants (lower(sku))',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS boutique_variants_menu_item_idx ON boutique_product_variants (menu_item_id, sort_order)',
    );
    await this.pool.query(
      'CREATE INDEX IF NOT EXISTS boutique_inventory_variant_idx ON boutique_inventory_movements (variant_id, created_at DESC)',
    );
  }

  private toCategory(row: CategoryRow): BoutiqueCategoryRecord {
    return {
      id: row.id,
      localizedName: { uz: row.name_uz, ru: row.name_ru, en: row.name_en },
      localizedDescription:
        row.description_uz === null && row.description_ru === null && row.description_en === null
          ? null
          : {
              uz: row.description_uz ?? '',
              ru: row.description_ru ?? '',
              en: row.description_en ?? '',
            },
      imageMediaId: row.image_media_id,
      active: row.active,
      sortOrder: row.sort_order,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toVariant(row: VariantRow): BoutiqueVariantRecord {
    const options = isVariantOptions(row.options) ? row.options : [];
    const stockOnHand = Number(row.stock_on_hand);
    const reservedQuantity = Number(row.reserved_quantity);
    return {
      id: row.id,
      menuItemId: row.menu_item_id,
      sku: row.sku,
      options: cloneOptions(options),
      price: Number(row.price),
      currency: row.currency,
      active: row.active,
      stockOnHand,
      reservedQuantity,
      availableQuantity: stockOnHand - reservedQuantity,
      sortOrder: row.sort_order,
      createdAt: this.toIsoString(row.created_at),
      updatedAt: this.toIsoString(row.updated_at),
    };
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

export const BoutiqueRepositoryToken = BOUTIQUE_REPOSITORY;
