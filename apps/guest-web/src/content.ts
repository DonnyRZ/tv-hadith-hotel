import type { DepartmentCode, UnitCode } from '@room-service/api-client';
import {
  DEFAULT_LANGUAGE,
  getGuestCopy,
  type GuestCopy,
  type Language,
  type LocalizedText,
} from '@room-service/translations';

export type IconName =
  | 'arrow'
  | 'back'
  | 'building'
  | 'check'
  | 'chevron'
  | 'clock'
  | 'close'
  | 'cup'
  | 'language'
  | 'map'
  | 'minus'
  | 'plus'
  | 'refresh'
  | 'requests'
  | 'scissors'
  | 'spark'
  | 'utensils'
  | 'waves';

export interface UiCopy extends GuestCopy {
  about: string;
  aboutDescription: string;
  aboutKicker: string;
  aboutStory: string;
  add: string;
  allServices: string;
  back: string;
  close: string;
  continueExploring: string;
  destinations: string;
  destinationsDescription: string;
  destinationsKicker: string;
  distance: string;
  explore: string;
  fnb: string;
  fnbDescription: string;
  guestServices: string;
  hotelMoments: string;
  homeDescription: string;
  homeKicker: string;
  language: string;
  menuPage: string;
  next: string;
  noMenuItems: string;
  noRequestsDescription: string;
  previous: string;
  quantity: string;
  remove: string;
  requestItems: string;
  requestNotePlaceholder: string;
  requestSentDescription: string;
  requestSheetDescription: string;
  requestSummary: string;
  requestUnit: string;
  requestUnitConflict: string;
  room: string;
  serviceDescription: string;
  serviceKicker: string;
  services: string;
  statusCompleted: string;
  statusInProcess: string;
  statusNew: string;
  statusUpdated: string;
  accessRequired: string;
  accessDescription: string;
  accessError: string;
  accessNotReady: string;
  oneServicePerRequest: string;
  trackRequests: string;
  viewRequests: string;
  videoUnavailable: string;
  welcomeGuest: string;
}

const withGuestCopy = (language: Language, copy: Omit<UiCopy, keyof GuestCopy>): UiCopy => ({
  ...getGuestCopy(language),
  ...copy,
});

export const UI_COPY: Readonly<Record<Language, UiCopy>> = {
  uz: withGuestCopy('uz', {
    about: 'Mehmonxona haqida',
    aboutDescription:
      'Hadith Hotel — sokinlik, mehmondo‘stlik va Samarqand ruhi uyg‘unlashgan makon.',
    aboutKicker: 'Hadith Hotel',
    aboutStory:
      'Har bir lahza muloyim xizmat, iliq yorug‘lik va o‘zingizni uyda his qilishingiz uchun yaratilgan.',
    add: 'Qo‘shish',
    allServices: 'Barcha xizmatlar',
    back: 'Orqaga',
    close: 'Yopish',
    continueExploring: 'Ko‘rishni davom ettirish',
    destinations: 'Manzillar',
    destinationsDescription: 'Samarqandning eng yaqin va ilhomlantiruvchi tarixiy maskanlari.',
    destinationsKicker: 'Shaharni his qiling',
    distance: 'Masofa',
    explore: 'Ochish',
    fnb: 'F&B',
    fnbDescription: 'Taom, qahva va mehmonxonadagi yoqimli tanaffuslar.',
    guestServices: 'Mehmon xizmatlari',
    hotelMoments: 'Mehmonxona lahzalari',
    homeDescription: 'Kerakli xizmatni tanlang — biz qolganini siz uchun soddalashtiramiz.',
    homeKicker: 'Mehmon xizmatlari',
    language: 'Til',
    menuPage: 'Sahifa',
    next: 'Keyingi',
    noMenuItems: 'Bu xizmatda hozircha mavjud menyu yo‘q.',
    noRequestsDescription: 'Xizmat so‘rovingiz shu yerda ko‘rinadi.',
    previous: 'Oldingi',
    quantity: 'Miqdor',
    remove: 'Olib tashlash',
    requestItems: 'Tanlanganlar',
    requestNotePlaceholder: 'Masalan: iltimos, soat 19:00 gacha yetkazing',
    requestSentDescription:
      'So‘rovingiz tegishli jamoaga yuborildi. Holatini istalgan payt tekshirishingiz mumkin.',
    requestSheetDescription: 'Yuborishdan oldin tanlovingizni tekshiring.',
    requestSummary: 'So‘rovni ko‘rib chiqish',
    requestUnit: 'Xizmat',
    requestUnitConflict:
      'Bitta so‘rovda faqat bitta xizmat bo‘lishi mumkin. Avval tanlovni tozalang.',
    room: 'Xona',
    serviceDescription: 'Xonangizdan chiqmasdan, kerakli xizmatni bir necha bosishda so‘rang.',
    serviceKicker: 'Siz uchun',
    services: 'Xizmatlar',
    statusCompleted: 'Bajarildi',
    statusInProcess: 'Diproses',
    statusNew: 'Yangi',
    statusUpdated: 'Holat yangilandi',
    accessRequired: 'Xonangizdan kirishni boshlang',
    accessDescription: 'Hadith Hotel xizmatlarini ko‘rish uchun xonangizdagi QR kodni skanerlang.',
    accessError:
      'Ushbu kirish havolasi endi faol emas. Yangi QR kod uchun resepsiyaga murojaat qiling.',
    accessNotReady:
      'Xona uchun mehmon kirishi hali tayyor emas. Iltimos, resepsiyaga murojaat qiling.',
    oneServicePerRequest: 'Har bir so‘rov bitta xizmatdan iborat bo‘lishi kerak.',
    trackRequests: 'So‘rovlarni kuzatish',
    viewRequests: 'So‘rovlarimni ko‘rish',
    videoUnavailable: 'Video hozircha mavjud emas.',
    welcomeGuest: 'Xush kelibsiz',
  }),
  ru: withGuestCopy('ru', {
    about: 'Об отеле',
    aboutDescription:
      'Hadith Hotel — пространство спокойствия, гостеприимства и самаркандского характера.',
    aboutKicker: 'Hadith Hotel',
    aboutStory: 'Каждая деталь создана для мягкого сервиса, тёплого света и ощущения дома.',
    add: 'Добавить',
    allServices: 'Все услуги',
    back: 'Назад',
    close: 'Закрыть',
    continueExploring: 'Продолжить знакомство',
    destinations: 'Места рядом',
    destinationsDescription: 'Исторические места Самарканда, которые вдохновляют и легко посетить.',
    destinationsKicker: 'Почувствуйте город',
    distance: 'Расстояние',
    explore: 'Открыть',
    fnb: 'F&B',
    fnbDescription: 'Еда, кофе и приятные паузы в отеле.',
    guestServices: 'Сервисы для гостей',
    hotelMoments: 'Моменты отеля',
    homeDescription: 'Выберите нужную услугу — остальное мы сделаем проще для вас.',
    homeKicker: 'Услуги для гостей',
    language: 'Язык',
    menuPage: 'Страница',
    next: 'Далее',
    noMenuItems: 'В этой услуге пока нет доступного меню.',
    noRequestsDescription: 'Ваши запросы к сервисам появятся здесь.',
    previous: 'Назад',
    quantity: 'Количество',
    remove: 'Удалить',
    requestItems: 'Выбрано',
    requestNotePlaceholder: 'Например: пожалуйста, доставьте до 19:00',
    requestSentDescription:
      'Запрос отправлен нужной команде. Вы сможете проверить статус в любой момент.',
    requestSheetDescription: 'Проверьте выбор перед отправкой.',
    requestSummary: 'Проверить запрос',
    requestUnit: 'Сервис',
    requestUnitConflict:
      'Один запрос может содержать позиции только одного сервиса. Очистите выбор, чтобы продолжить.',
    room: 'Номер',
    serviceDescription: 'Закажите нужный сервис из номера в несколько понятных шагов.',
    serviceKicker: 'Для вас',
    services: 'Услуги',
    statusCompleted: 'Выполнено',
    statusInProcess: 'В работе',
    statusNew: 'Новый',
    statusUpdated: 'Статус обновлён',
    accessRequired: 'Начните с доступа из номера',
    accessDescription: 'Отсканируйте QR-код в номере, чтобы открыть сервисы Hadith Hotel.',
    accessError: 'Эта ссылка доступа больше не активна. Обратитесь на ресепшен за новым QR-кодом.',
    accessNotReady: 'Доступ для этого номера ещё не готов. Пожалуйста, обратитесь на ресепшен.',
    oneServicePerRequest: 'Каждый запрос должен относиться к одному сервису.',
    trackRequests: 'Отслеживать запросы',
    viewRequests: 'Мои запросы',
    videoUnavailable: 'Видео пока недоступно.',
    welcomeGuest: 'Добро пожаловать',
  }),
  en: withGuestCopy('en', {
    about: 'About hotel',
    aboutDescription:
      'Hadith Hotel is a quiet meeting point of warm hospitality, thoughtful service and Samarkand spirit.',
    aboutKicker: 'Hadith Hotel',
    aboutStory:
      'Every detail is made for gentle service, warm light and the feeling of being at home.',
    add: 'Add',
    allServices: 'All services',
    back: 'Back',
    close: 'Close',
    continueExploring: 'Continue exploring',
    destinations: 'Destinations',
    destinationsDescription:
      'The historic places around Samarkand that are close enough to inspire.',
    destinationsKicker: 'Feel the city',
    distance: 'Distance',
    explore: 'Explore',
    fnb: 'F&B',
    fnbDescription: 'Food, coffee and considered pauses within the hotel.',
    guestServices: 'Guest services',
    hotelMoments: 'Hotel moments',
    homeDescription: 'Choose what you need — we will make the rest feel effortless.',
    homeKicker: 'Guest services',
    language: 'Language',
    menuPage: 'Page',
    next: 'Next',
    noMenuItems: 'There is no available menu for this service yet.',
    noRequestsDescription: 'Your service requests will appear here.',
    previous: 'Previous',
    quantity: 'Quantity',
    remove: 'Remove',
    requestItems: 'Selected items',
    requestNotePlaceholder: 'For example: please deliver by 7:00 PM',
    requestSentDescription:
      'Your request has reached the right team. You can check its progress whenever you like.',
    requestSheetDescription: 'Take a moment to review your selection before sending.',
    requestSummary: 'Review request',
    requestUnit: 'Service',
    requestUnitConflict:
      'A request can contain items from one service only. Clear your selection to continue.',
    room: 'Room',
    serviceDescription: 'Ask for what you need from your room in a few clear steps.',
    serviceKicker: 'Made for you',
    services: 'Services',
    statusCompleted: 'Completed',
    statusInProcess: 'In progress',
    statusNew: 'New',
    statusUpdated: 'Status updated',
    accessRequired: 'Start with your room access',
    accessDescription: 'Scan the QR code in your room to open Hadith Hotel guest services.',
    accessError:
      'This access link is no longer active. Please contact reception for a new QR code.',
    accessNotReady: 'Guest access for this room is not ready yet. Please contact reception.',
    oneServicePerRequest: 'Each request must belong to one service.',
    trackRequests: 'Track requests',
    viewRequests: 'View my requests',
    videoUnavailable: 'Video is not available right now.',
    welcomeGuest: 'Welcome',
  }),
};

export const SERVICE_ENTRIES: ReadonlyArray<{
  key: UnitCode | 'FOOD_AND_BEVERAGES';
  icon: IconName;
  title: LocalizedText;
  description: LocalizedText;
  unitCodes: readonly UnitCode[];
}> = [
  {
    key: 'HOUSEKEEPING',
    icon: 'spark',
    title: { uz: 'Housekeeping', ru: 'Housekeeping', en: 'Housekeeping' },
    description: {
      uz: 'Xona uchun zarur qulayliklar va yordam.',
      ru: 'Забота о номере и всё необходимое для комфорта.',
      en: 'Thoughtful room care and the essentials for comfort.',
    },
    unitCodes: ['HOUSEKEEPING'],
  },
  {
    key: 'FOOD_AND_BEVERAGES',
    icon: 'utensils',
    title: { uz: 'F&B', ru: 'F&B', en: 'F&B' },
    description: {
      uz: 'Saji Nusantara va Lounge bilan mazali tanaffus.',
      ru: 'Вкусная пауза в Saji Nusantara и Lounge.',
      en: 'A considered pause at Saji Nusantara and Lounge.',
    },
    unitCodes: ['RESTAURANT', 'LOUNGE'],
  },
  {
    key: 'CAFE',
    icon: 'cup',
    title: { uz: '7oz Espresso Cafe', ru: '7oz Espresso Cafe', en: '7oz Espresso Cafe' },
    description: {
      uz: 'Yangi tayyorlangan qahva va yengil tanlovlar.',
      ru: 'Свежесваренный кофе и лёгкие блюда.',
      en: 'Freshly prepared coffee and lighter bites.',
    },
    unitCodes: ['CAFE'],
  },
  {
    key: 'SPA',
    icon: 'waves',
    title: { uz: 'SPA', ru: 'SPA', en: 'SPA' },
    description: {
      uz: 'Tinchlanish va o‘zingizga vaqt ajratish.',
      ru: 'Время замедлиться и позаботиться о себе.',
      en: 'Time to slow down and take care of yourself.',
    },
    unitCodes: ['SPA'],
  },
  {
    key: 'BEAUTY_AND_SALON',
    icon: 'scissors',
    title: { uz: 'Beauty Salon', ru: 'Beauty Salon', en: 'Beauty Salon' },
    description: {
      uz: 'Siz uchun yaratilgan go‘zallik va parvarish.',
      ru: 'Красота и уход, созданные для вас.',
      en: 'Beauty and care, arranged around you.',
    },
    unitCodes: ['BEAUTY_AND_SALON'],
  },
];

export const UNIT_COPY: Readonly<Record<UnitCode, LocalizedText>> = {
  CAFE: { uz: '7oz Espresso Cafe', ru: '7oz Espresso Cafe', en: '7oz Espresso Cafe' },
  RESTAURANT: { uz: 'Saji Nusantara', ru: 'Saji Nusantara', en: 'Saji Nusantara' },
  LOUNGE: { uz: 'Lounge', ru: 'Lounge', en: 'Lounge' },
  SPA: { uz: 'SPA', ru: 'SPA', en: 'SPA' },
  HOUSEKEEPING: { uz: 'Housekeeping', ru: 'Housekeeping', en: 'Housekeeping' },
  BEAUTY_AND_SALON: { uz: 'Beauty Salon', ru: 'Beauty Salon', en: 'Beauty Salon' },
};

export const ABOUT_FEATURES: ReadonlyArray<{
  title: LocalizedText;
  body: LocalizedText;
  image: string;
}> = [
  {
    title: { uz: 'Sokin mehmonxona', ru: 'Спокойный отель', en: 'A quieter stay' },
    body: {
      uz: 'Yorug‘ hovli, iliq kutib olish va xonangizdan boshqariladigan qulayliklar.',
      ru: 'Светлый двор, тёплый приём и удобства, доступные прямо из номера.',
      en: 'A luminous courtyard, a warm welcome and comfort available from your room.',
    },
    image: '/assets/hadith-hotel/about/hotel-exterior.png',
  },
  {
    title: { uz: 'Ta’m va suhbat', ru: 'Вкус и разговор', en: 'Taste and conversation' },
    body: {
      uz: 'Saji Nusantara va 7oz Espresso Cafe kunning istalgan payti uchun.',
      ru: 'Saji Nusantara и 7oz Espresso Cafe для любого момента дня.',
      en: 'Saji Nusantara and 7oz Espresso Cafe for any moment of the day.',
    },
    image: '/assets/hadith-hotel/about/saji-nusantara.png',
  },
  {
    title: { uz: 'Dam olish va parvarish', ru: 'Отдых и уход', en: 'Rest and care' },
    body: {
      uz: 'Suv, SPA va salon tajribasi kuningizni yumshoq yakunlashga yordam beradi.',
      ru: 'Бассейн, SPA и салон помогают мягко завершить ваш день.',
      en: 'The pool, SPA and salon help you ease gently into the rest of your day.',
    },
    image: '/assets/hadith-hotel/about/pool.png',
  },
];

export const DESTINATIONS: ReadonlyArray<{
  title: LocalizedText;
  eyebrow: LocalizedText;
  description: LocalizedText;
  distance: LocalizedText;
  facts: ReadonlyArray<LocalizedText>;
  tags: ReadonlyArray<LocalizedText>;
  video: string;
}> = [
  {
    title: {
      uz: 'Imom al-Buxoriy merosi',
      ru: 'Наследие имама аль-Бухари',
      en: 'The legacy of Imam Al-Bukhari',
    },
    eyebrow: { uz: 'Ma’naviy sayohat', ru: 'Духовное путешествие', en: 'A spiritual journey' },
    description: {
      uz: 'Buyuk muhaddis xotirasiga bag‘ishlangan majmua — sokin, chuqur va ilhomlantiruvchi tashrif.',
      ru: 'Комплекс в память о великом мухаддисе — тихое, глубокое и вдохновляющее посещение.',
      en: 'A quiet, meaningful visit to the complex honouring the great muhaddith.',
    },
    distance: { uz: 'taxm. 0,9 km', ru: 'около 0,9 км', en: 'approx. 0.9 km' },
    facts: [
      {
        uz: 'Imom al-Buxoriy maqbarasi',
        ru: 'Мавзолей имама аль-Бухари',
        en: 'Imam Al-Bukhari Mausoleum',
      },
      {
        uz: 'Xalqaro ilmiy markaz',
        ru: 'Международный научный центр',
        en: 'International scholarly centre',
      },
    ],
    tags: [
      { uz: 'Ziyorat', ru: 'Паломничество', en: 'Pilgrimage' },
      { uz: 'Ilm-fan', ru: 'Знания', en: 'Scholarship' },
    ],
    video: '/assets/hadith-hotel/destinations/imam-al-bukhari-complex.mp4',
  },
  {
    title: { uz: 'Registon maydoni', ru: 'Площадь Регистан', en: 'Registan Square' },
    eyebrow: { uz: 'Samarqand ramzi', ru: 'Символ Самарканда', en: 'Samarkand in one view' },
    description: {
      uz: 'Moviy koshinlar, uch madrasa va Ipak yo‘lining yuragida yarim kunlik tarixiy sayohat.',
      ru: 'Три медресе, голубая мозаика и историческое путешествие в сердце Шёлкового пути.',
      en: 'Three madrasas, blue tilework and a half-day journey through the heart of the Silk Road.',
    },
    distance: { uz: 'taxm. 17,2 km', ru: 'около 17,2 км', en: 'approx. 17.2 km' },
    facts: [
      { uz: 'Ulug‘bek madrasasi', ru: 'Медресе Улугбека', en: 'Ulugh Beg Madrasa' },
      { uz: 'Sherdor va Tillakori', ru: 'Шердор и Тиллякори', en: 'Sher-Dor and Tilla-Kori' },
    ],
    tags: [
      { uz: 'Me’morchilik', ru: 'Архитектура', en: 'Architecture' },
      { uz: 'Ipak yo‘li', ru: 'Шёлковый путь', en: 'Silk Road' },
    ],
    video: '/assets/hadith-hotel/destinations/registan-square.mp4',
  },
];

export function localize(value: LocalizedText | null | undefined, language: Language): string {
  if (value === null || value === undefined) return '';
  return value[language] || value[DEFAULT_LANGUAGE] || value.en || value.ru;
}

export function departmentForUnit(unit: UnitCode): DepartmentCode {
  if (unit === 'CAFE') return 'CAFE';
  if (unit === 'RESTAURANT' || unit === 'LOUNGE') return 'FOOD_AND_BEVERAGES';
  return unit;
}

export function unitLabel(unit: UnitCode, language: Language): string {
  return localize(UNIT_COPY[unit], language);
}
