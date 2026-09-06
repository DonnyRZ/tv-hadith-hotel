import { useCallback, useEffect, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import {
  managementApi,
  StaffApiError,
  type BoutiqueCategory,
  type BoutiqueProduct,
  type BoutiqueVariant,
  type StaffRequest,
} from './management-api';
import {
  serializeTextDraft,
  textDraftFromLocalized,
  updateTextDraft,
  validateVariantDraft,
  variantOptionsFromApi,
  variantOptionsToApi,
  type BoutiqueTextDraft,
  type VariantDraft,
  type VariantOptionDraft,
} from './boutique-form';
import {
  AdminBrandMark,
  AdminLanguageSwitcher,
  ArrowIcon,
  getInitials,
  MenuIcon,
  OrdersIcon,
} from './CafeWorkspace';
import type { AuthCopy, Language } from './i18n';
import { StaffRealtimeIndicator, useStaffRealtime } from './StaffRealtime';

interface StaffUser {
  displayName: string;
}

export interface ButikWorkspaceProps {
  authCopy: AuthCopy;
  initialPage: 'orders' | 'catalog';
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigate: (page: 'orders' | 'catalog') => void;
  onSignOut: () => void;
  user: StaffUser;
}

type CatalogueMode =
  'idle' | 'create-category' | 'edit-category' | 'create-product' | 'edit-product';
type OrderFilter = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

interface ButikCopy {
  administration: string;
  orders: string;
  catalog: string;
  workspace: string;
  ordersSubtitle: string;
  catalogSubtitle: string;
  refresh: string;
  refreshing: string;
  newOrders: string;
  inProcess: string;
  completed: string;
  cancelled: string;
  activeStock: string;
  lowStock: string;
  outOfStock: string;
  activeQueue: string;
  history: string;
  allActive: string;
  room: string;
  guest: string;
  requested: string;
  status: string;
  expiry: string;
  items: string;
  actions: string;
  open: string;
  confirm: string;
  complete: string;
  cancelOrder: string;
  cancelReason: string;
  cancelReasonPlaceholder: string;
  close: string;
  noOrders: string;
  noOrdersDescription: string;
  categories: string;
  products: string;
  addCategory: string;
  addProduct: string;
  edit: string;
  active: string;
  inactive: string;
  deactivate: string;
  activate: string;
  categoryName: string;
  description: string;
  save: string;
  saving: string;
  cancel: string;
  productName: string;
  category: string;
  sku: string;
  price: string;
  stock: string;
  currency: string;
  total: (count: number) => string;
  basicInformation: string;
  categoryAvailability: string;
  pricingInventory: string;
  variantOptions: string;
  noDescription: string;
  nameHint: string;
  descriptionOptional: string;
  textSameAcrossLanguages: string;
  variantDetails: string;
  optionName: string;
  optionValue: string;
  addOption: string;
  removeOption: string;
  noOptions: string;
  requiredField: string;
  invalidPrice: string;
  invalidStock: string;
  invalidCategory: string;
  duplicateSku: string;
  duplicateOption: string;
  uploadImage: string;
  create: string;
  update: string;
  variants: string;
  available: string;
  reserved: string;
  addVariant: string;
  adjustStock: string;
  stockAdjustment: string;
  stockAdjustmentDescription: string;
  delta: string;
  reason: string;
  reasonPlaceholder: string;
  apply: string;
  invalidStockChange: string;
  noCategories: string;
  noProducts: string;
  loading: string;
  error: string;
  retry: string;
  realtimeUpdated: string;
  sessionExpired: string;
  requestNote: string;
  skuLabel: string;
  roomOrder: (room: string) => string;
  itemSummary: (count: number) => string;
  expiresAt: (value: string) => string;
}

const COPY: Record<Language, ButikCopy> = {
  uz: {
    administration: 'Boshqaruv',
    orders: 'Buyurtmalar',
    catalog: 'Katalog',
    workspace: 'Butik Indonesia',
    ordersSubtitle: 'Xona buyurtmalarini boshqaring va stokni nazorat qiling.',
    catalogSubtitle: 'Mahsulotlar, variantlar, rasmlar va stokni boshqaring.',
    refresh: 'Yangilash',
    refreshing: 'Yangilanmoqda…',
    newOrders: 'Yangi',
    inProcess: 'Jarayonda',
    completed: 'Yakunlangan',
    cancelled: 'Bekor qilingan',
    activeStock: 'Mavjud stok',
    lowStock: 'Kam stok',
    outOfStock: 'Stok tugagan',
    activeQueue: 'Faol navbat',
    history: 'Tarix',
    allActive: 'Barcha faol',
    room: 'Xona',
    guest: 'Mehmon',
    requested: 'Buyurtma vaqti',
    status: 'Holat',
    expiry: 'Muddati',
    items: 'Mahsulotlar',
    actions: 'Harakatlar',
    open: 'Ko‘rish',
    confirm: 'Tasdiqlash',
    complete: 'Yakunlash',
    cancelOrder: 'Bekor qilish',
    cancelReason: 'Bekor qilish sababi',
    cancelReasonPlaceholder: 'Sababni kiriting',
    close: 'Yopish',
    noOrders: 'Buyurtmalar yo‘q',
    noOrdersDescription: 'Bu bo‘limda hozircha buyurtma mavjud emas.',
    categories: 'Kategoriyalar',
    products: 'Mahsulotlar',
    addCategory: 'Kategoriya qo‘shish',
    addProduct: 'Mahsulot qo‘shish',
    edit: 'Tahrirlash',
    active: 'Faol',
    inactive: 'Faol emas',
    deactivate: 'O‘chirish',
    activate: 'Faollashtirish',
    categoryName: 'Kategoriya nomi',
    description: 'Tavsif',
    save: 'Saqlash',
    saving: 'Saqlanmoqda…',
    cancel: 'Bekor qilish',
    productName: 'Mahsulot nomi',
    category: 'Kategoriya',
    sku: 'SKU',
    price: 'Narx',
    stock: 'Stok',
    currency: 'Valyuta',
    total: (count) => `${count} jami`,
    basicInformation: 'Asosiy ma’lumot',
    categoryAvailability: 'Kategoriya va mavjudlik',
    pricingInventory: 'Narx va inventar',
    variantOptions: 'Variant opsiyalari',
    noDescription: 'Tavsif kiritilmagan.',
    nameHint:
      'Nomni odatdagidek kiriting. Mehmonlar uni barcha tillarda aynan shu ko‘rinishda ko‘radi.',
    descriptionOptional: 'Ixtiyoriy',
    textSameAcrossLanguages:
      'Bu matn tarjima qilinmaydi va barcha tillarda aynan shu ko‘rinishda chiqadi.',
    variantDetails: 'Variant ma’lumotlari',
    optionName: 'Opsiya nomi',
    optionValue: 'Opsiya qiymati',
    addOption: 'Opsiya qo‘shish',
    removeOption: 'Opsiyani o‘chirish',
    noOptions: 'Opsiya yo‘q. Agar kerak bo‘lsa, qo‘shing.',
    requiredField: 'Bu maydon to‘ldirilishi kerak.',
    invalidPrice: 'Narx nol yoki undan katta bo‘lishi kerak.',
    invalidStock: 'Stok butun son va nol yoki undan katta bo‘lishi kerak.',
    invalidCategory: 'Kategoriyani tanlang.',
    duplicateSku: 'Bu SKU allaqachon mavjud.',
    duplicateOption: 'Bir variant ichida opsiya nomlari takrorlanmasligi kerak.',
    uploadImage: 'Rasm yuklash',
    create: 'Yaratish',
    update: 'Yangilash',
    variants: 'Variantlar',
    available: 'Mavjud',
    reserved: 'Band qilingan',
    addVariant: 'Variant qo‘shish',
    adjustStock: 'Stokni o‘zgartirish',
    stockAdjustment: 'Stokni o‘zgartirish',
    stockAdjustmentDescription: 'O‘zgarish miqdorini kiriting va sababni yozib qoldiring.',
    delta: 'O‘zgarish',
    reason: 'Sabab',
    reasonPlaceholder: 'Masalan: yangi kelgan mahsulot',
    apply: 'Qo‘llash',
    invalidStockChange: 'O‘zgarish butun son va nolga teng bo‘lmasligi kerak.',
    noCategories: 'Kategoriya yo‘q',
    noProducts: 'Mahsulot yo‘q',
    loading: 'Yuklanmoqda…',
    error: 'Ma’lumotni yuklashda xatolik yuz berdi.',
    retry: 'Qayta urinish',
    realtimeUpdated: 'Buyurtma yoki katalog yangilandi.',
    sessionExpired: 'Sessiya tugagan. Qayta kiring.',
    requestNote: 'Izoh',
    skuLabel: 'SKU',
    roomOrder: (room) => `Xona ${room}`,
    itemSummary: (count) => `${count} ta mahsulot`,
    expiresAt: (value) => `Muddati: ${value}`,
  },
  ru: {
    administration: 'Управление',
    orders: 'Заказы',
    catalog: 'Каталог',
    workspace: 'Butik Indonesia',
    ordersSubtitle: 'Управляйте заказами из номеров и контролируйте остатки.',
    catalogSubtitle: 'Управляйте товарами, вариантами, изображениями и остатками.',
    refresh: 'Обновить',
    refreshing: 'Обновление…',
    newOrders: 'Новые',
    inProcess: 'В работе',
    completed: 'Завершённые',
    cancelled: 'Отменённые',
    activeStock: 'Доступный остаток',
    lowStock: 'Мало на складе',
    outOfStock: 'Нет в наличии',
    activeQueue: 'Активная очередь',
    history: 'История',
    allActive: 'Все активные',
    room: 'Номер',
    guest: 'Гость',
    requested: 'Время заказа',
    status: 'Статус',
    expiry: 'Срок',
    items: 'Товары',
    actions: 'Действия',
    open: 'Открыть',
    confirm: 'Подтвердить',
    complete: 'Завершить',
    cancelOrder: 'Отменить',
    cancelReason: 'Причина отмены',
    cancelReasonPlaceholder: 'Введите причину',
    close: 'Закрыть',
    noOrders: 'Заказов нет',
    noOrdersDescription: 'В этом разделе пока нет заказов.',
    categories: 'Категории',
    products: 'Товары',
    addCategory: 'Добавить категорию',
    addProduct: 'Добавить товар',
    edit: 'Изменить',
    active: 'Активен',
    inactive: 'Неактивен',
    deactivate: 'Отключить',
    activate: 'Активировать',
    categoryName: 'Название категории',
    description: 'Описание',
    save: 'Сохранить',
    saving: 'Сохранение…',
    cancel: 'Отмена',
    productName: 'Название товара',
    category: 'Категория',
    sku: 'SKU',
    price: 'Цена',
    stock: 'Остаток',
    currency: 'Валюта',
    total: (count) => `${count} всего`,
    basicInformation: 'Основная информация',
    categoryAvailability: 'Категория и доступность',
    pricingInventory: 'Цена и остатки',
    variantOptions: 'Опции варианта',
    noDescription: 'Описание не добавлено.',
    nameHint: 'Введите название как обычно. Гости увидят его одинаково на всех языках.',
    descriptionOptional: 'Необязательно',
    textSameAcrossLanguages: 'Этот текст не переводится и отображается одинаково на всех языках.',
    variantDetails: 'Данные варианта',
    optionName: 'Название опции',
    optionValue: 'Значение опции',
    addOption: 'Добавить опцию',
    removeOption: 'Удалить опцию',
    noOptions: 'Опций нет. При необходимости добавьте их.',
    requiredField: 'Заполните это поле.',
    invalidPrice: 'Цена должна быть нулевой или больше.',
    invalidStock: 'Остаток должен быть целым числом не меньше нуля.',
    invalidCategory: 'Выберите категорию.',
    duplicateSku: 'Этот SKU уже используется.',
    duplicateOption: 'Названия опций внутри варианта не должны повторяться.',
    uploadImage: 'Загрузить изображение',
    create: 'Создать',
    update: 'Обновить',
    variants: 'Варианты',
    available: 'Доступно',
    reserved: 'Зарезервировано',
    addVariant: 'Добавить вариант',
    adjustStock: 'Изменить остаток',
    stockAdjustment: 'Изменение остатка',
    stockAdjustmentDescription: 'Укажите количество изменения и обязательно добавьте причину.',
    delta: 'Изменение',
    reason: 'Причина',
    reasonPlaceholder: 'Например: новое поступление',
    apply: 'Применить',
    invalidStockChange: 'Изменение должно быть целым числом, отличным от нуля.',
    noCategories: 'Категорий нет',
    noProducts: 'Товаров нет',
    loading: 'Загрузка…',
    error: 'Не удалось загрузить данные.',
    retry: 'Повторить',
    realtimeUpdated: 'Заказ или каталог обновлён.',
    sessionExpired: 'Сессия истекла. Войдите снова.',
    requestNote: 'Комментарий',
    skuLabel: 'SKU',
    roomOrder: (room) => `Номер ${room}`,
    itemSummary: (count) => `${count} товар(ов)`,
    expiresAt: (value) => `Срок: ${value}`,
  },
  en: {
    administration: 'Administration',
    orders: 'Orders',
    catalog: 'Catalog',
    workspace: 'Butik Indonesia',
    ordersSubtitle: 'Manage room orders and keep inventory precise.',
    catalogSubtitle: 'Manage products, variants, imagery, and stock.',
    refresh: 'Refresh',
    refreshing: 'Refreshing…',
    newOrders: 'New',
    inProcess: 'In process',
    completed: 'Completed',
    cancelled: 'Cancelled',
    activeStock: 'Available stock',
    lowStock: 'Low stock',
    outOfStock: 'Out of stock',
    activeQueue: 'Active queue',
    history: 'History',
    allActive: 'All active',
    room: 'Room',
    guest: 'Guest',
    requested: 'Ordered',
    status: 'Status',
    expiry: 'Expiry',
    items: 'Items',
    actions: 'Actions',
    open: 'Open',
    confirm: 'Confirm',
    complete: 'Complete',
    cancelOrder: 'Cancel order',
    cancelReason: 'Cancellation reason',
    cancelReasonPlaceholder: 'Enter a reason',
    close: 'Close',
    noOrders: 'No orders',
    noOrdersDescription: 'There are no orders in this section yet.',
    categories: 'Categories',
    products: 'Products',
    addCategory: 'Add category',
    addProduct: 'Add product',
    edit: 'Edit',
    active: 'Active',
    inactive: 'Inactive',
    deactivate: 'Deactivate',
    activate: 'Activate',
    categoryName: 'Category name',
    description: 'Description',
    save: 'Save',
    saving: 'Saving…',
    cancel: 'Cancel',
    productName: 'Product name',
    category: 'Category',
    sku: 'SKU',
    price: 'Price',
    stock: 'Stock',
    currency: 'Currency',
    total: (count) => `${count} total`,
    basicInformation: 'Basic information',
    categoryAvailability: 'Category and availability',
    pricingInventory: 'Pricing and inventory',
    variantOptions: 'Variant options',
    noDescription: 'No description added.',
    nameHint: 'Enter the name normally. Guests will see it exactly the same in every language.',
    descriptionOptional: 'Optional',
    textSameAcrossLanguages: 'This text is not translated and appears the same in every language.',
    variantDetails: 'Variant details',
    optionName: 'Option name',
    optionValue: 'Option value',
    addOption: 'Add option',
    removeOption: 'Remove option',
    noOptions: 'No options. Add one if this product needs it.',
    requiredField: 'This field is required.',
    invalidPrice: 'Price must be zero or greater.',
    invalidStock: 'Stock must be a whole number of zero or greater.',
    invalidCategory: 'Choose a category.',
    duplicateSku: 'This SKU is already in use.',
    duplicateOption: 'Option names must be unique within a variant.',
    uploadImage: 'Upload image',
    create: 'Create',
    update: 'Update',
    variants: 'Variants',
    available: 'Available',
    reserved: 'Reserved',
    addVariant: 'Add variant',
    adjustStock: 'Adjust stock',
    stockAdjustment: 'Adjust stock',
    stockAdjustmentDescription: 'Enter the quantity change and record a reason for the adjustment.',
    delta: 'Change',
    reason: 'Reason',
    reasonPlaceholder: 'For example: new delivery',
    apply: 'Apply',
    invalidStockChange: 'Change must be a non-zero whole number.',
    noCategories: 'No categories',
    noProducts: 'No products',
    loading: 'Loading…',
    error: 'Could not load data.',
    retry: 'Retry',
    realtimeUpdated: 'Order or catalog updated.',
    sessionExpired: 'Session expired. Sign in again.',
    requestNote: 'Note',
    skuLabel: 'SKU',
    roomOrder: (room) => `Room ${room}`,
    itemSummary: (count) => `${count} item(s)`,
    expiresAt: (value) => `Expires: ${value}`,
  },
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

function formatDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(
    language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB',
    {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
}

function formatMoney(value: number, currency: string, language: Language): string {
  return `${new Intl.NumberFormat(language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB', { maximumFractionDigits: 2 }).format(value)} ${currency}`;
}

function mediaUrl(mediaId: string | null): string | null {
  return mediaId === null ? null : `${API_BASE_URL}/media/${encodeURIComponent(mediaId)}`;
}

function localizedText(value: { uz: string; ru: string; en: string }, language: Language): string {
  return value[language] || value.en || value.ru || value.uz;
}

function variantSummary(variant: BoutiqueVariant, language: Language): string {
  return (
    variant.options
      .map((option) => {
        const value = localizedText(option.value, language);
        const label = localizedText(option.label, language);
        return label.length > 0 && value.length > 0 ? `${label}: ${value}` : value || label;
      })
      .filter((value) => value.length > 0)
      .join(' · ') || variant.sku
  );
}

function statusClass(status: StaffRequest['status']): string {
  return status === 'NEW'
    ? 'is-new'
    : status === 'IN_PROCESS'
      ? 'is-in-process'
      : status === 'COMPLETED'
        ? 'is-completed'
        : 'is-cancelled';
}

function localizedDraft(value: { uz: string; ru: string; en: string } | null | undefined) {
  return textDraftFromLocalized(value);
}

function ButikHeader({
  copy,
  activePage,
  onNavigate,
}: {
  copy: ButikCopy;
  activePage: 'orders' | 'catalog';
  onNavigate: (page: 'orders' | 'catalog') => void;
}) {
  return (
    <>
      <aside className="admin-sidebar butik-sidebar">
        <div className="admin-sidebar__brand">
          <AdminBrandMark />
          <div>
            <strong>Butik Indonesia</strong>
            <span>{copy.administration}</span>
          </div>
        </div>
        <div className="admin-sidebar__rule" />
        <p className="admin-sidebar__label">{copy.workspace}</p>
        <nav aria-label={copy.workspace} className="admin-sidebar__nav">
          <button
            className={`admin-nav-item ${activePage === 'orders' ? 'is-active' : ''}`}
            onClick={() => onNavigate('orders')}
            type="button"
          >
            <OrdersIcon />
            <span>{copy.orders}</span>
            <ArrowIcon direction="right" />
          </button>
          <button
            className={`admin-nav-item ${activePage === 'catalog' ? 'is-active' : ''}`}
            onClick={() => onNavigate('catalog')}
            type="button"
          >
            <MenuIcon />
            <span>{copy.catalog}</span>
            <ArrowIcon direction="right" />
          </button>
        </nav>
        <div className="butik-sidebar__note">
          <span className="butik-sidebar__dot" />
          {copy.workspace}
        </div>
      </aside>
    </>
  );
}

function ButikTopbar({
  copy,
  authCopy,
  language,
  onLanguageChange,
  onSignOut,
  user,
  activePage,
}: {
  copy: ButikCopy;
  authCopy: AuthCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onSignOut: () => void;
  user: StaffUser;
  activePage: 'orders' | 'catalog';
}) {
  return (
    <header className="admin-topbar">
      <div className="admin-breadcrumb">
        <span>{copy.administration}</span>
        <ArrowIcon direction="right" />
        <strong>{activePage === 'orders' ? copy.orders : copy.catalog}</strong>
      </div>
      <div className="admin-topbar__actions">
        <StaffRealtimeIndicator language={language} />
        <AdminLanguageSwitcher
          authCopy={authCopy}
          language={language}
          onChange={onLanguageChange}
        />
        <div className="admin-topbar__user">
          <span className="admin-avatar admin-avatar--small">{getInitials(user.displayName)}</span>
          <span>
            <strong>{user.displayName}</strong>
            <small>{copy.workspace}</small>
          </span>
        </div>
        <button className="admin-signout" onClick={onSignOut} type="button">
          {authCopy.signOut}
        </button>
      </div>
    </header>
  );
}

function OrderStatus({ status, copy }: { status: StaffRequest['status']; copy: ButikCopy }) {
  const label =
    status === 'NEW'
      ? copy.newOrders
      : status === 'IN_PROCESS'
        ? copy.inProcess
        : status === 'COMPLETED'
          ? copy.completed
          : copy.cancelled;
  return <span className={`butik-status ${statusClass(status)}`}>{label}</span>;
}

function OrdersPage({
  copy,
  language,
  orders,
  loading,
  refreshing,
  lowStock,
  onRefresh,
  onTransition,
  onOpen,
  selectedOrder,
  onClose,
  cancelReason,
  onCancelReasonChange,
  onCancel,
  highlightedOrderIds,
}: {
  copy: ButikCopy;
  language: Language;
  orders: StaffRequest[];
  loading: boolean;
  refreshing: boolean;
  lowStock: number;
  onRefresh: () => void;
  onTransition: (order: StaffRequest, next: 'IN_PROCESS' | 'COMPLETED') => void;
  onOpen: (order: StaffRequest) => void;
  selectedOrder: StaffRequest | null;
  onClose: () => void;
  cancelReason: string;
  onCancelReasonChange: (value: string) => void;
  onCancel: () => void;
  highlightedOrderIds: Set<string>;
}) {
  const [filter, setFilter] = useState<OrderFilter>('ACTIVE');
  const activeOrders = orders.filter(
    (order) => order.status === 'NEW' || order.status === 'IN_PROCESS',
  );
  const visible =
    filter === 'ACTIVE'
      ? activeOrders
      : orders.filter(
          (order) => order.status === (filter === 'COMPLETED' ? 'COMPLETED' : 'CANCELLED'),
        );
  const counts = {
    new: orders.filter((order) => order.status === 'NEW').length,
    inProcess: orders.filter((order) => order.status === 'IN_PROCESS').length,
    completed: orders.filter((order) => order.status === 'COMPLETED').length,
    cancelled: orders.filter((order) => order.status === 'CANCELLED').length,
  };
  return (
    <main className="admin-content butik-content">
      <div className="admin-page-heading butik-heading">
        <div>
          <p className="admin-eyebrow">{copy.workspace}</p>
          <h1>{copy.orders}</h1>
          <p>{copy.ordersSubtitle}</p>
        </div>
        <button
          className="admin-button"
          disabled={loading || refreshing}
          onClick={onRefresh}
          type="button"
        >
          {loading || refreshing ? copy.refreshing : copy.refresh}
        </button>
      </div>
      <section className="butik-stat-grid" aria-label={copy.orders}>
        <div className="butik-stat-card">
          <span>{copy.newOrders}</span>
          <strong>{counts.new}</strong>
          <small>{copy.activeQueue}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.inProcess}</span>
          <strong>{counts.inProcess}</strong>
          <small>{copy.activeQueue}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.lowStock}</span>
          <strong className={lowStock > 0 ? 'is-warn' : ''}>{lowStock}</strong>
          <small>{copy.activeStock}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.completed}</span>
          <strong>{counts.completed}</strong>
          <small>{copy.history}</small>
        </div>
      </section>
      <div className="butik-tabs" role="tablist">
        <button
          className={filter === 'ACTIVE' ? 'is-active' : ''}
          onClick={() => setFilter('ACTIVE')}
          role="tab"
          type="button"
        >
          {copy.allActive}
          <b>{activeOrders.length}</b>
        </button>
        <button
          className={filter === 'COMPLETED' ? 'is-active' : ''}
          onClick={() => setFilter('COMPLETED')}
          role="tab"
          type="button"
        >
          {copy.completed}
          <b>{counts.completed}</b>
        </button>
        <button
          className={filter === 'CANCELLED' ? 'is-active' : ''}
          onClick={() => setFilter('CANCELLED')}
          role="tab"
          type="button"
        >
          {copy.cancelled}
          <b>{counts.cancelled}</b>
        </button>
      </div>
      <section className="butik-panel">
        <div className="butik-panel__header">
          <div>
            <p className="admin-eyebrow">{filter === 'ACTIVE' ? copy.activeQueue : copy.history}</p>
            <h2>
              {filter === 'ACTIVE'
                ? copy.orders
                : filter === 'COMPLETED'
                  ? copy.completed
                  : copy.cancelled}
            </h2>
          </div>
          <span className="butik-panel__count">{visible.length}</span>
        </div>
        {loading ? (
          <div className="butik-empty">
            <span className="butik-spinner" />
            <p>{copy.loading}</p>
          </div>
        ) : visible.length === 0 ? (
          <div className="butik-empty">
            <div className="butik-empty__mark">—</div>
            <h3>{copy.noOrders}</h3>
            <p>{copy.noOrdersDescription}</p>
          </div>
        ) : (
          <div className="butik-order-list">
            {visible.map((order) => (
              <article
                className={
                  highlightedOrderIds.has(order.id)
                    ? 'butik-order-row is-realtime-highlighted'
                    : 'butik-order-row'
                }
                key={order.id}
              >
                <div className="butik-order-main">
                  <div className="butik-order-kicker">
                    <span className="butik-order-id">#{order.id.slice(0, 8)}</span>
                    <OrderStatus copy={copy} status={order.status} />
                    <span>{formatDate(order.requestedAt, language)}</span>
                  </div>
                  <h3>
                    {copy.roomOrder(order.room.number)} <span>·</span>{' '}
                    {order.items
                      .map((item) => localizedText(item.localizedName, language))
                      .join(', ')}
                  </h3>
                  <p>
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)}{' '}
                    {copy.items.toLocaleLowerCase()} ·{' '}
                    {order.items
                      .map((item) =>
                        item.variantId === null || item.variantId === undefined
                          ? ''
                          : `${item.sku ?? ''}`,
                      )
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                </div>
                <div className="butik-order-meta">
                  <strong>{order.guestName ?? '—'}</strong>
                  <span>{order.guestNote ?? '—'}</span>
                  {order.reservationExpiresAt !== null && order.status === 'NEW' && (
                    <small>
                      {copy.expiresAt(formatDate(order.reservationExpiresAt, language))}
                    </small>
                  )}
                </div>
                <div className="butik-order-actions">
                  <button
                    className="admin-button admin-button--quiet"
                    onClick={() => onOpen(order)}
                    type="button"
                  >
                    {copy.open}
                  </button>
                  {order.status === 'NEW' && (
                    <button
                      className="admin-button admin-button--primary"
                      onClick={() => onTransition(order, 'IN_PROCESS')}
                      type="button"
                    >
                      {copy.confirm}
                    </button>
                  )}
                  {order.status === 'IN_PROCESS' && (
                    <button
                      className="admin-button admin-button--primary"
                      onClick={() => onTransition(order, 'COMPLETED')}
                      type="button"
                    >
                      {copy.complete}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      {selectedOrder !== null && (
        <div className="butik-drawer-backdrop" onMouseDown={onClose}>
          <aside
            aria-label={copy.open}
            className="butik-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="butik-drawer__header">
              <div>
                <p className="admin-eyebrow">#{selectedOrder.id.slice(0, 8)}</p>
                <h2>{copy.roomOrder(selectedOrder.room.number)}</h2>
              </div>
              <button className="admin-icon-button" onClick={onClose} type="button">
                ×
              </button>
            </div>
            <div className="butik-drawer__body">
              <div className="butik-detail-grid">
                <div>
                  <span>{copy.guest}</span>
                  <strong>{selectedOrder.guestName ?? '—'}</strong>
                </div>
                <div>
                  <span>{copy.requested}</span>
                  <strong>{formatDate(selectedOrder.requestedAt, language)}</strong>
                </div>
                <div>
                  <span>{copy.status}</span>
                  <strong>
                    <OrderStatus copy={copy} status={selectedOrder.status} />
                  </strong>
                </div>
              </div>
              <div className="butik-detail-section">
                <p className="admin-eyebrow">{copy.items}</p>
                {selectedOrder.items.map((item, index) => (
                  <div
                    className="butik-line-item"
                    key={`${item.menuItemId}-${item.variantId ?? index}`}
                  >
                    <div>
                      <strong>{localizedText(item.localizedName, language)}</strong>
                      <small>
                        {item.variantOptions !== null && item.variantOptions !== undefined
                          ? item.variantOptions
                              .map((option) => {
                                const value = localizedText(option.value, language);
                                const label = localizedText(option.label, language);
                                return label.length > 0 && value.length > 0
                                  ? `${label}: ${value}`
                                  : value || label;
                              })
                              .filter((value) => value.length > 0)
                              .join(' · ')
                          : (item.sku ?? item.variantId ?? '')}
                        {item.note ? ` · ${item.note}` : ''}
                      </small>
                    </div>
                    <b>×{item.quantity}</b>
                  </div>
                ))}
              </div>
              {selectedOrder.guestNote !== null && (
                <div className="butik-note">
                  <span>{copy.requestNote}</span>
                  <p>{selectedOrder.guestNote}</p>
                </div>
              )}
              {selectedOrder.status !== 'COMPLETED' && selectedOrder.status !== 'CANCELLED' && (
                <div className="butik-cancel-box">
                  <label htmlFor="butik-cancel-reason">{copy.cancelReason}</label>
                  <textarea
                    id="butik-cancel-reason"
                    onChange={(event) => onCancelReasonChange(event.target.value)}
                    placeholder={copy.cancelReasonPlaceholder}
                    value={cancelReason}
                  />
                  <button
                    className="admin-button butik-button--danger"
                    onClick={onCancel}
                    type="button"
                  >
                    {copy.cancelOrder}
                  </button>
                </div>
              )}
            </div>
            <div className="butik-drawer__footer">
              <button className="admin-button" onClick={onClose} type="button">
                {copy.close}
              </button>
              {selectedOrder.status === 'NEW' && (
                <button
                  className="admin-button admin-button--primary"
                  onClick={() => onTransition(selectedOrder, 'IN_PROCESS')}
                  type="button"
                >
                  {copy.confirm}
                </button>
              )}
              {selectedOrder.status === 'IN_PROCESS' && (
                <button
                  className="admin-button admin-button--primary"
                  onClick={() => onTransition(selectedOrder, 'COMPLETED')}
                  type="button"
                >
                  {copy.complete}
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

function BoutiqueTextField({
  label,
  value,
  onChange,
  multiline = false,
  optional = false,
  optionalLabel = 'optional',
  hint,
}: {
  label: string;
  value: BoutiqueTextDraft;
  onChange: (value: string) => void;
  multiline?: boolean;
  optional?: boolean;
  optionalLabel?: string;
  hint?: string;
}) {
  return (
    <label className={`butik-field ${multiline ? 'butik-field--wide' : ''}`}>
      <span>
        {label}
        {optional && <small> · {optionalLabel}</small>}
      </span>
      {multiline ? (
        <textarea onChange={(event) => onChange(event.target.value)} value={value.value} />
      ) : (
        <input onChange={(event) => onChange(event.target.value)} required value={value.value} />
      )}
      {hint !== undefined && <small className="butik-field__hint">{hint}</small>}
    </label>
  );
}

function CategoryPanel({
  copy,
  language,
  categories,
  formError,
  mode,
  draft,
  onAdd,
  onEdit,
  onDraftChange,
  onSave,
  onCancel,
  onToggle,
}: {
  copy: ButikCopy;
  language: Language;
  categories: BoutiqueCategory[];
  formError: string;
  mode: CatalogueMode;
  draft: { name: BoutiqueTextDraft; description: BoutiqueTextDraft };
  onAdd: () => void;
  onEdit: (category: BoutiqueCategory) => void;
  onDraftChange: (draft: { name: BoutiqueTextDraft; description: BoutiqueTextDraft }) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onToggle: (category: BoutiqueCategory) => void;
}) {
  const formOpen = mode === 'create-category' || mode === 'edit-category';
  return (
    <section className="butik-panel butik-catalog-panel">
      <div className="butik-panel__header">
        <div>
          <p className="admin-eyebrow">{copy.catalog}</p>
          <h2>{copy.categories}</h2>
        </div>
        <button className="admin-button admin-button--primary" onClick={onAdd} type="button">
          + {copy.addCategory}
        </button>
      </div>
      {formOpen && (
        <div className="butik-form-overlay" onMouseDown={onCancel}>
          <aside
            aria-label={mode === 'edit-category' ? copy.update : copy.addCategory}
            className="butik-form-drawer"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="butik-form-drawer__header">
              <div>
                <p className="admin-eyebrow">{copy.categories}</p>
                <h3>{mode === 'edit-category' ? copy.update : copy.addCategory}</h3>
              </div>
              <button className="butik-icon-button" onClick={onCancel} type="button">
                ×
              </button>
            </div>
            <form className="butik-form butik-form--drawer" onSubmit={onSave}>
              <div className="butik-form-section">
                <p className="butik-form-section__eyebrow">{copy.basicInformation}</p>
                <BoutiqueTextField
                  hint={copy.textSameAcrossLanguages}
                  label={copy.categoryName}
                  onChange={(name) =>
                    onDraftChange({ ...draft, name: updateTextDraft(draft.name, name) })
                  }
                  value={draft.name}
                />
                <BoutiqueTextField
                  label={copy.description}
                  multiline
                  onChange={(description) =>
                    onDraftChange({
                      ...draft,
                      description: updateTextDraft(draft.description, description),
                    })
                  }
                  optional
                  optionalLabel={copy.descriptionOptional}
                  value={draft.description}
                />
              </div>
              {formError.length > 0 && (
                <p className="butik-form-error" role="alert">
                  {formError}
                </p>
              )}
              <div className="butik-form__actions">
                <button className="admin-button" onClick={onCancel} type="button">
                  {copy.cancel}
                </button>
                <button className="admin-button admin-button--primary" type="submit">
                  {mode === 'edit-category' ? copy.update : copy.create}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
      <div className="butik-category-list">
        {categories.length === 0 ? (
          <p className="butik-muted">{copy.noCategories}</p>
        ) : (
          categories.map((category) => (
            <div className="butik-category-row" key={category.id}>
              <div>
                <strong>{localizedText(category.localizedName, language)}</strong>
                <small>
                  {category.localizedDescription
                    ? localizedText(category.localizedDescription, language)
                    : copy.textSameAcrossLanguages}
                </small>
              </div>
              <span className={`butik-state ${category.active ? 'is-active' : ''}`}>
                {category.active ? copy.active : copy.inactive}
              </span>
              <div className="butik-row-actions">
                <button
                  className="admin-button admin-button--quiet"
                  onClick={() => onEdit(category)}
                  type="button"
                >
                  {copy.edit}
                </button>
                <button
                  className="admin-button admin-button--quiet"
                  onClick={() => onToggle(category)}
                  type="button"
                >
                  {category.active ? copy.deactivate : copy.activate}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function ProductForm({
  copy,
  language,
  categories,
  formError,
  mode,
  draft,
  selectedImage,
  onDraftChange,
  onSave,
  onCancel,
  onImageChange,
}: {
  copy: ButikCopy;
  language: Language;
  categories: BoutiqueCategory[];
  formError: string;
  mode: CatalogueMode;
  draft: ProductDraft;
  selectedImage: File | undefined;
  onDraftChange: (draft: ProductDraft) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
  onImageChange: (file: File | undefined) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (selectedImage === undefined) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(selectedImage);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedImage]);

  function updateVariant(update: Partial<VariantDraft>) {
    onDraftChange({ ...draft, variant: { ...draft.variant, ...update } });
  }

  function updateOption(index: number, update: Partial<VariantOptionDraft>) {
    const options = draft.variant.options.map((option, optionIndex) =>
      optionIndex === index ? { ...option, ...update } : option,
    );
    updateVariant({ options });
  }

  function addOption() {
    updateVariant({
      options: [
        ...draft.variant.options,
        { id: `option-${Date.now()}`, code: '', label: '', value: '' },
      ],
    });
  }

  function removeOption(index: number) {
    updateVariant({
      options: draft.variant.options.filter((_, optionIndex) => optionIndex !== index),
    });
  }

  return (
    <div className="butik-form-overlay" onMouseDown={onCancel}>
      <aside
        aria-label={mode === 'edit-product' ? copy.update : copy.addProduct}
        className="butik-form-drawer butik-product-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="butik-form-drawer__header">
          <div>
            <p className="admin-eyebrow">{copy.products}</p>
            <h3>{mode === 'edit-product' ? copy.update : copy.addProduct}</h3>
          </div>
          <button className="butik-icon-button" onClick={onCancel} type="button">
            ×
          </button>
        </div>
        <form className="butik-form butik-form--drawer" onSubmit={onSave}>
          <div className="butik-form-section">
            <p className="butik-form-section__eyebrow">{copy.basicInformation}</p>
            <BoutiqueTextField
              hint={copy.nameHint}
              label={copy.productName}
              onChange={(name) =>
                onDraftChange({ ...draft, name: updateTextDraft(draft.name, name) })
              }
              value={draft.name}
            />
            <BoutiqueTextField
              label={copy.description}
              multiline
              onChange={(description) =>
                onDraftChange({
                  ...draft,
                  description: updateTextDraft(draft.description, description),
                })
              }
              optional
              optionalLabel={copy.descriptionOptional}
              value={draft.description}
            />
          </div>

          <div className="butik-form-section">
            <p className="butik-form-section__eyebrow">{copy.categoryAvailability}</p>
            <div className="butik-form-grid">
              <label>
                <span>{copy.category}</span>
                <select
                  onChange={(event) => onDraftChange({ ...draft, categoryId: event.target.value })}
                  required
                  value={draft.categoryId}
                >
                  <option value="">—</option>
                  {categories
                    .filter((category) => category.active || category.id === draft.categoryId)
                    .map((category) => (
                      <option key={category.id} value={category.id}>
                        {localizedText(category.localizedName, language)}
                      </option>
                    ))}
                </select>
              </label>
              <label className="butik-check-field">
                <input
                  checked={draft.available}
                  onChange={(event) => onDraftChange({ ...draft, available: event.target.checked })}
                  type="checkbox"
                />
                <span>{copy.active}</span>
              </label>
            </div>
          </div>

          <fieldset className="butik-form-section" disabled={mode === 'edit-product'}>
            <legend className="butik-form-section__eyebrow">{copy.pricingInventory}</legend>
            <div className="butik-form-grid">
              <label>
                <span>{copy.sku}</span>
                <input
                  onChange={(event) => updateVariant({ sku: event.target.value })}
                  required
                  value={draft.variant.sku}
                />
              </label>
              <label>
                <span>{copy.price}</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => updateVariant({ price: event.target.value })}
                  required
                  type="number"
                  value={draft.variant.price}
                />
              </label>
              <label>
                <span>{copy.currency}</span>
                <input
                  maxLength={3}
                  onChange={(event) =>
                    updateVariant({ currency: event.target.value.toUpperCase() })
                  }
                  required
                  value={draft.variant.currency}
                />
              </label>
              <label>
                <span>{copy.stock}</span>
                <input
                  inputMode="numeric"
                  min="0"
                  onChange={(event) => updateVariant({ stock: event.target.value })}
                  required
                  type="number"
                  value={draft.variant.stock}
                />
              </label>
            </div>
            <VariantOptionsEditor
              copy={copy}
              disabled={mode === 'edit-product'}
              onAdd={addOption}
              onChange={updateOption}
              onRemove={removeOption}
              options={draft.variant.options}
            />
          </fieldset>

          <div className="butik-form-section">
            <p className="butik-form-section__eyebrow">{copy.uploadImage}</p>
            <label className="butik-file-field">
              <span>{copy.uploadImage}</span>
              <input
                accept="image/jpeg,image/png,image/webp,image/avif"
                onChange={(event) => onImageChange(event.target.files?.[0])}
                type="file"
              />
            </label>
            {previewUrl !== null && <img alt="" className="butik-image-preview" src={previewUrl} />}
          </div>

          {formError.length > 0 && (
            <p className="butik-form-error" role="alert">
              {formError}
            </p>
          )}

          <div className="butik-form__actions">
            <button className="admin-button" onClick={onCancel} type="button">
              {copy.cancel}
            </button>
            <button className="admin-button admin-button--primary" type="submit">
              {mode === 'edit-product' ? copy.update : copy.create}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

interface ProductDraft {
  name: BoutiqueTextDraft;
  description: BoutiqueTextDraft;
  categoryId: string;
  variant: VariantDraft;
  available: boolean;
}

function emptyProduct(categoryId = ''): ProductDraft {
  return {
    name: textDraftFromLocalized(null),
    description: textDraftFromLocalized(null),
    categoryId,
    variant: {
      sku: '',
      price: '',
      currency: 'UZS',
      stock: '0',
      options: [],
    },
    available: true,
  };
}

function VariantOptionsEditor({
  copy,
  options,
  disabled = false,
  onAdd,
  onChange,
  onRemove,
}: {
  copy: ButikCopy;
  options: VariantOptionDraft[];
  disabled?: boolean;
  onAdd: () => void;
  onChange: (index: number, update: Partial<VariantOptionDraft>) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="butik-options-editor">
      <div className="butik-options-editor__header">
        <div>
          <strong>{copy.variantOptions}</strong>
          <small>{copy.textSameAcrossLanguages}</small>
        </div>
        <button
          className="admin-button admin-button--quiet"
          disabled={disabled}
          onClick={onAdd}
          type="button"
        >
          + {copy.addOption}
        </button>
      </div>
      {options.length === 0 ? (
        <p className="butik-options-editor__empty">{copy.noOptions}</p>
      ) : (
        <div className="butik-option-list">
          {options.map((option, index) => (
            <div className="butik-option-row" key={option.id}>
              <label>
                <span>{copy.optionName}</span>
                <input
                  disabled={disabled}
                  onChange={(event) => onChange(index, { label: event.target.value })}
                  required
                  value={option.label}
                />
              </label>
              <label>
                <span>{copy.optionValue}</span>
                <input
                  disabled={disabled}
                  onChange={(event) => onChange(index, { value: event.target.value })}
                  required
                  value={option.value}
                />
              </label>
              <button
                aria-label={copy.removeOption}
                className="butik-icon-button butik-option-remove"
                disabled={disabled}
                onClick={() => onRemove(index)}
                type="button"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductCard({
  copy,
  language,
  product,
  onEdit,
  onToggle,
  onStock,
  onAddVariant,
  onEditVariant,
  onToggleVariant,
}: {
  copy: ButikCopy;
  language: Language;
  product: BoutiqueProduct;
  onEdit: (product: BoutiqueProduct) => void;
  onToggle: (product: BoutiqueProduct) => void;
  onStock: (variant: BoutiqueVariant) => void;
  onAddVariant: (product: BoutiqueProduct) => void;
  onEditVariant: (product: BoutiqueProduct, variant: BoutiqueVariant) => void;
  onToggleVariant: (variant: BoutiqueVariant) => void;
}) {
  const image = mediaUrl(product.item.imageMediaId);
  return (
    <article className="butik-product-card">
      <div className="butik-product-card__top">
        {image === null ? (
          <div className="butik-product-image butik-product-image--empty">BI</div>
        ) : (
          <img alt="" className="butik-product-image" src={image} />
        )}
        <div className="butik-product-card__title">
          <p className="admin-eyebrow">{localizedText(product.category.localizedName, language)}</p>
          <h3>{localizedText(product.item.localizedName, language)}</h3>
          <span>
            {product.item.localizedDescription
              ? localizedText(product.item.localizedDescription, language)
              : copy.noDescription}
          </span>
        </div>
        <span
          className={`butik-state ${product.item.active && product.item.available ? 'is-active' : ''}`}
        >
          {product.item.active && product.item.available ? copy.active : copy.inactive}
        </span>
      </div>
      <div className="butik-product-card__tools">
        <button
          className="admin-button admin-button--quiet"
          onClick={() => onEdit(product)}
          type="button"
        >
          {copy.edit}
        </button>
        <button
          className="admin-button admin-button--quiet"
          onClick={() => onToggle(product)}
          type="button"
        >
          {product.item.active ? copy.deactivate : copy.activate}
        </button>
        <button
          className="admin-button admin-button--quiet"
          onClick={() => onAddVariant(product)}
          type="button"
        >
          + {copy.addVariant}
        </button>
      </div>
      <div className="butik-variant-table">
        <div className="butik-variant-table__head">
          <span>{copy.variants}</span>
          <span>{copy.sku}</span>
          <span>{copy.price}</span>
          <span>{copy.available}</span>
          <span>{copy.reserved}</span>
          <span>{copy.actions}</span>
        </div>
        {product.variants.map((variant) => (
          <div className="butik-variant-row" key={variant.id}>
            <span>{variantSummary(variant, language)}</span>
            <span className="butik-mono">{variant.sku}</span>
            <span>{formatMoney(variant.price, variant.currency, language)}</span>
            <span
              className={
                variant.availableQuantity <= 0
                  ? 'is-danger'
                  : variant.availableQuantity <= 3
                    ? 'is-warn'
                    : ''
              }
            >
              {variant.availableQuantity}
            </span>
            <span>{variant.reservedQuantity}</span>
            <div className="butik-row-actions">
              <button
                className="admin-button admin-button--quiet"
                onClick={() => onEditVariant(product, variant)}
                type="button"
              >
                {copy.edit}
              </button>
              <button
                className="admin-button admin-button--quiet"
                onClick={() => onToggleVariant(variant)}
                type="button"
              >
                {variant.active ? copy.deactivate : copy.activate}
              </button>
              <button
                className="admin-button admin-button--quiet"
                onClick={() => onStock(variant)}
                type="button"
              >
                {copy.adjustStock}
              </button>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function CatalogPage({
  copy,
  language,
  categories,
  products,
  loading,
  refreshing,
  formError,
  mode,
  categoryDraft,
  productDraft,
  selectedImage,
  selectedProduct,
  selectedVariant,
  onRefresh,
  onCategoryAdd,
  onCategoryEdit,
  onCategoryDraftChange,
  onCategorySave,
  onCategoryCancel,
  onCategoryToggle,
  onProductAdd,
  onProductEdit,
  onProductDraftChange,
  onProductSave,
  onProductCancel,
  onProductImageChange,
  onProductToggle,
  onStock,
  onAddVariant,
  onEditVariant,
  onToggleVariant,
  onVariantCreated,
  stockVariant,
  stockDelta,
  stockReason,
  stockError,
  stockBusy,
  onStockDeltaChange,
  onStockReasonChange,
  onStockClose,
  onStockSubmit,
}: {
  copy: ButikCopy;
  language: Language;
  categories: BoutiqueCategory[];
  products: BoutiqueProduct[];
  loading: boolean;
  refreshing: boolean;
  formError: string;
  mode: CatalogueMode;
  categoryDraft: { name: BoutiqueTextDraft; description: BoutiqueTextDraft };
  productDraft: ProductDraft;
  selectedImage: File | undefined;
  selectedProduct: BoutiqueProduct | null;
  selectedVariant: BoutiqueVariant | null;
  onRefresh: () => void;
  onCategoryAdd: () => void;
  onCategoryEdit: (category: BoutiqueCategory) => void;
  onCategoryDraftChange: (draft: {
    name: BoutiqueTextDraft;
    description: BoutiqueTextDraft;
  }) => void;
  onCategorySave: (event: FormEvent<HTMLFormElement>) => void;
  onCategoryCancel: () => void;
  onCategoryToggle: (category: BoutiqueCategory) => void;
  onProductAdd: () => void;
  onProductEdit: (product: BoutiqueProduct) => void;
  onProductDraftChange: (draft: ProductDraft) => void;
  onProductSave: (event: FormEvent<HTMLFormElement>) => void;
  onProductCancel: () => void;
  onProductImageChange: (file: File | undefined) => void;
  onProductToggle: (product: BoutiqueProduct) => void;
  onStock: (variant: BoutiqueVariant) => void;
  onAddVariant: (product: BoutiqueProduct) => void;
  onEditVariant: (product: BoutiqueProduct, variant: BoutiqueVariant) => void;
  onToggleVariant: (variant: BoutiqueVariant) => void;
  onVariantCreated: () => void;
  stockVariant: BoutiqueVariant | null;
  stockDelta: string;
  stockReason: string;
  stockError: string;
  stockBusy: boolean;
  onStockDeltaChange: (value: string) => void;
  onStockReasonChange: (value: string) => void;
  onStockClose: () => void;
  onStockSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const activeProducts = products.filter((product) => product.item.active);
  const lowStock = products
    .flatMap((product) => product.variants)
    .filter((variant) => variant.active && variant.availableQuantity <= 3).length;
  return (
    <main className="admin-content butik-content">
      <div className="admin-page-heading butik-heading">
        <div>
          <p className="admin-eyebrow">{copy.workspace}</p>
          <h1>{copy.catalog}</h1>
          <p>{copy.catalogSubtitle}</p>
        </div>
        <button
          className="admin-button"
          disabled={loading || refreshing}
          onClick={onRefresh}
          type="button"
        >
          {loading || refreshing ? copy.refreshing : copy.refresh}
        </button>
      </div>
      <section className="butik-stat-grid butik-stat-grid--catalog">
        <div className="butik-stat-card">
          <span>{copy.categories}</span>
          <strong>{categories.filter((category) => category.active).length}</strong>
          <small>{copy.total(categories.length)}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.products}</span>
          <strong>{activeProducts.length}</strong>
          <small>{copy.total(products.length)}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.lowStock}</span>
          <strong className={lowStock > 0 ? 'is-warn' : ''}>{lowStock}</strong>
          <small>{copy.activeStock}</small>
        </div>
        <div className="butik-stat-card">
          <span>{copy.outOfStock}</span>
          <strong
            className={
              products
                .flatMap((product) => product.variants)
                .filter((variant) => variant.active && variant.availableQuantity <= 0).length > 0
                ? 'is-danger'
                : ''
            }
          >
            {
              products
                .flatMap((product) => product.variants)
                .filter((variant) => variant.active && variant.availableQuantity <= 0).length
            }
          </strong>
          <small>{copy.products}</small>
        </div>
      </section>
      <CategoryPanel
        copy={copy}
        language={language}
        categories={categories}
        draft={categoryDraft}
        formError={formError}
        mode={mode}
        onAdd={onCategoryAdd}
        onCancel={onCategoryCancel}
        onDraftChange={onCategoryDraftChange}
        onEdit={onCategoryEdit}
        onSave={onCategorySave}
        onToggle={onCategoryToggle}
      />
      <section className="butik-panel butik-catalog-panel">
        <div className="butik-panel__header">
          <div>
            <p className="admin-eyebrow">{copy.catalog}</p>
            <h2>{copy.products}</h2>
          </div>
          <button
            className="admin-button admin-button--primary"
            onClick={onProductAdd}
            type="button"
          >
            + {copy.addProduct}
          </button>
        </div>
        {(mode === 'create-product' || mode === 'edit-product') && (
          <ProductForm
            categories={categories}
            copy={copy}
            draft={productDraft}
            formError={formError}
            language={language}
            mode={mode}
            onCancel={onProductCancel}
            onDraftChange={onProductDraftChange}
            onImageChange={onProductImageChange}
            onSave={onProductSave}
            selectedImage={selectedImage}
          />
        )}
        {loading ? (
          <div className="butik-empty">
            <span className="butik-spinner" />
            <p>{copy.loading}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="butik-empty">
            <div className="butik-empty__mark">—</div>
            <h3>{copy.noProducts}</h3>
            <p>{copy.catalogSubtitle}</p>
          </div>
        ) : (
          <div className="butik-product-list">
            {products.map((product) => (
              <ProductCard
                copy={copy}
                key={product.item.id}
                language={language}
                onAddVariant={onAddVariant}
                onEdit={onProductEdit}
                onEditVariant={onEditVariant}
                onStock={onStock}
                onToggle={onProductToggle}
                onToggleVariant={onToggleVariant}
                product={product}
              />
            ))}
          </div>
        )}
      </section>
      {selectedImage !== undefined && (
        <span className="butik-upload-hint">{selectedImage.name}</span>
      )}
      {selectedProduct !== null && (
        <VariantDrawer
          copy={copy}
          language={language}
          product={selectedProduct}
          variant={selectedVariant}
          onClose={onProductCancel}
          onCreated={onVariantCreated}
        />
      )}
      {stockVariant !== null && (
        <StockAdjustmentDrawer
          busy={stockBusy}
          copy={copy}
          delta={stockDelta}
          error={stockError}
          onClose={onStockClose}
          onDeltaChange={onStockDeltaChange}
          onReasonChange={onStockReasonChange}
          onSubmit={onStockSubmit}
          reason={stockReason}
          variant={stockVariant}
        />
      )}
    </main>
  );
}

function StockAdjustmentDrawer({
  copy,
  variant,
  delta,
  reason,
  error,
  busy,
  onDeltaChange,
  onReasonChange,
  onClose,
  onSubmit,
}: {
  copy: ButikCopy;
  variant: BoutiqueVariant;
  delta: string;
  reason: string;
  error: string;
  busy: boolean;
  onDeltaChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="butik-form-overlay" onMouseDown={onClose}>
      <aside
        aria-label={copy.stockAdjustment}
        className="butik-form-drawer butik-stock-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="butik-form-drawer__header">
          <div>
            <p className="admin-eyebrow">{copy.variants}</p>
            <h3>{copy.stockAdjustment}</h3>
            <p className="butik-drawer__subtitle">{variant.sku}</p>
          </div>
          <button className="butik-icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <form className="butik-form butik-form--drawer" onSubmit={onSubmit}>
          <div className="butik-form-section">
            <p className="butik-form-section__eyebrow">{copy.stock}</p>
            <p className="butik-field__hint">{copy.stockAdjustmentDescription}</p>
            <label className="butik-field">
              <span>{copy.delta}</span>
              <input
                inputMode="numeric"
                onChange={(event) => onDeltaChange(event.target.value)}
                placeholder="+10 / -2"
                required
                type="number"
                value={delta}
              />
              <small className="butik-field__hint">
                {copy.available}: {variant.availableQuantity}
              </small>
            </label>
            <label className="butik-field butik-field--wide">
              <span>{copy.reason}</span>
              <textarea
                onChange={(event) => onReasonChange(event.target.value)}
                placeholder={copy.reasonPlaceholder}
                required
                value={reason}
              />
            </label>
          </div>
          {error.length > 0 && (
            <p className="butik-form-error" role="alert">
              {error}
            </p>
          )}
          <div className="butik-form__actions">
            <button className="admin-button" onClick={onClose} type="button">
              {copy.cancel}
            </button>
            <button className="admin-button admin-button--primary" disabled={busy} type="submit">
              {busy ? copy.saving : copy.apply}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

function VariantDrawer({
  copy,
  language,
  product,
  variant,
  onClose,
  onCreated,
}: {
  copy: ButikCopy;
  language: Language;
  product: BoutiqueProduct;
  variant: BoutiqueVariant | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const editing = variant !== null;
  const [draft, setDraft] = useState<VariantDraft>(() => ({
    sku: variant?.sku ?? '',
    price: variant === null ? '' : String(variant.price),
    currency: variant?.currency ?? product.variants[0]?.currency ?? 'UZS',
    stock: variant === null ? '0' : String(variant.stockOnHand),
    options: variantOptionsFromApi(variant?.options),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft({
      sku: variant?.sku ?? '',
      price: variant === null ? '' : String(variant.price),
      currency: variant?.currency ?? product.variants[0]?.currency ?? 'UZS',
      stock: variant === null ? '0' : String(variant.stockOnHand),
      options: variantOptionsFromApi(variant?.options),
    });
  }, [product.item.id, product.variants, variant]);

  function updateDraft(update: Partial<VariantDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function updateOption(index: number, update: Partial<VariantOptionDraft>) {
    setDraft((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...update } : option,
      ),
    }));
  }

  function addOption() {
    setDraft((current) => ({
      ...current,
      options: [
        ...current.options,
        { id: `option-${Date.now()}-${current.options.length}`, code: '', label: '', value: '' },
      ],
    }));
  }

  function removeOption(index: number) {
    setDraft((current) => ({
      ...current,
      options: current.options.filter((_, optionIndex) => optionIndex !== index),
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const validationError = validateVariantDraft(
        draft,
        {
          sku: copy.requiredField,
          duplicateSku: copy.duplicateSku,
          price: copy.invalidPrice,
          stock: copy.invalidStock,
          optionName: copy.requiredField,
          optionValue: copy.requiredField,
          duplicateOption: copy.duplicateOption,
        },
        {
          editing,
          existingSkus: product.variants
            .filter((candidate) => candidate.id !== variant?.id)
            .map((candidate) => candidate.sku),
        },
      );
      if (validationError !== null) throw new Error(validationError);
      if (draft.currency.trim().length === 0) throw new Error(copy.requiredField);
      const numericPrice = Number(draft.price);
      const numericStock = Number(draft.stock);
      const options = variantOptionsToApi(draft.options);
      if (editing) {
        await managementApi.updateBoutiqueVariant(variant.id, {
          sku: draft.sku,
          options,
          price: numericPrice,
          currency: draft.currency,
        });
      } else {
        await managementApi.createBoutiqueVariant(product.item.id, {
          sku: draft.sku,
          price: numericPrice,
          currency: draft.currency,
          stockOnHand: numericStock,
          options,
        });
      }
      onCreated();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : copy.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="butik-drawer-backdrop" onMouseDown={onClose}>
      <aside
        className="butik-drawer butik-variant-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="butik-drawer__header">
          <div>
            <p className="admin-eyebrow">{copy.variants}</p>
            <h2>{localizedText(product.item.localizedName, language)}</h2>
          </div>
          <button className="admin-icon-button" onClick={onClose} type="button">
            ×
          </button>
        </div>
        <form className="butik-form" onSubmit={(event) => void submit(event)}>
          <div className="butik-form-section">
            <p className="butik-form-section__eyebrow">{copy.variantDetails}</p>
            <div className="butik-form-grid">
              <label>
                <span>{copy.sku}</span>
                <input
                  onChange={(event) => updateDraft({ sku: event.target.value })}
                  required
                  value={draft.sku}
                />
              </label>
              <label>
                <span>{copy.price}</span>
                <input
                  min="0"
                  onChange={(event) => updateDraft({ price: event.target.value })}
                  required
                  type="number"
                  value={draft.price}
                />
              </label>
              <label>
                <span>{copy.currency}</span>
                <input
                  maxLength={3}
                  onChange={(event) => updateDraft({ currency: event.target.value.toUpperCase() })}
                  required
                  value={draft.currency}
                />
              </label>
              <label>
                <span>{copy.stock}</span>
                <input
                  disabled={editing}
                  min="0"
                  onChange={(event) => updateDraft({ stock: event.target.value })}
                  required
                  type="number"
                  value={draft.stock}
                />
                {editing && <small className="butik-field__hint">{copy.adjustStock}</small>}
              </label>
            </div>
            <VariantOptionsEditor
              copy={copy}
              onAdd={addOption}
              onChange={updateOption}
              onRemove={removeOption}
              options={draft.options}
            />
          </div>
          {error.length > 0 && <p className="butik-form-error">{error}</p>}
          <div className="butik-form__actions">
            <button className="admin-button" onClick={onClose} type="button">
              {copy.cancel}
            </button>
            <button className="admin-button admin-button--primary" disabled={busy} type="submit">
              {busy ? copy.saving : editing ? copy.update : copy.create}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export function ButikWorkspace({
  authCopy,
  initialPage,
  language,
  onLanguageChange,
  onNavigate,
  onSignOut,
  user,
}: ButikWorkspaceProps) {
  const copy = COPY[language];
  const [page, setPage] = useState(initialPage);
  const [orders, setOrders] = useState<StaffRequest[]>([]);
  const [categories, setCategories] = useState<BoutiqueCategory[]>([]);
  const [products, setProducts] = useState<BoutiqueProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [formError, setFormError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<StaffRequest | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [mode, setMode] = useState<CatalogueMode>('idle');
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [categoryDraft, setCategoryDraft] = useState({
    name: textDraftFromLocalized(null),
    description: textDraftFromLocalized(null),
  });
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProduct());
  const [selectedImage, setSelectedImage] = useState<File | undefined>();
  const [selectedProduct, setSelectedProduct] = useState<BoutiqueProduct | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<BoutiqueVariant | null>(null);
  const [stockVariant, setStockVariant] = useState<BoutiqueVariant | null>(null);
  const [stockDelta, setStockDelta] = useState('');
  const [stockReason, setStockReason] = useState('');
  const [stockError, setStockError] = useState('');
  const [stockBusy, setStockBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [highlightedOrderIds, setHighlightedOrderIds] = useState<Set<string>>(() => new Set());
  const activeLoadController = useRef<AbortController | null>(null);
  const loadSequence = useRef(0);
  const realtimeRefreshTimer = useRef<number | null>(null);
  const realtimeHighlightTimeouts = useRef(new Map<string, number>());
  const { status: realtimeStatus, subscribe } = useStaffRealtime();

  useEffect(() => setPage(initialPage), [initialPage]);

  const loadOrders = useCallback(async (signal?: AbortSignal) => {
    const [newOrders, inProcess, completed, cancelled] = await Promise.all([
      managementApi.listDepartmentRequests(
        {
          unit: 'BUTIK_INDONESIA',
          status: 'NEW',
          page: 1,
          pageSize: 100,
        },
        signal,
      ),
      managementApi.listDepartmentRequests(
        {
          unit: 'BUTIK_INDONESIA',
          status: 'IN_PROCESS',
          page: 1,
          pageSize: 100,
        },
        signal,
      ),
      managementApi.listDepartmentRequests(
        {
          unit: 'BUTIK_INDONESIA',
          status: 'COMPLETED',
          page: 1,
          pageSize: 100,
        },
        signal,
      ),
      managementApi.listDepartmentRequests(
        {
          unit: 'BUTIK_INDONESIA',
          status: 'CANCELLED',
          page: 1,
          pageSize: 100,
        },
        signal,
      ),
    ]);
    const all = [...newOrders.items, ...inProcess.items, ...completed.items, ...cancelled.items];
    setOrders(all.sort((left, right) => right.requestedAt.localeCompare(left.requestedAt)));
  }, []);

  const loadCatalog = useCallback(async (signal?: AbortSignal) => {
    const [categoryResponse, productResponse] = await Promise.all([
      managementApi.listBoutiqueCategories(signal),
      managementApi.listBoutiqueProducts({ includeInactive: true, page: 1, pageSize: 100 }, signal),
    ]);
    setCategories(categoryResponse.items);
    setProducts(productResponse.items);
  }, []);

  const loadAll = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      activeLoadController.current?.abort();
      const controller = new AbortController();
      activeLoadController.current = controller;
      const sequence = ++loadSequence.current;
      const isCurrentRequest = () =>
        sequence === loadSequence.current && !controller.signal.aborted;
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');
      try {
        await Promise.all([loadOrders(controller.signal), loadCatalog(controller.signal)]);
      } catch (requestError) {
        if (requestError instanceof Error && requestError.name === 'AbortError') return;
        if (!isCurrentRequest()) return;
        setError(
          requestError instanceof StaffApiError && requestError.status === 401
            ? copy.sessionExpired
            : copy.error,
        );
      } finally {
        if (isCurrentRequest()) {
          setLoading(false);
          setRefreshing(false);
          if (activeLoadController.current === controller) activeLoadController.current = null;
        }
      }
    },
    [copy.error, copy.sessionExpired, loadCatalog, loadOrders],
  );

  const queueRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimer.current !== null) return;
    realtimeRefreshTimer.current = window.setTimeout(() => {
      realtimeRefreshTimer.current = null;
      void loadAll({ silent: true });
    }, 160);
  }, [loadAll]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void loadAll({ silent: true });
    };
    const timer = window.setInterval(refreshIfVisible, realtimeStatus === 'live' ? 60_000 : 15_000);
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadAll, realtimeStatus]);

  useEffect(() => {
    if (realtimeStatus !== 'live') return undefined;
    void loadAll({ silent: true });
    return undefined;
  }, [loadAll, realtimeStatus]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      if (
        event.eventType === 'staff.request.created' ||
        event.eventType === 'staff.request.updated'
      ) {
        if (event.unit !== 'BUTIK_INDONESIA') return;
        setHighlightedOrderIds((current) => new Set(current).add(event.entityId));
        const previousTimeout = realtimeHighlightTimeouts.current.get(event.entityId);
        if (previousTimeout !== undefined) window.clearTimeout(previousTimeout);
        const timeout = window.setTimeout(() => {
          setHighlightedOrderIds((current) => {
            const next = new Set(current);
            next.delete(event.entityId);
            return next;
          });
          realtimeHighlightTimeouts.current.delete(event.entityId);
        }, 4_000);
        realtimeHighlightTimeouts.current.set(event.entityId, timeout);
        setToast(copy.realtimeUpdated);
        queueRealtimeRefresh();
        return;
      }
      if (
        event.eventType === 'staff.boutique.catalog.updated' ||
        event.eventType === 'staff.boutique.inventory.updated'
      ) {
        queueRealtimeRefresh();
      }
    });
    return unsubscribe;
  }, [copy.realtimeUpdated, queueRealtimeRefresh, subscribe]);

  useEffect(() => {
    if (toast.length === 0) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 4_200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(
    () => () => {
      activeLoadController.current?.abort();
      if (realtimeRefreshTimer.current !== null) {
        window.clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
      for (const timeout of realtimeHighlightTimeouts.current.values())
        window.clearTimeout(timeout);
      realtimeHighlightTimeouts.current.clear();
    },
    [],
  );

  function navigate(nextPage: 'orders' | 'catalog') {
    setPage(nextPage);
    onNavigate(nextPage);
  }

  async function transition(order: StaffRequest, next: 'IN_PROCESS' | 'COMPLETED') {
    setError('');
    try {
      const updated =
        next === 'IN_PROCESS'
          ? await managementApi.confirmDepartmentRequest(order.id)
          : await managementApi.completeDepartmentRequest(order.id);
      setOrders((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setSelectedOrder(updated);
    } catch (requestError) {
      setError(
        requestError instanceof StaffApiError && requestError.status === 401
          ? copy.sessionExpired
          : copy.error,
      );
    }
  }
  async function cancelSelected() {
    if (selectedOrder === null) return;
    setError('');
    try {
      const updated = await managementApi.cancelDepartmentRequest(
        selectedOrder.id,
        cancelReason.trim() || undefined,
      );
      setOrders((current) =>
        current.map((candidate) => (candidate.id === updated.id ? updated : candidate)),
      );
      setSelectedOrder(updated);
      setCancelReason('');
    } catch (requestError) {
      setError(
        requestError instanceof StaffApiError && requestError.status === 401
          ? copy.sessionExpired
          : copy.error,
      );
    }
  }

  function startCategoryCreate() {
    setFormError('');
    setMode('create-category');
    setEditingCategoryId(null);
    setCategoryDraft({
      name: textDraftFromLocalized(null),
      description: textDraftFromLocalized(null),
    });
  }
  function startCategoryEdit(category: BoutiqueCategory) {
    setFormError('');
    setMode('edit-category');
    setEditingCategoryId(category.id);
    setCategoryDraft({
      name: localizedDraft(category.localizedName),
      description: localizedDraft(category.localizedDescription),
    });
  }
  async function saveCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setFormError('');
    try {
      if (categoryDraft.name.value.trim().length === 0) throw new Error(copy.requiredField);
      if (mode === 'edit-category' && editingCategoryId !== null)
        await managementApi.updateBoutiqueCategory(editingCategoryId, {
          localizedName: serializeTextDraft(categoryDraft.name, { required: true }) ?? {
            uz: '',
            ru: '',
            en: '',
          },
          localizedDescription: serializeTextDraft(categoryDraft.description),
        });
      else
        await managementApi.createBoutiqueCategory({
          localizedName: serializeTextDraft(categoryDraft.name, { required: true }) ?? {
            uz: '',
            ru: '',
            en: '',
          },
          localizedDescription: serializeTextDraft(categoryDraft.description),
        });
      setMode('idle');
      setEditingCategoryId(null);
      setFormError('');
      await loadCatalog();
    } catch (requestError) {
      setFormError(requestError instanceof Error ? requestError.message : copy.error);
    } finally {
      setLoading(false);
    }
  }
  async function toggleCategory(category: BoutiqueCategory) {
    try {
      if (category.active) await managementApi.deactivateBoutiqueCategory(category.id);
      else await managementApi.activateBoutiqueCategory(category.id);
      await loadCatalog();
    } catch {
      setError(copy.error);
    }
  }
  function startProductCreate() {
    setFormError('');
    setMode('create-product');
    setEditingProductId(null);
    setProductDraft(emptyProduct(categories.find((category) => category.active)?.id ?? ''));
    setSelectedImage(undefined);
  }
  function startProductEdit(product: BoutiqueProduct) {
    setFormError('');
    setMode('edit-product');
    setEditingProductId(product.item.id);
    setProductDraft({
      name: localizedDraft(product.item.localizedName),
      description: localizedDraft(product.item.localizedDescription),
      categoryId: product.categoryId,
      variant: {
        sku: product.variants[0]?.sku ?? '',
        price: String(product.variants[0]?.price ?? product.item.price ?? 0),
        currency: product.variants[0]?.currency ?? product.item.currency ?? 'UZS',
        stock: String(product.variants[0]?.stockOnHand ?? 0),
        options: variantOptionsFromApi(product.variants[0]?.options),
      },
      available: product.item.available,
    });
    setSelectedImage(undefined);
  }
  function startVariantCreate(product: BoutiqueProduct) {
    setSelectedProduct(product);
    setSelectedVariant(null);
  }
  function startVariantEdit(product: BoutiqueProduct, variant: BoutiqueVariant) {
    setSelectedProduct(product);
    setSelectedVariant(variant);
  }
  function closeCatalogOverlay() {
    setMode('idle');
    setSelectedProduct(null);
    setSelectedVariant(null);
    setFormError('');
  }
  function openStock(variant: BoutiqueVariant) {
    setStockVariant(variant);
    setStockDelta('');
    setStockReason('');
    setStockError('');
  }
  function closeStock() {
    if (stockBusy) return;
    setStockVariant(null);
    setStockDelta('');
    setStockReason('');
    setStockError('');
  }
  async function submitStockAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (stockVariant === null) return;
    const numericDelta = Number(stockDelta.trim());
    if (!Number.isInteger(numericDelta) || numericDelta === 0) {
      setStockError(copy.invalidStockChange);
      return;
    }
    if (stockReason.trim().length === 0) {
      setStockError(copy.requiredField);
      return;
    }
    setStockBusy(true);
    setStockError('');
    try {
      await managementApi.adjustBoutiqueStock(stockVariant.id, numericDelta, stockReason.trim());
      setStockVariant(null);
      setStockDelta('');
      setStockReason('');
      await loadCatalog();
    } catch (requestError) {
      setStockError(
        requestError instanceof StaffApiError && requestError.status === 401
          ? copy.sessionExpired
          : requestError instanceof Error
            ? requestError.message
            : copy.error,
      );
    } finally {
      setStockBusy(false);
    }
  }
  async function saveProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setFormError('');
    try {
      if (productDraft.name.value.trim().length === 0) throw new Error(copy.requiredField);
      if (productDraft.categoryId.length === 0) throw new Error(copy.invalidCategory);
      let imageMediaId: string | null = null;
      if (selectedImage !== undefined)
        imageMediaId = (await managementApi.uploadBoutiqueMedia(selectedImage)).id;
      if (mode === 'edit-product' && editingProductId !== null) {
        await managementApi.updateBoutiqueProduct(editingProductId, {
          localizedName: serializeTextDraft(productDraft.name, { required: true }) ?? {
            uz: '',
            ru: '',
            en: '',
          },
          localizedDescription: serializeTextDraft(productDraft.description),
          categoryId: productDraft.categoryId,
          ...(imageMediaId === null ? {} : { imageMediaId }),
          available: productDraft.available,
        });
      } else {
        const variantError = validateVariantDraft(
          productDraft.variant,
          {
            sku: copy.requiredField,
            duplicateSku: copy.duplicateSku,
            price: copy.invalidPrice,
            stock: copy.invalidStock,
            optionName: copy.requiredField,
            optionValue: copy.requiredField,
            duplicateOption: copy.duplicateOption,
          },
          {
            existingSkus: products
              .filter((candidate) => candidate.item.id !== editingProductId)
              .flatMap((candidate) =>
                candidate.variants.map((candidateVariant) => candidateVariant.sku),
              ),
          },
        );
        if (variantError !== null) throw new Error(variantError);
        if (productDraft.categoryId.length === 0) throw new Error(copy.invalidCategory);
        if (productDraft.variant.currency.trim().length === 0) throw new Error(copy.requiredField);
        await managementApi.createBoutiqueProduct({
          localizedName: serializeTextDraft(productDraft.name, { required: true }) ?? {
            uz: '',
            ru: '',
            en: '',
          },
          localizedDescription: serializeTextDraft(productDraft.description),
          categoryId: productDraft.categoryId,
          imageMediaId,
          available: productDraft.available,
          variants: [
            {
              sku: productDraft.variant.sku,
              options: variantOptionsToApi(productDraft.variant.options),
              price: Number(productDraft.variant.price),
              currency: productDraft.variant.currency,
              stockOnHand: Number(productDraft.variant.stock),
            },
          ],
        });
      }
      setMode('idle');
      setEditingProductId(null);
      setSelectedImage(undefined);
      setFormError('');
      await loadCatalog();
    } catch (requestError) {
      setFormError(
        requestError instanceof StaffApiError && requestError.status === 401
          ? copy.sessionExpired
          : requestError instanceof Error
            ? requestError.message
            : copy.error,
      );
    } finally {
      setLoading(false);
    }
  }
  async function toggleProduct(product: BoutiqueProduct) {
    try {
      if (product.item.active) await managementApi.deactivateBoutiqueProduct(product.item.id);
      else await managementApi.activateBoutiqueProduct(product.item.id);
      await loadCatalog();
    } catch {
      setError(copy.error);
    }
  }
  async function toggleVariant(variant: BoutiqueVariant) {
    try {
      if (variant.active) await managementApi.deactivateBoutiqueVariant(variant.id);
      else await managementApi.activateBoutiqueVariant(variant.id);
      await loadCatalog();
    } catch {
      setError(copy.error);
    }
  }
  function handleVariantCreated() {
    setSelectedProduct(null);
    setSelectedVariant(null);
    void loadCatalog();
  }

  const lowStockCount = products
    .flatMap((product) => product.variants)
    .filter((variant) => variant.active && variant.availableQuantity <= 3).length;
  return (
    <div className="admin-shell butik-shell">
      <ButikHeader activePage={page} copy={copy} onNavigate={navigate} />
      <div className="admin-main">
        <ButikTopbar
          activePage={page}
          authCopy={authCopy}
          copy={copy}
          language={language}
          onLanguageChange={onLanguageChange}
          onSignOut={onSignOut}
          user={user}
        />
        <div className="butik-main-slot">
          {error.length > 0 && (
            <div className="butik-global-error" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadAll()} type="button">
                {copy.retry}
              </button>
            </div>
          )}
          {page === 'orders' ? (
            <OrdersPage
              cancelReason={cancelReason}
              copy={copy}
              language={language}
              loading={loading}
              refreshing={refreshing}
              lowStock={lowStockCount}
              onCancel={() => void cancelSelected()}
              onCancelReasonChange={setCancelReason}
              onClose={() => setSelectedOrder(null)}
              onOpen={setSelectedOrder}
              onRefresh={() => void loadAll()}
              onTransition={(order, next) => void transition(order, next)}
              orders={orders}
              selectedOrder={selectedOrder}
              highlightedOrderIds={highlightedOrderIds}
            />
          ) : (
            <CatalogPage
              categories={categories}
              categoryDraft={categoryDraft}
              copy={copy}
              formError={formError}
              language={language}
              loading={loading}
              refreshing={refreshing}
              mode={mode}
              onAddVariant={startVariantCreate}
              onEditVariant={startVariantEdit}
              onToggleVariant={(variant) => void toggleVariant(variant)}
              onVariantCreated={handleVariantCreated}
              onCategoryAdd={startCategoryCreate}
              onCategoryCancel={closeCatalogOverlay}
              onCategoryDraftChange={setCategoryDraft}
              onCategoryEdit={startCategoryEdit}
              onCategorySave={(event) => void saveCategory(event)}
              onCategoryToggle={(category) => void toggleCategory(category)}
              onProductAdd={startProductCreate}
              onProductCancel={closeCatalogOverlay}
              onProductDraftChange={setProductDraft}
              onProductEdit={startProductEdit}
              onProductImageChange={setSelectedImage}
              onProductSave={(event) => void saveProduct(event)}
              onProductToggle={(product) => void toggleProduct(product)}
              onRefresh={() => void loadAll()}
              onStock={openStock}
              productDraft={productDraft}
              products={products}
              selectedImage={selectedImage}
              selectedProduct={selectedProduct}
              selectedVariant={selectedVariant}
              stockBusy={stockBusy}
              stockDelta={stockDelta}
              stockError={stockError}
              stockReason={stockReason}
              stockVariant={stockVariant}
              onStockClose={closeStock}
              onStockDeltaChange={setStockDelta}
              onStockReasonChange={setStockReason}
              onStockSubmit={(event) => void submitStockAdjustment(event)}
            />
          )}
        </div>
      </div>
      {toast.length > 0 && (
        <div className="admin-toast" role="status">
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
