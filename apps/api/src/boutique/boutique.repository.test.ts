import { describe, expect, it } from 'vitest';

import { InMemoryMenuRepository } from '../menu/menu.repository';
import type { LocalizedText } from '../menu/menu.types';
import {
  BoutiqueResourceNotFoundError,
  BoutiqueStockUnavailableError,
  InMemoryBoutiqueRepository,
} from './boutique.repository';
import type { BoutiqueVariantOption } from './boutique.types';

const localized = (value: string): LocalizedText => ({
  uz: value,
  ru: value,
  en: value,
});

const options: BoutiqueVariantOption[] = [
  {
    code: 'size',
    label: localized('Size'),
    value: localized('One size'),
  },
];

async function createProduct(
  repository: InMemoryBoutiqueRepository,
  name: string,
  sku: string,
  stockOnHand: number,
) {
  const categories = await repository.listCategories(true);
  const category =
    categories[0] ??
    (await repository.createCategory({
      localizedName: localized('Accessories'),
      localizedDescription: localized('Accessories'),
      imageMediaId: null,
      sortOrder: 0,
    }));

  const product = await repository.createProduct({
    localizedName: localized(name),
    localizedDescription: localized(`${name} description`),
    categoryId: category.id,
    imageMediaId: null,
    available: true,
    sortOrder: 0,
    variants: [
      {
        sku,
        options,
        price: 100,
        currency: 'UZS',
        stockOnHand,
        sortOrder: 0,
      },
    ],
  });
  const variant = product.variants[0];
  if (variant === undefined) throw new Error('Test product did not create a variant.');
  return variant;
}

describe('InMemoryBoutiqueRepository stock ledger', () => {
  it('rejects a multi-line reservation without partially reserving stock', async () => {
    const repository = new InMemoryBoutiqueRepository(new InMemoryMenuRepository());
    const available = await createProduct(repository, 'Available scarf', 'SCARF-1', 2);
    const unavailable = await createProduct(repository, 'Unavailable bag', 'BAG-1', 0);

    await expect(
      repository.reserveStock([
        { variantId: available.id, quantity: 1 },
        { variantId: unavailable.id, quantity: 1 },
      ]),
    ).rejects.toBeInstanceOf(BoutiqueStockUnavailableError);

    const product = await repository.findProductByMenuItemId(available.menuItemId);
    expect(product?.variants[0]?.reservedQuantity).toBe(0);
  });

  it('allows only one concurrent reservation when one unit remains', async () => {
    const repository = new InMemoryBoutiqueRepository(new InMemoryMenuRepository());
    const variant = await createProduct(repository, 'Limited batik', 'BATIK-1', 1);

    const results = await Promise.allSettled([
      repository.reserveStock([{ variantId: variant.id, quantity: 1 }], 'request-a'),
      repository.reserveStock([{ variantId: variant.id, quantity: 1 }], 'request-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const product = await repository.findProductByMenuItemId(variant.menuItemId);
    expect(product?.variants[0]).toMatchObject({
      stockOnHand: 1,
      reservedQuantity: 1,
      availableQuantity: 0,
    });
  });

  it('treats a repeated reservation with the same request ID as an idempotent retry', async () => {
    const repository = new InMemoryBoutiqueRepository(new InMemoryMenuRepository());
    const variant = await createProduct(repository, 'Idempotent batik', 'BATIK-IDEMPOTENT', 1);

    const results = await Promise.all([
      repository.reserveStock([{ variantId: variant.id, quantity: 1 }], 'request-idempotent'),
      repository.reserveStock([{ variantId: variant.id, quantity: 1 }], 'request-idempotent'),
    ]);

    expect(results.sort()).toEqual([false, true]);
    const product = await repository.findProductByMenuItemId(variant.menuItemId);
    expect(product?.variants[0]).toMatchObject({ reservedQuantity: 1, availableQuantity: 0 });

    await expect(
      repository.reserveStock([{ variantId: variant.id, quantity: 2 }], 'request-idempotent'),
    ).rejects.toThrow('different stock reservation');
  });

  it('releases all lines atomically and records completion movements', async () => {
    const repository = new InMemoryBoutiqueRepository(new InMemoryMenuRepository());
    const first = await createProduct(repository, 'First textile', 'TEXTILE-1', 1);
    const second = await createProduct(repository, 'Second textile', 'TEXTILE-2', 1);

    await repository.reserveStock(
      [
        { variantId: first.id, quantity: 1 },
        { variantId: second.id, quantity: 1 },
      ],
      'request-c',
    );
    await expect(
      repository.releaseStock(
        [
          { variantId: first.id, quantity: 1 },
          { variantId: 'missing-variant', quantity: 1 },
        ],
        'request-c',
      ),
    ).rejects.toBeInstanceOf(BoutiqueResourceNotFoundError);

    const firstAfterFailedRelease = await repository.findProductByMenuItemId(first.menuItemId);
    expect(firstAfterFailedRelease?.variants[0]?.reservedQuantity).toBe(1);

    await repository.fulfillStock(
      [
        { variantId: first.id, quantity: 1 },
        { variantId: second.id, quantity: 1 },
      ],
      'request-c',
    );
    const movements = await repository.listStockMovements(first.id, 10);
    expect(movements.map((movement) => movement.type)).toEqual(['FULFILL', 'RESERVE']);
    const completed = await repository.findProductByMenuItemId(first.menuItemId);
    expect(completed?.variants[0]).toMatchObject({
      stockOnHand: 0,
      reservedQuantity: 0,
      availableQuantity: 0,
    });
  });
});
