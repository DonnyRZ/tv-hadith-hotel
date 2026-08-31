import { describe, expect, it } from 'vitest';

import { LANGUAGE_OPTIONS } from '@room-service/translations';

import { DESTINATIONS, SERVICE_ENTRIES, UI_COPY, UNIT_COPY } from './content';

const languages = LANGUAGE_OPTIONS.map(({ code }) => code);

function expectLocalized(value: { uz: string; ru: string; en: string }) {
  for (const language of languages) {
    expect(value[language].trim()).not.toBe('');
  }
}

describe('guest content contract', () => {
  it('keeps the guest language surface complete', () => {
    expect(Object.keys(UI_COPY).sort()).toEqual(['en', 'ru', 'uz']);

    for (const copy of Object.values(UI_COPY)) {
      for (const value of Object.values(copy)) {
        expect(value.trim()).not.toBe('');
      }
    }
  });

  it('keeps the service order and unit labels intentional', () => {
    expect(SERVICE_ENTRIES.map((service) => service.key)).toEqual([
      'HOUSEKEEPING',
      'FOOD_AND_BEVERAGES',
      'CAFE',
      'SPA',
      'BEAUTY_AND_SALON',
    ]);

    for (const service of SERVICE_ENTRIES) {
      expectLocalized(service.title);
      expectLocalized(service.description);
    }

    for (const label of Object.values(UNIT_COPY)) {
      expectLocalized(label);
    }
  });

  it('exposes exactly the two approved destination videos', () => {
    expect(DESTINATIONS).toHaveLength(2);
    expect(DESTINATIONS.map((destination) => destination.video)).toEqual([
      '/assets/hadith-hotel/destinations/imam-al-bukhari-complex.mp4',
      '/assets/hadith-hotel/destinations/registan-square.mp4',
    ]);

    for (const destination of DESTINATIONS) {
      expectLocalized(destination.title);
      expectLocalized(destination.eyebrow);
      expectLocalized(destination.description);
      expectLocalized(destination.distance);
      for (const fact of destination.facts) expectLocalized(fact);
      for (const tag of destination.tags) expectLocalized(tag);
    }
  });
});
