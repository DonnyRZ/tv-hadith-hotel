export type Language = 'uz' | 'ru' | 'en';

export const DEFAULT_LANGUAGE: Language = 'uz';

export const LANGUAGE_OPTIONS: readonly { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbekcha" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export interface LocalizedText {
  uz: string;
  ru: string;
  en: string;
}

export interface GuestCopy {
  welcome: string;
  departments: string;
  menu: string;
  request: string;
  requests: string;
  loading: string;
  retry: string;
  unavailable: string;
  menuNotConfigured: string;
  priceNotSet: string;
  addToRequest: string;
  submitRequest: string;
  requestNote: string;
  itemNote: string;
  requestSubmitted: string;
  requestStatus: string;
  noRequests: string;
  offline: string;
}

export const GUEST_COPY: Readonly<Record<Language, GuestCopy>> = {
  uz: {
    welcome: 'Xush kelibsiz',
    departments: 'Xizmatlar',
    menu: 'Menyu',
    request: 'So‘rov',
    requests: 'So‘rovlarim',
    loading: 'Yuklanmoqda…',
    retry: 'Qayta urinish',
    unavailable: 'Hozir mavjud emas',
    menuNotConfigured: 'Bu xizmat hali sozlanmagan',
    priceNotSet: 'Narx belgilanmagan',
    addToRequest: 'So‘rovga qo‘shish',
    submitRequest: 'So‘rov yuborish',
    requestNote: 'Qo‘shimcha izoh',
    itemNote: 'Pozitsiya izohi',
    requestSubmitted: 'So‘rov yuborildi',
    requestStatus: 'So‘rov holati',
    noRequests: 'Hozircha so‘rovlar yo‘q',
    offline: 'Internet aloqasi yo‘q',
  },
  ru: {
    welcome: 'Добро пожаловать',
    departments: 'Услуги',
    menu: 'Меню',
    request: 'Запрос',
    requests: 'Мои запросы',
    loading: 'Загрузка…',
    retry: 'Повторить',
    unavailable: 'Сейчас недоступно',
    menuNotConfigured: 'Эта услуга ещё не настроена',
    priceNotSet: 'Цена не указана',
    addToRequest: 'Добавить в запрос',
    submitRequest: 'Отправить запрос',
    requestNote: 'Дополнительный комментарий',
    itemNote: 'Комментарий к позиции',
    requestSubmitted: 'Запрос отправлен',
    requestStatus: 'Статус запроса',
    noRequests: 'Запросов пока нет',
    offline: 'Нет подключения к интернету',
  },
  en: {
    welcome: 'Welcome',
    departments: 'Services',
    menu: 'Menu',
    request: 'Request',
    requests: 'My requests',
    loading: 'Loading…',
    retry: 'Retry',
    unavailable: 'Currently unavailable',
    menuNotConfigured: 'This service is not configured yet',
    priceNotSet: 'Price not set',
    addToRequest: 'Add to request',
    submitRequest: 'Submit request',
    requestNote: 'Additional note',
    itemNote: 'Item note',
    requestSubmitted: 'Request submitted',
    requestStatus: 'Request status',
    noRequests: 'No requests yet',
    offline: 'No internet connection',
  },
};

export function getGuestCopy(language: Language): GuestCopy {
  return GUEST_COPY[language];
}
