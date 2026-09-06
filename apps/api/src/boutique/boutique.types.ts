import type { LocalizedText, MenuItemRecord } from '../menu/menu.types';

export interface BoutiqueVariantOption {
  code: string;
  label: LocalizedText;
  value: LocalizedText;
}

export interface BoutiqueCategoryRecord {
  id: string;
  localizedName: LocalizedText;
  localizedDescription: LocalizedText | null;
  imageMediaId: string | null;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoutiqueVariantRecord {
  id: string;
  menuItemId: string;
  sku: string;
  options: BoutiqueVariantOption[];
  price: number;
  currency: string;
  active: boolean;
  stockOnHand: number;
  reservedQuantity: number;
  availableQuantity: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface BoutiqueProductRecord {
  item: MenuItemRecord;
  categoryId: string;
  category: BoutiqueCategoryRecord;
  variants: BoutiqueVariantRecord[];
}

export interface BoutiqueGuestProduct extends MenuItemRecord {
  categoryId: string;
  category: BoutiqueCategoryRecord;
  variants: Array<
    Pick<
      BoutiqueVariantRecord,
      | 'id'
      | 'menuItemId'
      | 'sku'
      | 'options'
      | 'price'
      | 'currency'
      | 'active'
      | 'availableQuantity'
      | 'sortOrder'
    >
  >;
}

export interface BoutiqueProductListFilter {
  includeInactive: boolean;
  categoryId?: string;
  page: number;
  pageSize: number;
}

export interface CreateBoutiqueCategoryInput {
  localizedName: LocalizedText;
  localizedDescription: LocalizedText | null;
  imageMediaId: string | null;
  sortOrder: number;
}

export interface UpdateBoutiqueCategoryInput {
  localizedName?: LocalizedText;
  localizedDescription?: LocalizedText | null;
  imageMediaId?: string | null;
  sortOrder?: number;
}

export interface CreateBoutiqueProductInput {
  localizedName: LocalizedText;
  localizedDescription: LocalizedText | null;
  categoryId: string;
  imageMediaId: string | null;
  available: boolean;
  sortOrder: number;
  variants: Array<{
    sku: string;
    options: BoutiqueVariantOption[];
    price: number;
    currency: string;
    stockOnHand: number;
    sortOrder: number;
  }>;
}

export interface UpdateBoutiqueProductInput {
  localizedName?: LocalizedText;
  localizedDescription?: LocalizedText | null;
  categoryId?: string;
  imageMediaId?: string | null;
  available?: boolean;
  sortOrder?: number;
}

export interface CreateBoutiqueVariantInput {
  menuItemId: string;
  sku: string;
  options: BoutiqueVariantOption[];
  price: number;
  currency: string;
  stockOnHand: number;
  sortOrder: number;
}

export interface UpdateBoutiqueVariantInput {
  sku?: string;
  options?: BoutiqueVariantOption[];
  price?: number;
  currency?: string;
  sortOrder?: number;
}

export interface StockAdjustmentInput {
  variantId: string;
  delta: number;
  reason: string;
  actorId: string;
}

export interface StockReservationLine {
  variantId: string;
  quantity: number;
}

export type StockMovementType = 'ADJUSTMENT' | 'RESERVE' | 'RELEASE' | 'FULFILL';

export interface StockMovementRecord {
  id: string;
  variantId: string;
  type: StockMovementType;
  quantity: number;
  reason: string;
  requestId: string | null;
  actorId: string | null;
  createdAt: string;
}
