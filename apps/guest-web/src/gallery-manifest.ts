import type { LocalizedText } from '@room-service/translations';

export type GalleryId = 'stay' | 'taste' | 'rest';
export type GalleryBrand = 'saji' | '7oz';
export type StayRoomType = 'standard' | 'balcony' | 'suite' | 'junior-suite';

export interface GalleryItem {
  id: string;
  sourcePath: string;
  sourceUrl?: string;
  optimizedPath: string;
  tvResource: string;
  caption: string;
  alt: string;
  brand?: GalleryBrand;
}

export interface StayRoomGallery {
  id: StayRoomType;
  label: LocalizedText;
  items: readonly GalleryItem[];
}

export type GalleryManifest = Readonly<{
  stay: Readonly<Record<StayRoomType, StayRoomGallery>>;
  taste: readonly GalleryItem[];
  rest: readonly GalleryItem[];
}>;

export const STAY_ROOM_GALLERY_ORDER: readonly StayRoomType[] = [
  'standard',
  'balcony',
  'suite',
  'junior-suite',
];

export const GALLERY_MANIFEST: GalleryManifest = {
  stay: {
    standard: {
      id: 'standard',
      label: {
        uz: 'Standard Room',
        ru: 'Standard Room',
        en: 'Standard Room',
      },
      items: [
        {
          id: 'standard-room-01',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Standard/Standard.jpeg',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/standard/standard-01.webp',
          tvResource: 'gallery_stay_standard_01',
          caption: 'Standard Room · bedroom',
          alt: 'Standard Room bedroom',
        },
        {
          id: 'standard-room-02',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Standard/Standard-2.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/standard/standard-02.webp',
          tvResource: 'gallery_stay_standard_02',
          caption: 'Standard Room · bedroom detail',
          alt: 'Standard Room bedroom detail',
        },
        {
          id: 'standard-room-03',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Standard/Standard-3.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/standard/standard-03.webp',
          tvResource: 'gallery_stay_standard_03',
          caption: 'Standard Room · room view',
          alt: 'Standard Room room view',
        },
        {
          id: 'standard-room-04',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Standard/Standard-4.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/standard/standard-04.webp',
          tvResource: 'gallery_stay_standard_04',
          caption: 'Standard Room · interior',
          alt: 'Standard Room interior',
        },
      ],
    },
    balcony: {
      id: 'balcony',
      label: {
        uz: 'Balcony Room',
        ru: 'Balcony Room',
        en: 'Balcony Room',
      },
      items: [
        {
          id: 'balcony-room-01',
          sourcePath:
            'hadith-hotel-2/Asset/Suites & Rooms/Balcony/ChatGPT Image 30 Jul 2026, 08.39.04.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/balcony/balcony-01.webp',
          tvResource: 'gallery_stay_balcony_01',
          caption: 'Balcony Room · room view',
          alt: 'Balcony Room room view',
        },
      ],
    },
    suite: {
      id: 'suite',
      label: {
        uz: 'Suite',
        ru: 'Suite',
        en: 'Suite',
      },
      items: [
        {
          id: 'suite-01',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Suite/Suite.jpeg',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/suite/suite-01.webp',
          tvResource: 'gallery_stay_suite_01',
          caption: 'Suite · bedroom',
          alt: 'Suite bedroom',
        },
        {
          id: 'suite-02',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Suite/Suite-2.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/suite/suite-02.webp',
          tvResource: 'gallery_stay_suite_02',
          caption: 'Suite · bedroom detail',
          alt: 'Suite bedroom detail',
        },
        {
          id: 'suite-03',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Suite/Suite-3.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/suite/suite-03.webp',
          tvResource: 'gallery_stay_suite_03',
          caption: 'Suite · living area',
          alt: 'Suite living area',
        },
        {
          id: 'suite-04',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Suite/Suite-4.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/suite/suite-04.webp',
          tvResource: 'gallery_stay_suite_04',
          caption: 'Suite · interior',
          alt: 'Suite interior',
        },
      ],
    },
    'junior-suite': {
      id: 'junior-suite',
      label: {
        uz: 'Junior Suite',
        ru: 'Junior Suite',
        en: 'Junior Suite',
      },
      items: [
        {
          id: 'junior-suite-01',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Junior Suite/Junior-1.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-01.webp',
          tvResource: 'gallery_stay_junior_suite_01',
          caption: 'Junior Suite · bedroom',
          alt: 'Junior Suite bedroom',
        },
        {
          id: 'junior-suite-02',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Junior Suite/Junior-2.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-02.webp',
          tvResource: 'gallery_stay_junior_suite_02',
          caption: 'Junior Suite · living area',
          alt: 'Junior Suite living area',
        },
        {
          id: 'junior-suite-03',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Junior Suite/Junior-3.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-03.webp',
          tvResource: 'gallery_stay_junior_suite_03',
          caption: 'Junior Suite · lounge',
          alt: 'Junior Suite lounge',
        },
        {
          id: 'junior-suite-04',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Junior Suite/Junior-4.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-04.webp',
          tvResource: 'gallery_stay_junior_suite_04',
          caption: 'Junior Suite · vanity',
          alt: 'Junior Suite vanity',
        },
        {
          id: 'junior-suite-05',
          sourcePath: 'hadith-hotel-2/Asset/Suites & Rooms/Junior Suite/Junior-5.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-05.webp',
          tvResource: 'gallery_stay_junior_suite_05',
          caption: 'Junior Suite · bathroom',
          alt: 'Junior Suite bathroom',
        },
        {
          id: 'junior-suite-06',
          sourcePath: 'hadith-hotel-2/Asset/Undecided/Junior Suite/Junior Suite 3.png',
          optimizedPath: '/assets/hadith-hotel/galleries/stay/junior-suite-06.webp',
          tvResource: 'gallery_stay_junior_suite_06',
          caption: 'Junior Suite · sitting area',
          alt: 'Junior Suite sitting area',
        },
      ],
    },
  },
  taste: [
    {
      id: 'saji-nasi-goreng',
      sourcePath: 'https://saji-nusantara.com/images/dishes/nasi-goreng.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/nasi-goreng.webp',
      tvResource: 'gallery_taste_saji_nasi_goreng',
      caption: 'Nasi Goreng',
      alt: 'Nasi Goreng',
      brand: 'saji',
    },
    {
      id: 'saji-sate-kambing',
      sourcePath: 'https://saji-nusantara.com/images/dishes/sate-kambing.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/sate-kambing.webp',
      tvResource: 'gallery_taste_saji_sate_kambing',
      caption: 'Sate Kambing',
      alt: 'Sate Kambing',
      brand: 'saji',
    },
    {
      id: 'saji-soto-ayam',
      sourcePath: 'https://saji-nusantara.com/images/dishes/soto.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/soto-ayam.webp',
      tvResource: 'gallery_taste_saji_soto_ayam',
      caption: 'Soto Ayam',
      alt: 'Soto Ayam',
      brand: 'saji',
    },
    {
      id: 'saji-beef-rendang',
      sourcePath: 'https://saji-nusantara.com/images/dishes/rendang.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/beef-rendang.webp',
      tvResource: 'gallery_taste_saji_beef_rendang',
      caption: 'Beef Rendang',
      alt: 'Beef Rendang',
      brand: 'saji',
    },
    {
      id: 'saji-ayam-bakar',
      sourcePath: 'https://saji-nusantara.com/images/dishes/ayam-bakar.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/ayam-bakar.webp',
      tvResource: 'gallery_taste_saji_ayam_bakar',
      caption: 'Ayam Bakar',
      alt: 'Ayam Bakar',
      brand: 'saji',
    },
    {
      id: 'saji-es-cendol',
      sourcePath: 'https://saji-nusantara.com/images/dishes/es-cendol.jpg',
      sourceUrl: 'https://saji-nusantara.com/en/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/saji/es-cendol.webp',
      tvResource: 'gallery_taste_saji_es_cendol',
      caption: 'Es Cendol',
      alt: 'Es Cendol',
      brand: 'saji',
    },
    {
      id: '7oz-berrypresso',
      sourcePath: 'https://7oz-espresso.com/assets/menu/beverages/berrypresso.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/berrypresso.webp',
      tvResource: 'gallery_taste_7oz_berrypresso',
      caption: 'Berrypresso',
      alt: 'Berrypresso',
      brand: '7oz',
    },
    {
      id: '7oz-spanish-latte',
      sourcePath: 'https://7oz-espresso.com/assets/menu/beverages/spanish-latte.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/spanish-latte.webp',
      tvResource: 'gallery_taste_7oz_spanish_latte',
      caption: 'Spanish Latte',
      alt: 'Spanish Latte',
      brand: '7oz',
    },
    {
      id: '7oz-mont-blanc',
      sourcePath: 'https://7oz-espresso.com/assets/menu/beverages/mont-blanc.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/mont-blanc.webp',
      tvResource: 'gallery_taste_7oz_mont_blanc',
      caption: 'Mont Blanc',
      alt: 'Mont Blanc',
      brand: '7oz',
    },
    {
      id: '7oz-pink-lemonade',
      sourcePath: 'https://7oz-espresso.com/assets/menu/beverages/pink-lemonade.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/pink-lemonade.webp',
      tvResource: 'gallery_taste_7oz_pink_lemonade',
      caption: 'Pink Lemonade',
      alt: 'Pink Lemonade',
      brand: '7oz',
    },
    {
      id: '7oz-hazelnut-latte',
      sourcePath: 'https://7oz-espresso.com/assets/menu/beverages/hazelnut-latte.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/hazelnut-latte.webp',
      tvResource: 'gallery_taste_7oz_hazelnut_latte',
      caption: 'Hazelnut Latte',
      alt: 'Hazelnut Latte',
      brand: '7oz',
    },
    {
      id: '7oz-bomboloni-raspberry',
      sourcePath: 'https://7oz-espresso.com/assets/menu/pastries/bomboloni-raspberry.webp',
      sourceUrl: 'https://7oz-espresso.com/menu',
      optimizedPath: '/assets/hadith-hotel/galleries/taste/7oz/bomboloni-raspberry.webp',
      tvResource: 'gallery_taste_7oz_bomboloni_raspberry',
      caption: 'Bomboloni Raspberry',
      alt: 'Bomboloni Raspberry',
      brand: '7oz',
    },
  ],
  rest: [
    {
      id: 'rest-pool',
      sourcePath: 'hadith-hotel-2/Asset/Experience/Pool.png',
      optimizedPath: '/assets/hadith-hotel/galleries/rest/pool.webp',
      tvResource: 'gallery_rest_pool',
      caption: 'Pool',
      alt: 'Hadith Hotel pool',
    },
    {
      id: 'rest-hamam',
      sourcePath: 'hadith-hotel-2/Asset/Experience/Hamam.png',
      optimizedPath: '/assets/hadith-hotel/galleries/rest/hamam.webp',
      tvResource: 'gallery_rest_hamam',
      caption: 'Hamam',
      alt: 'Hadith Hotel hamam',
    },
    {
      id: 'rest-massage',
      sourcePath: 'hadith-hotel-2/Asset/Experience/Massage.png',
      optimizedPath: '/assets/hadith-hotel/galleries/rest/massage.webp',
      tvResource: 'gallery_rest_massage',
      caption: 'Massage',
      alt: 'Hadith Hotel massage room',
    },
    {
      id: 'rest-sauna',
      sourcePath: 'hadith-hotel-2/Asset/Experience/Sauna.png',
      optimizedPath: '/assets/hadith-hotel/galleries/rest/sauna.webp',
      tvResource: 'gallery_rest_sauna',
      caption: 'Sauna',
      alt: 'Hadith Hotel sauna',
    },
    {
      id: 'rest-salon',
      sourcePath: 'hadith-hotel-2/Asset/Experience/Salon.jpeg',
      optimizedPath: '/assets/hadith-hotel/galleries/rest/salon.webp',
      tvResource: 'gallery_rest_salon',
      caption: 'Salon',
      alt: 'Hadith Hotel salon',
    },
  ],
};

export const GALLERY_BRAND_LABELS: Readonly<Record<GalleryBrand, LocalizedText>> = {
  saji: { uz: 'Saji Nusantara', ru: 'Saji Nusantara', en: 'Saji Nusantara' },
  '7oz': { uz: '7Oz Espresso', ru: '7Oz Espresso', en: '7Oz Espresso' },
};
