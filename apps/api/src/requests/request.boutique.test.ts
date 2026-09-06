import { randomUUID } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { PublicStaffUser } from '../auth/auth.types';
import { InMemoryMenuRepository } from '../menu/menu.repository';
import { InMemoryBoutiqueRepository } from '../boutique/boutique.repository';
import { BoutiqueService } from '../boutique/boutique.service';
import { InMemoryRequestRepository, RequestClientIdConflictError } from './request.repository';
import type { CreateRequestRecordInput } from './request.types';
import { RequestService } from './request.service';

const localized = (value: string) => ({ uz: value, ru: value, en: value });

describe('Butik Indonesia reservation expiry', () => {
  it('cancels an expired NEW order once and releases its reservation', async () => {
    const menuRepository = new InMemoryMenuRepository();
    const boutiqueRepository = new InMemoryBoutiqueRepository(menuRepository);
    const boutiqueService = new BoutiqueService(boutiqueRepository);
    const requestRepository = new InMemoryRequestRepository();
    const requestService = new RequestService(requestRepository, boutiqueService);
    const category = await boutiqueRepository.createCategory({
      localizedName: localized('Expiry test category'),
      localizedDescription: localized('Expiry test category'),
      imageMediaId: null,
      sortOrder: 0,
    });
    const product = await boutiqueRepository.createProduct({
      localizedName: localized('Expiry test product'),
      localizedDescription: localized('Expiry test product'),
      categoryId: category.id,
      imageMediaId: null,
      available: true,
      sortOrder: 0,
      variants: [
        {
          sku: 'EXPIRY-TEST-1',
          options: [],
          price: 1,
          currency: 'IDR',
          stockOnHand: 1,
          sortOrder: 0,
        },
      ],
    });
    const variant = product.variants[0];
    if (variant === undefined) throw new Error('Expiry test product did not create a variant.');
    const request = await requestRepository.create({
      clientRequestId: randomUUID(),
      guestAssignmentId: randomUUID(),
      department: 'BUTIK_INDONESIA',
      unit: 'BUTIK_INDONESIA',
      room: { id: randomUUID(), number: '901' },
      items: [
        {
          menuItemId: product.item.id,
          unit: 'BUTIK_INDONESIA',
          kind: 'PRODUCT',
          name: product.item.name,
          localizedName: product.item.localizedName,
          quantity: 1,
          note: null,
          unitPrice: variant.price,
          currency: variant.currency,
          variantId: variant.id,
          sku: variant.sku,
          variantOptions: variant.options,
        },
      ],
      guestNote: null,
      reservationExpiresAt: new Date(Date.now() - 1_000).toISOString(),
    });
    await boutiqueService.reserveStock(
      [{ variantId: variant.id, quantity: 1 }],
      request.clientRequestId,
    );

    await expect(requestService.expireBoutiqueReservations()).resolves.toBe(1);
    const expired = await requestRepository.findById(request.id);
    expect(expired).toMatchObject({
      status: 'CANCELLED',
      cancellationSource: 'AUTO_EXPIRY',
      cancellationReason: 'Reservation expired after 30 minutes.',
      reservationExpiresAt: null,
    });
    const afterExpiry = await boutiqueRepository.findProductByMenuItemId(product.item.id);
    expect(afterExpiry?.variants[0]).toMatchObject({ reservedQuantity: 0, availableQuantity: 1 });
    await expect(requestService.expireBoutiqueReservations()).resolves.toBe(0);
  });

  it('keeps a concurrent cancellation from releasing a completed order', async () => {
    const menuRepository = new InMemoryMenuRepository();
    const boutiqueRepository = new InMemoryBoutiqueRepository(menuRepository);
    const boutiqueService = new BoutiqueService(boutiqueRepository);
    const requestRepository = new InMemoryRequestRepository();
    const requestService = new RequestService(requestRepository, boutiqueService);
    const category = await boutiqueRepository.createCategory({
      localizedName: localized('Race test category'),
      localizedDescription: localized('Race test category'),
      imageMediaId: null,
      sortOrder: 0,
    });
    const product = await boutiqueRepository.createProduct({
      localizedName: localized('Race test product'),
      localizedDescription: localized('Race test product'),
      categoryId: category.id,
      imageMediaId: null,
      available: true,
      sortOrder: 0,
      variants: [
        {
          sku: 'RACE-TEST-1',
          options: [],
          price: 1,
          currency: 'IDR',
          stockOnHand: 1,
          sortOrder: 0,
        },
      ],
    });
    const variant = product.variants[0];
    if (variant === undefined) throw new Error('Race test product did not create a variant.');
    const request = await requestRepository.create({
      clientRequestId: randomUUID(),
      guestAssignmentId: randomUUID(),
      guestName: 'Race Guest',
      department: 'BUTIK_INDONESIA',
      unit: 'BUTIK_INDONESIA',
      room: { id: randomUUID(), number: '902' },
      items: [
        {
          menuItemId: product.item.id,
          unit: 'BUTIK_INDONESIA',
          kind: 'PRODUCT',
          name: product.item.name,
          localizedName: product.item.localizedName,
          quantity: 1,
          note: null,
          unitPrice: variant.price,
          currency: variant.currency,
          variantId: variant.id,
          sku: variant.sku,
          variantOptions: variant.options,
        },
      ],
      guestNote: null,
      reservationExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
    await boutiqueService.reserveStock(
      [{ variantId: variant.id, quantity: 1 }],
      request.clientRequestId,
    );
    const staff: PublicStaffUser = {
      id: randomUUID(),
      displayName: 'Butik Operator',
      roles: ['BUTIK_INDONESIA'],
      permissions: ['request:view', 'request:complete', 'request:cancel', 'request:history'],
    };
    await requestService.confirmDepartmentRequest(staff, request.id);

    let markFulfillmentStarted!: () => void;
    let releaseFulfillment!: () => void;
    const fulfillmentStarted = new Promise<void>((resolve) => {
      markFulfillmentStarted = resolve;
    });
    const fulfillmentGate = new Promise<void>((resolve) => {
      releaseFulfillment = resolve;
    });
    const originalFulfill = boutiqueService.fulfillStock.bind(boutiqueService);
    boutiqueService.fulfillStock = async (...args) => {
      markFulfillmentStarted();
      await fulfillmentGate;
      return originalFulfill(...args);
    };

    const completion = requestService.completeDepartmentRequest(staff, request.id);
    await fulfillmentStarted;
    await expect(requestService.cancelDepartmentRequest(staff, request.id)).rejects.toMatchObject({
      status: 409,
    });
    releaseFulfillment();
    await completion;

    await expect(requestRepository.findById(request.id)).resolves.toMatchObject({
      status: 'COMPLETED',
    });
    await expect(
      boutiqueRepository.findProductByMenuItemId(product.item.id),
    ).resolves.toMatchObject({
      variants: [{ stockOnHand: 0, reservedQuantity: 0, availableQuantity: 0 }],
    });
  });
});

describe('combined guest request persistence', () => {
  it('persists all unit children together and never leaves a partial batch', async () => {
    const repository = new InMemoryRequestRepository();
    const assignmentId = randomUUID();
    const room = { id: randomUUID(), number: '230' };
    const createInput = (
      clientRequestId: string,
      unit: 'CAFE' | 'RESTAURANT',
    ): CreateRequestRecordInput => ({
      clientRequestId,
      guestAssignmentId: assignmentId,
      department: unit === 'CAFE' ? 'CAFE' : 'FOOD_AND_BEVERAGES',
      unit,
      room,
      items: [
        {
          menuItemId: randomUUID(),
          unit,
          kind: 'PRODUCT',
          name: unit === 'CAFE' ? 'Iced Americano' : 'Nasi Goreng',
          localizedName: {
            uz: unit === 'CAFE' ? 'Iced Americano' : 'Nasi Goreng',
            ru: unit === 'CAFE' ? 'Iced Americano' : 'Наси горенг',
            en: unit === 'CAFE' ? 'Iced Americano' : 'Nasi Goreng',
          },
          quantity: 1,
          note: null,
          unitPrice: null,
          currency: null,
        },
      ],
      guestNote: null,
    });

    const clientRequestId = randomUUID();
    const created = await repository.createBatch([
      createInput(clientRequestId, 'CAFE'),
      createInput(clientRequestId, 'RESTAURANT'),
    ]);
    expect(created).toHaveLength(2);
    expect(await repository.listByClientRequestId(clientRequestId, assignmentId)).toHaveLength(2);

    const failedClientRequestId = randomUUID();
    await expect(
      repository.createBatch([
        createInput(failedClientRequestId, 'CAFE'),
        createInput(failedClientRequestId, 'CAFE'),
      ]),
    ).rejects.toBeInstanceOf(RequestClientIdConflictError);
    await expect(
      repository.listByClientRequestId(failedClientRequestId, assignmentId),
    ).resolves.toEqual([]);
  });
});
