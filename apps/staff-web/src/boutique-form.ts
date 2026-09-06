import type { BoutiqueVariantOption, LocalizedText } from './management-api';

export interface BoutiqueTextDraft {
  value: string;
  original: LocalizedText | null;
  dirty: boolean;
}

export interface VariantOptionDraft {
  id: string;
  code: string;
  label: string;
  value: string;
}

export interface VariantDraft {
  sku: string;
  price: string;
  currency: string;
  stock: string;
  options: VariantOptionDraft[];
}

export function textDraftFromLocalized(value: LocalizedText | null | undefined): BoutiqueTextDraft {
  const original = value === null || value === undefined ? null : { ...value };
  return {
    value: firstLocalizedValue(value),
    original,
    dirty: false,
  };
}

export function updateTextDraft(draft: BoutiqueTextDraft, value: string): BoutiqueTextDraft {
  return { ...draft, value, dirty: true };
}

export function serializeTextDraft(
  draft: BoutiqueTextDraft,
  options: { required?: boolean } = {},
): LocalizedText | null {
  if (!draft.dirty && draft.original !== null) return { ...draft.original };
  const value = draft.value.trim();
  if (value.length === 0 && options.required !== true) return null;
  return { uz: value, ru: value, en: value };
}

export function firstLocalizedValue(value: LocalizedText | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value.en || value.ru || value.uz;
}

export function newVariantOption(index = 0): VariantOptionDraft {
  return {
    id: `option-${Date.now()}-${index}`,
    code: '',
    label: '',
    value: '',
  };
}

export function variantOptionsFromApi(
  options: readonly BoutiqueVariantOption[] | null | undefined,
): VariantOptionDraft[] {
  return (options ?? []).map((option, index) => ({
    id: `option-${option.code}-${index}`,
    code: option.code,
    label: firstLocalizedValue(option.label),
    value: firstLocalizedValue(option.value),
  }));
}

export function variantOptionsToApi(
  options: readonly VariantOptionDraft[],
): BoutiqueVariantOption[] {
  const usedCodes = new Set<string>();
  return options.map((option, index) => {
    const baseCode = sanitizeOptionCode(option.label);
    const code = uniqueOptionCode(baseCode || `option-${index + 1}`, usedCodes);
    usedCodes.add(code);
    return {
      code,
      label: sameText(option.label),
      value: sameText(option.value),
    };
  });
}

export function validateVariantDraft(
  draft: VariantDraft,
  messages: {
    sku: string;
    duplicateSku: string;
    price: string;
    stock: string;
    optionName: string;
    optionValue: string;
    duplicateOption: string;
  },
  options: { editing?: boolean; existingSkus?: readonly string[] } = {},
): string | null {
  if (draft.sku.trim().length === 0) return messages.sku;
  const normalizedSku = draft.sku.trim().toLocaleLowerCase();
  if (
    options.existingSkus?.some((sku) => sku.trim().toLocaleLowerCase() === normalizedSku) === true
  ) {
    return messages.duplicateSku;
  }
  if (draft.price.trim().length === 0) return messages.price;
  const price = Number(draft.price);
  if (!Number.isFinite(price) || price < 0) return messages.price;
  if (
    !options.editing &&
    (draft.stock.trim().length === 0 ||
      !Number.isInteger(Number(draft.stock)) ||
      Number(draft.stock) < 0)
  ) {
    return messages.stock;
  }

  const usedLabels = new Set<string>();
  for (const option of draft.options) {
    const label = option.label.trim();
    if (label.length === 0) return messages.optionName;
    if (option.value.trim().length === 0) return messages.optionValue;
    const normalized = label.toLocaleLowerCase();
    if (usedLabels.has(normalized)) return messages.duplicateOption;
    usedLabels.add(normalized);
  }
  return null;
}

function sameText(value: string): LocalizedText {
  const text = value.trim();
  return { uz: text, ru: text, en: text };
}

function sanitizeOptionCode(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function uniqueOptionCode(baseCode: string, usedCodes: Set<string>): string {
  if (!usedCodes.has(baseCode)) return baseCode;
  let suffix = 2;
  while (usedCodes.has(withSuffix(baseCode, suffix))) suffix += 1;
  return withSuffix(baseCode, suffix);
}

function withSuffix(value: string, suffix: number): string {
  const suffixText = `-${suffix}`;
  return `${value.slice(0, 50 - suffixText.length)}${suffixText}`;
}
