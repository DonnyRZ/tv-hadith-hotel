import { describe, expect, it } from 'vitest';

import {
  serializeTextDraft,
  textDraftFromLocalized,
  updateTextDraft,
  validateVariantDraft,
  variantOptionsFromApi,
  variantOptionsToApi,
  type VariantDraft,
} from './boutique-form';

const messages = {
  sku: 'sku required',
  duplicateSku: 'duplicate sku',
  price: 'price invalid',
  stock: 'stock invalid',
  optionName: 'option name required',
  optionValue: 'option value required',
  duplicateOption: 'duplicate option',
};

describe('Butik CMS form helpers', () => {
  it('keeps one staff text identical in all API language slots', () => {
    const draft = updateTextDraft(textDraftFromLocalized(null), ' Nasi Goreng ');

    expect(serializeTextDraft(draft, { required: true })).toEqual({
      uz: 'Nasi Goreng',
      ru: 'Nasi Goreng',
      en: 'Nasi Goreng',
    });
  });

  it('preserves existing translations until an existing field is edited', () => {
    const original = { uz: 'Palov', ru: 'Плов', en: 'Pilaf' };
    const untouched = textDraftFromLocalized(original);
    const edited = updateTextDraft(untouched, 'Nasi Goreng');

    expect(serializeTextDraft(untouched, { required: true })).toEqual(original);
    expect(serializeTextDraft(edited, { required: true })).toEqual({
      uz: 'Nasi Goreng',
      ru: 'Nasi Goreng',
      en: 'Nasi Goreng',
    });
  });

  it('serializes visual option rows without exposing JSON to staff', () => {
    const options = variantOptionsToApi([
      { id: '1', code: '', label: 'Размер', value: 'M' },
      { id: '2', code: '', label: 'Color', value: 'Black' },
    ]);

    expect(options).toEqual([
      {
        code: 'option-1',
        label: { uz: 'Размер', ru: 'Размер', en: 'Размер' },
        value: { uz: 'M', ru: 'M', en: 'M' },
      },
      {
        code: 'color',
        label: { uz: 'Color', ru: 'Color', en: 'Color' },
        value: { uz: 'Black', ru: 'Black', en: 'Black' },
      },
    ]);
  });

  it('reads existing option rows as normal text fields', () => {
    expect(
      variantOptionsFromApi([
        {
          code: 'size',
          label: { uz: 'Ukuran', ru: 'Размер', en: 'Size' },
          value: { uz: 'M', ru: 'M', en: 'M' },
        },
      ]),
    ).toMatchObject([{ code: 'size', label: 'Size', value: 'M' }]);
  });

  it('validates structured variant fields and duplicate option names', () => {
    const draft: VariantDraft = {
      sku: 'BI-001',
      price: '150000',
      currency: 'UZS',
      stock: '4',
      options: [
        { id: '1', code: '', label: 'Color', value: 'Black' },
        { id: '2', code: '', label: 'color', value: 'White' },
      ],
    };

    expect(validateVariantDraft(draft, messages)).toBe('duplicate option');
    expect(validateVariantDraft({ ...draft, options: [] }, messages)).toBeNull();
  });

  it('rejects a SKU already used by another variant', () => {
    const draft: VariantDraft = {
      sku: ' BI-001 ',
      price: '150000',
      currency: 'UZS',
      stock: '4',
      options: [],
    };

    expect(validateVariantDraft(draft, messages, { existingSkus: ['bi-001'] })).toBe(
      'duplicate sku',
    );
    expect(validateVariantDraft(draft, messages, { existingSkus: ['bi-001'], editing: true })).toBe(
      'duplicate sku',
    );
    expect(validateVariantDraft(draft, messages, { existingSkus: ['BI-002'] })).toBeNull();
  });

  it('rejects empty numeric fields instead of coercing them to zero', () => {
    const draft: VariantDraft = {
      sku: 'BI-002',
      price: '',
      currency: 'UZS',
      stock: '',
      options: [],
    };

    expect(validateVariantDraft(draft, messages)).toBe('price invalid');
    expect(validateVariantDraft({ ...draft, price: '10' }, messages)).toBe('stock invalid');
  });
});
