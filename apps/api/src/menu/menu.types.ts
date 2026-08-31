import type { UnitCode } from '../rbac/rbac.types';

export type MenuItemKind = 'PRODUCT' | 'SERVICE';

export const MENU_LANGUAGES = ['uz', 'ru', 'en'] as const;
export type MenuLanguage = (typeof MENU_LANGUAGES)[number];

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export interface MenuItemRecord {
  id: string;
  unit: UnitCode;
  kind: MenuItemKind;
  name: string;
  localizedName: LocalizedText;
  description: string | null;
  localizedDescription: LocalizedText | null;
  price: number | null;
  currency: string | null;
  durationMinutes: number | null;
  imageMediaId: string | null;
  active: boolean;
  available: boolean;
  quantityAllowed: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type MenuItemResponse = MenuItemRecord;

export interface MenuItemListFilter {
  units: readonly UnitCode[];
  includeInactive: boolean;
  availableOnly?: boolean;
  page: number;
  pageSize: number;
}

export interface MenuItemListResult {
  items: MenuItemRecord[];
  total: number;
}

export interface CreateMenuItemRecordInput {
  unit: UnitCode;
  kind: MenuItemKind;
  localizedName: LocalizedText;
  localizedDescription: LocalizedText | null;
  price: number | null;
  currency: string | null;
  durationMinutes: number | null;
  imageMediaId: string | null;
  available: boolean;
  quantityAllowed: boolean;
  sortOrder: number;
}

export interface UpdateMenuItemRecordInput {
  localizedName?: LocalizedText;
  localizedDescription?: LocalizedText | null;
  price?: number | null;
  currency?: string | null;
  durationMinutes?: number | null;
  imageMediaId?: string | null;
  available?: boolean;
  quantityAllowed?: boolean;
  sortOrder?: number;
  active?: boolean;
}
