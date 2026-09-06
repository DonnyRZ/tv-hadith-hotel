import { describe, expect, it } from 'vitest';

import { LANGUAGE_OPTIONS } from '@room-service/translations';

import { ABOUT_FEATURES, DESTINATIONS, SERVICE_ENTRIES, UI_COPY, UNIT_COPY } from './content';
import { GALLERY_MANIFEST, STAY_ROOM_GALLERY_ORDER } from './gallery-manifest';

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
        if (typeof value === 'string') {
          expect(value.trim()).not.toBe('');
        } else {
          expect(typeof value).toBe('function');
        }
      }
    }
  });

  it('keeps the service order and unit labels intentional', () => {
    expect(SERVICE_ENTRIES.map((service) => service.key)).toEqual([
      'HOUSEKEEPING',
      'FOOD_AND_BEVERAGES',
      'CAFE',
      'BUTIK_INDONESIA',
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

  it('keeps the About gallery manifest curated and local', () => {
    expect(ABOUT_FEATURES.map((feature) => feature.gallery)).toEqual(['stay', 'taste', 'rest']);
    expect(STAY_ROOM_GALLERY_ORDER).toEqual(['standard', 'balcony', 'suite', 'junior-suite']);
    expect(GALLERY_MANIFEST.stay.standard.items).toHaveLength(4);
    expect(GALLERY_MANIFEST.stay.balcony.items).toHaveLength(1);
    expect(GALLERY_MANIFEST.stay.suite.items).toHaveLength(4);
    expect(GALLERY_MANIFEST.stay['junior-suite'].items).toHaveLength(6);
    expect(STAY_ROOM_GALLERY_ORDER).not.toContain('president-suite');
    expect(STAY_ROOM_GALLERY_ORDER).not.toContain('deluxe');
    expect(GALLERY_MANIFEST.taste.filter((item) => item.brand === 'saji')).toHaveLength(6);
    expect(GALLERY_MANIFEST.taste.filter((item) => item.brand === '7oz')).toHaveLength(6);
    expect(GALLERY_MANIFEST.rest).toHaveLength(5);

    const stayItems = STAY_ROOM_GALLERY_ORDER.flatMap(
      (roomType) => GALLERY_MANIFEST.stay[roomType].items,
    );
    const items = [...stayItems, ...GALLERY_MANIFEST.taste, ...GALLERY_MANIFEST.rest];
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    for (const item of items) {
      expect(item.optimizedPath.startsWith('/assets/hadith-hotel/galleries/')).toBe(true);
      expect(item.optimizedPath).not.toContain('menu-book');
    }
    for (const item of GALLERY_MANIFEST.taste) {
      expect(item.sourceUrl).toBeDefined();
      expect(item.sourcePath).toMatch(/^https:\/\//);
    }
    for (const roomType of STAY_ROOM_GALLERY_ORDER) {
      const room = GALLERY_MANIFEST.stay[roomType];
      expect(room.label.uz.trim()).not.toBe('');
      expect(room.label.ru.trim()).not.toBe('');
      expect(room.label.en.trim()).not.toBe('');
      for (const item of room.items) {
        expect(item.sourcePath).not.toMatch(/President Suite|Deluxe/i);
      }
    }
  });
});
