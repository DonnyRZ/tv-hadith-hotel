import { HttpStatus, Inject, Injectable, Optional } from '@nestjs/common';

import { ApiException } from '../auth/api-exception';
import { MenuItemNameConflictError } from '../menu/menu.repository';
import type { LocalizedText } from '../menu/menu.types';
import { StaffRealtimePublisher } from '../realtime/staff-realtime.publisher';
import type {
  CreateBoutiqueCategoryDto,
  UpdateBoutiqueCategoryDto,
} from './dto/create-category.dto';
import type { CreateBoutiqueProductDto, UpdateBoutiqueProductDto } from './dto/create-product.dto';
import type { CreateBoutiqueVariantDto, UpdateBoutiqueVariantDto } from './dto/variant.dto';
import type { ListBoutiqueDto } from './dto/list-boutique.dto';
import type { StockAdjustmentDto } from './dto/stock-adjustment.dto';
import {
  BoutiqueCategoryNameConflictError,
  BoutiqueRepositoryToken,
  BoutiqueReservationIdempotencyConflictError,
  BoutiqueReservedStockConflictError,
  BoutiqueResourceNotFoundError,
  BoutiqueSkuConflictError,
  BoutiqueStockUnavailableError,
} from './boutique.repository';
import type { BoutiqueRepository } from './boutique.repository';
import type {
  BoutiqueCategoryRecord,
  BoutiqueGuestProduct,
  BoutiqueProductRecord,
  BoutiqueVariantOption,
  BoutiqueVariantRecord,
  CreateBoutiqueCategoryInput,
  CreateBoutiqueProductInput,
  StockReservationLine,
} from './boutique.types';

const DEFAULT_LOW_STOCK_THRESHOLD = 3;

@Injectable()
export class BoutiqueService {
  public constructor(
    @Inject(BoutiqueRepositoryToken) private readonly repository: BoutiqueRepository,
    @Optional() private readonly realtimePublisher?: StaffRealtimePublisher,
  ) {}

  public async listCategories(
    includeInactive = false,
  ): Promise<{ items: BoutiqueCategoryRecord[] }> {
    return { items: await this.repository.listCategories(includeInactive) };
  }

  public async createCategory(input: CreateBoutiqueCategoryDto): Promise<BoutiqueCategoryRecord> {
    const record: CreateBoutiqueCategoryInput = {
      localizedName: this.localized(input.localizedName, 'localizedName'),
      localizedDescription:
        input.localizedDescription === undefined || input.localizedDescription === null
          ? null
          : this.localized(input.localizedDescription, 'localizedDescription'),
      imageMediaId: input.imageMediaId ?? null,
      sortOrder: input.sortOrder ?? 0,
    };
    try {
      const created = await this.repository.createCategory(record);
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'category',
        'created',
        created.id,
        created.updatedAt,
      );
      return created;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async updateCategory(
    id: string,
    input: UpdateBoutiqueCategoryDto,
  ): Promise<BoutiqueCategoryRecord> {
    if (Object.keys(input).length === 0) {
      throw this.badRequest(
        'BOUTIQUE_CATEGORY_UPDATE_EMPTY',
        'At least one category field is required.',
      );
    }
    try {
      const updated = await this.repository.updateCategory(id, {
        ...(input.localizedName === undefined
          ? {}
          : { localizedName: this.localized(input.localizedName, 'localizedName') }),
        ...(input.localizedDescription === undefined
          ? {}
          : {
              localizedDescription:
                input.localizedDescription === null
                  ? null
                  : this.localized(input.localizedDescription, 'localizedDescription'),
            }),
        ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      });
      if (updated === null)
        throw this.notFound(
          'BOUTIQUE_CATEGORY_NOT_FOUND',
          'The Butik Indonesia category does not exist.',
        );
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'category',
        'updated',
        updated.id,
        updated.updatedAt,
      );
      return updated;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async setCategoryActive(id: string, active: boolean): Promise<BoutiqueCategoryRecord> {
    const updated = await this.repository.setCategoryActive(id, active);
    if (updated === null)
      throw this.notFound(
        'BOUTIQUE_CATEGORY_NOT_FOUND',
        'The Butik Indonesia category does not exist.',
      );
    this.realtimePublisher?.publishBoutiqueCatalogUpdated(
      'category',
      active ? 'activated' : 'deactivated',
      updated.id,
      updated.updatedAt,
    );
    return updated;
  }

  public async listProducts(query: ListBoutiqueDto): Promise<{
    items: BoutiqueProductRecord[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 100;
    const result = await this.repository.listProducts({
      includeInactive: query.includeInactive ?? false,
      ...(query.categoryId === undefined ? {} : { categoryId: query.categoryId }),
      page,
      pageSize,
    });
    return { ...result, page, pageSize };
  }

  public async listGuestProducts(query: ListBoutiqueDto = {}): Promise<{
    items: BoutiqueGuestProduct[];
    categories: BoutiqueCategoryRecord[];
    page: number;
    pageSize: number;
    total: number;
  }> {
    const result = await this.listProducts({ ...query, includeInactive: false });
    const categories = await this.repository.listCategories(false);
    return {
      ...result,
      categories,
      items: result.items
        .filter((product) => product.item.active && product.category.active)
        .map((product) => this.toGuestProduct(product)),
    };
  }

  public async getProduct(
    menuItemId: string,
    includeInactive = true,
  ): Promise<BoutiqueProductRecord> {
    const product = await this.repository.findProductByMenuItemId(menuItemId);
    if (
      product === null ||
      (!includeInactive && (!product.item.active || !product.category.active))
    ) {
      throw this.notFound(
        'BOUTIQUE_PRODUCT_NOT_FOUND',
        'The Butik Indonesia product does not exist.',
      );
    }
    return product;
  }

  public async getGuestProduct(menuItemId: string): Promise<BoutiqueGuestProduct> {
    const product = await this.getProduct(menuItemId, false);
    return this.toGuestProduct(product);
  }

  public async createProduct(input: CreateBoutiqueProductDto): Promise<BoutiqueProductRecord> {
    if (input.variants.length === 0) {
      throw this.badRequest(
        'BOUTIQUE_VARIANT_REQUIRED',
        'A Butik Indonesia product requires at least one variant.',
      );
    }
    const variants = input.variants.map((variant, index) => this.toCreateVariant(variant, index));
    this.assertUniqueVariants(variants);
    this.assertOneCurrency(variants.map((variant) => variant.currency));
    const record: CreateBoutiqueProductInput = {
      localizedName: this.localized(input.localizedName, 'localizedName'),
      localizedDescription:
        input.localizedDescription === undefined || input.localizedDescription === null
          ? null
          : this.localized(input.localizedDescription, 'localizedDescription'),
      categoryId: input.categoryId,
      imageMediaId: input.imageMediaId ?? null,
      available: input.available ?? true,
      sortOrder: input.sortOrder ?? 0,
      variants,
    };
    try {
      const created = await this.repository.createProduct(record);
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'product',
        'created',
        created.item.id,
        created.item.updatedAt,
      );
      return created;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async updateProduct(
    menuItemId: string,
    input: UpdateBoutiqueProductDto,
  ): Promise<BoutiqueProductRecord> {
    if (Object.keys(input).length === 0) {
      throw this.badRequest(
        'BOUTIQUE_PRODUCT_UPDATE_EMPTY',
        'At least one product field is required.',
      );
    }
    try {
      const updated = await this.repository.updateProduct(menuItemId, {
        ...(input.localizedName === undefined
          ? {}
          : { localizedName: this.localized(input.localizedName, 'localizedName') }),
        ...(input.localizedDescription === undefined
          ? {}
          : {
              localizedDescription:
                input.localizedDescription === null
                  ? null
                  : this.localized(input.localizedDescription, 'localizedDescription'),
            }),
        ...(input.categoryId === undefined ? {} : { categoryId: input.categoryId }),
        ...(input.imageMediaId === undefined ? {} : { imageMediaId: input.imageMediaId }),
        ...(input.available === undefined ? {} : { available: input.available }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      });
      if (updated === null)
        throw this.notFound(
          'BOUTIQUE_PRODUCT_NOT_FOUND',
          'The Butik Indonesia product does not exist.',
        );
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'product',
        'updated',
        updated.item.id,
        updated.item.updatedAt,
      );
      return updated;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async setProductActive(
    menuItemId: string,
    active: boolean,
  ): Promise<BoutiqueProductRecord> {
    const updated = await this.repository.setProductActive(menuItemId, active);
    if (updated === null)
      throw this.notFound(
        'BOUTIQUE_PRODUCT_NOT_FOUND',
        'The Butik Indonesia product does not exist.',
      );
    this.realtimePublisher?.publishBoutiqueCatalogUpdated(
      'product',
      active ? 'activated' : 'deactivated',
      updated.item.id,
      updated.item.updatedAt,
    );
    return updated;
  }

  public async createVariant(
    menuItemId: string,
    input: CreateBoutiqueVariantDto,
  ): Promise<BoutiqueVariantRecord> {
    const product = await this.getProduct(menuItemId);
    const variant = this.toCreateVariant(input, product.variants.length);
    this.assertOneCurrency([
      ...product.variants.map((candidate) => candidate.currency),
      variant.currency,
    ]);
    try {
      const created = await this.repository.createVariant({ ...variant, menuItemId });
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'variant',
        'created',
        created.id,
        created.updatedAt,
      );
      return created;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async updateVariant(
    variantId: string,
    input: UpdateBoutiqueVariantDto,
  ): Promise<BoutiqueVariantRecord> {
    if (Object.keys(input).length === 0) {
      throw this.badRequest(
        'BOUTIQUE_VARIANT_UPDATE_EMPTY',
        'At least one variant field is required.',
      );
    }
    const existing = await this.findVariant(variantId);
    const nextCurrency = input.currency?.trim().toUpperCase() ?? existing.currency;
    const product = await this.getProduct(existing.menuItemId);
    this.assertOneCurrency(
      product.variants.map((variant) =>
        variant.id === variantId ? nextCurrency : variant.currency,
      ),
    );
    try {
      const updated = await this.repository.updateVariant(variantId, {
        ...(input.sku === undefined ? {} : { sku: input.sku.trim() }),
        ...(input.options === undefined ? {} : { options: this.options(input.options) }),
        ...(input.price === undefined ? {} : { price: input.price }),
        ...(input.currency === undefined ? {} : { currency: nextCurrency }),
        ...(input.sortOrder === undefined ? {} : { sortOrder: input.sortOrder }),
      });
      if (updated === null)
        throw this.notFound(
          'BOUTIQUE_VARIANT_NOT_FOUND',
          'The Butik Indonesia variant does not exist.',
        );
      this.realtimePublisher?.publishBoutiqueCatalogUpdated(
        'variant',
        'updated',
        updated.id,
        updated.updatedAt,
      );
      return updated;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async setVariantActive(
    variantId: string,
    active: boolean,
  ): Promise<BoutiqueVariantRecord> {
    const updated = await this.repository.setVariantActive(variantId, active);
    if (updated === null)
      throw this.notFound(
        'BOUTIQUE_VARIANT_NOT_FOUND',
        'The Butik Indonesia variant does not exist.',
      );
    this.realtimePublisher?.publishBoutiqueCatalogUpdated(
      'variant',
      active ? 'activated' : 'deactivated',
      updated.id,
      updated.updatedAt,
    );
    return updated;
  }

  public async adjustStock(
    variantId: string,
    staffId: string,
    input: StockAdjustmentDto,
  ): Promise<BoutiqueVariantRecord> {
    if (input.delta === 0) {
      throw this.badRequest('BOUTIQUE_STOCK_DELTA_ZERO', 'Stock adjustment cannot be zero.');
    }
    const reason = input.reason.trim();
    if (reason.length < 3) {
      throw this.badRequest(
        'BOUTIQUE_STOCK_REASON_REQUIRED',
        'A stock adjustment reason is required.',
      );
    }
    try {
      const updated = await this.repository.adjustStock({
        variantId,
        delta: input.delta,
        reason,
        actorId: staffId,
      });
      this.realtimePublisher?.publishBoutiqueInventoryUpdated(updated.id, updated.updatedAt);
      return updated;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async listStockMovements(variantId: string, limit = 50) {
    await this.findVariant(variantId);
    return {
      items: await this.repository.listStockMovements(variantId, Math.min(100, Math.max(1, limit))),
    };
  }

  public async getVariantForProduct(
    menuItemId: string,
    variantId: string,
  ): Promise<BoutiqueVariantRecord> {
    const product = await this.getProduct(menuItemId);
    const variant = product.variants.find((candidate) => candidate.id === variantId);
    if (variant === undefined)
      throw this.notFound(
        'BOUTIQUE_VARIANT_NOT_FOUND',
        'The Butik Indonesia variant does not exist.',
      );
    return variant;
  }

  public async hasPublishedProducts(): Promise<boolean> {
    return this.repository.hasPublishedProducts();
  }

  public async listLowStock(
    threshold = DEFAULT_LOW_STOCK_THRESHOLD,
  ): Promise<BoutiqueVariantRecord[]> {
    return this.repository.listLowStock(threshold);
  }

  public async reserveStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<boolean> {
    try {
      const changed = await this.repository.reserveStock(lines, requestId);
      if (changed) this.publishInventoryForLines(lines);
      return changed;
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async releaseStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    try {
      await this.repository.releaseStock(lines, requestId);
      this.publishInventoryForLines(lines);
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  public async fulfillStock(
    lines: readonly StockReservationLine[],
    requestId?: string,
  ): Promise<void> {
    try {
      await this.repository.fulfillStock(lines, requestId);
      this.publishInventoryForLines(lines);
    } catch (error) {
      this.mapRepositoryError(error);
      throw error;
    }
  }

  private async findVariant(variantId: string): Promise<BoutiqueVariantRecord> {
    const products = await this.repository.listProducts({
      includeInactive: true,
      page: 1,
      pageSize: 10000,
    });
    const variant = products.items
      .flatMap((product) => product.variants)
      .find((candidate) => candidate.id === variantId);
    if (variant === undefined)
      throw this.notFound(
        'BOUTIQUE_VARIANT_NOT_FOUND',
        'The Butik Indonesia variant does not exist.',
      );
    return variant;
  }

  private publishInventoryForLines(lines: readonly StockReservationLine[]): void {
    const updatedAt = new Date().toISOString();
    for (const line of lines) {
      this.realtimePublisher?.publishBoutiqueInventoryUpdated(line.variantId, updatedAt);
    }
  }

  private toGuestProduct(product: BoutiqueProductRecord): BoutiqueGuestProduct {
    return {
      ...product.item,
      categoryId: product.categoryId,
      category: {
        ...product.category,
        localizedName: { ...product.category.localizedName },
        localizedDescription:
          product.category.localizedDescription === null
            ? null
            : { ...product.category.localizedDescription },
      },
      available:
        product.item.available &&
        product.variants.some((variant) => variant.active && variant.availableQuantity > 0),
      variants: product.variants
        .filter((variant) => variant.active)
        .map((variant) => ({
          id: variant.id,
          menuItemId: variant.menuItemId,
          sku: variant.sku,
          options: variant.options.map((option) => ({
            code: option.code,
            label: { ...option.label },
            value: { ...option.value },
          })),
          price: variant.price,
          currency: variant.currency,
          active: variant.active,
          availableQuantity: variant.availableQuantity,
          sortOrder: variant.sortOrder,
        })),
    };
  }

  private toCreateVariant(input: CreateBoutiqueVariantDto, index: number) {
    const sku = input.sku.trim();
    if (sku.length === 0) {
      throw this.badRequest(
        'BOUTIQUE_VARIANT_SKU_REQUIRED',
        'A Butik Indonesia variant SKU is required.',
      );
    }
    return {
      sku,
      options: this.options(input.options),
      price: input.price,
      currency: input.currency.trim().toUpperCase(),
      stockOnHand: input.stockOnHand,
      sortOrder: input.sortOrder ?? index,
    };
  }

  private assertUniqueVariants(
    variants: ReadonlyArray<{
      sku: string;
      options: BoutiqueVariantOption[];
    }>,
  ): void {
    const skus = new Set<string>();
    const optionFingerprints = new Set<string>();
    for (const variant of variants) {
      const sku = variant.sku.toLocaleLowerCase('en-US');
      if (skus.has(sku)) {
        throw this.badRequest(
          'BOUTIQUE_VARIANT_CONFLICT',
          'Variant SKUs must be unique within a product submission.',
        );
      }
      skus.add(sku);
      const fingerprint = JSON.stringify(
        [...variant.options]
          .sort((left, right) => left.code.localeCompare(right.code))
          .map((option) => [option.code, option.value.uz, option.value.ru, option.value.en]),
      );
      if (optionFingerprints.has(fingerprint)) {
        throw this.badRequest(
          'BOUTIQUE_VARIANT_CONFLICT',
          'Variant option combinations must be unique within a product submission.',
        );
      }
      optionFingerprints.add(fingerprint);
    }
  }

  private options(
    value: readonly {
      code: string;
      label: BoutiqueLocalizedTextLike;
      value: BoutiqueLocalizedTextLike;
    }[],
  ): BoutiqueVariantOption[] {
    const options = value.map((option) => ({
      code: option.code.trim().toLowerCase(),
      label: this.localized(option.label, 'options.label'),
      value: this.localized(option.value, 'options.value'),
    }));
    const codes = new Set<string>();
    for (const option of options) {
      if (codes.has(option.code)) {
        throw this.badRequest(
          'BOUTIQUE_VARIANT_OPTION_DUPLICATE',
          'Variant option codes must be unique.',
        );
      }
      codes.add(option.code);
    }
    return options.sort((left, right) => left.code.localeCompare(right.code));
  }

  private localized(value: BoutiqueLocalizedTextLike, field: string): LocalizedText {
    const localized = {
      uz: value.uz.trim(),
      ru: value.ru.trim(),
      en: value.en.trim(),
    };
    const emptyLanguage = (['uz', 'ru', 'en'] as const).find(
      (language) => localized[language].length === 0,
    );
    if (emptyLanguage !== undefined) {
      throw this.badRequest(
        'BOUTIQUE_LOCALIZATION_INCOMPLETE',
        'Every Butik Indonesia localized field requires Uzbek, Russian, and English text.',
        [{ field: `${field}.${emptyLanguage}`, message: 'Localized text cannot be blank.' }],
      );
    }
    return localized;
  }

  private assertOneCurrency(currencies: readonly string[]): void {
    const unique = new Set(currencies.map((currency) => currency.trim().toUpperCase()));
    if (unique.size > 1) {
      throw this.badRequest(
        'BOUTIQUE_CURRENCY_MISMATCH',
        'All variants of one product must use the same currency.',
      );
    }
  }

  private mapRepositoryError(error: unknown): void {
    if (error instanceof BoutiqueResourceNotFoundError) {
      throw new ApiException(HttpStatus.NOT_FOUND, {
        code: 'BOUTIQUE_RESOURCE_NOT_FOUND',
        message: error.message,
      });
    }
    if (error instanceof MenuItemNameConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_PRODUCT_NAME_CONFLICT',
        message: 'A Butik Indonesia product with this name already exists.',
      });
    }
    if (error instanceof BoutiqueCategoryNameConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_CATEGORY_NAME_CONFLICT',
        message: 'A Butik Indonesia category with this name already exists.',
      });
    }
    if (error instanceof BoutiqueSkuConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_VARIANT_CONFLICT',
        message: 'A Butik Indonesia variant with this SKU or option combination already exists.',
      });
    }
    if (error instanceof BoutiqueStockUnavailableError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_STOCK_UNAVAILABLE',
        message: 'One or more Butik Indonesia variants do not have enough stock.',
        details: [{ field: 'items', message: `Variant ${error.variantId} is unavailable.` }],
      });
    }
    if (error instanceof BoutiqueReservedStockConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_RESERVED_STOCK_CONFLICT',
        message: 'Stock cannot be reduced below the quantity already reserved.',
      });
    }
    if (error instanceof BoutiqueReservationIdempotencyConflictError) {
      throw new ApiException(HttpStatus.CONFLICT, {
        code: 'BOUTIQUE_RESERVATION_IDEMPOTENCY_CONFLICT',
        message: 'This client request ID is already associated with a different stock reservation.',
      });
    }
  }

  private badRequest(
    code: string,
    message: string,
    details?: Array<{ field: string; message: string }>,
  ): ApiException {
    return new ApiException(HttpStatus.BAD_REQUEST, {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    });
  }

  private notFound(code: string, message: string): ApiException {
    return new ApiException(HttpStatus.NOT_FOUND, { code, message });
  }
}

interface BoutiqueLocalizedTextLike {
  uz: string;
  ru: string;
  en: string;
}
