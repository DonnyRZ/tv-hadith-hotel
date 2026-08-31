import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FormEvent, MouseEvent, ReactNode } from 'react';

import {
  managementApi,
  StaffApiError,
  type CreateMenuItemInput,
  type ManagedMenuItem,
  type MenuItemKind,
  type MenuUnit,
  type UpdateMenuItemInput,
} from './management-api';
import { AdminSelect } from './AdminSelect';
import {
  catalogUnitCopy,
  type AuthCopy,
  type CafeCopy,
  type CatalogUnitCopy,
  type Language,
  LANGUAGE_OPTIONS,
} from './i18n';

interface StaffUser {
  displayName: string;
  roles: string[];
}

export interface CafeWorkspaceProps {
  authCopy: AuthCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigate: (page: 'orders' | 'menu') => void;
  onSignOut: () => void;
  user: StaffUser;
}

interface CatalogWorkspaceProps {
  authCopy: AuthCopy;
  catalogCopy: CafeCopy;
  itemKind: MenuItemKind;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigate: (page: 'requests' | 'menu') => void;
  onSignOut: () => void;
  unit: MenuUnit;
  unitCopy: CatalogUnitCopy;
  user: StaffUser;
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'INACTIVE' | 'AVAILABLE' | 'UNAVAILABLE';
type PaginationItem = number | 'ellipsis';

const MENU_PAGE_SIZE = 10;

interface ActionMenuState {
  id: string;
  left: number;
  top: number;
}

type DrawerState = { type: 'create-item' } | { type: 'edit-item'; item: ManagedMenuItem } | null;

interface ItemFormDraft {
  nameUz: string;
  nameRu: string;
  nameEn: string;
  descriptionUz: string;
  descriptionRu: string;
  descriptionEn: string;
  price: string;
  currency: string;
  durationMinutes: string;
  available: boolean;
  quantityAllowed: boolean;
  sortOrder: string;
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0]?.slice(0, 2).toUpperCase() ?? '—';
  return `${parts[0]?.[0] ?? ''}${parts[parts.length - 1]?.[0] ?? ''}`.toUpperCase();
}

function formatPrice(item: ManagedMenuItem, language: Language, copy: CafeCopy): string {
  if (item.price === null) return copy.noPrice;
  const locale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB';
  const value = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(item.price);
  return item.currency === null ? value : `${value} ${item.currency}`;
}

function menuErrorMessage(error: unknown, copy: CafeCopy): string {
  if (error instanceof StaffApiError) {
    if (error.code === 'MENU_ITEM_NAME_CONFLICT') return copy.duplicateItem;
    if (error.code === 'SESSION_EXPIRED' || error.status === 401) return copy.sessionExpired;
  }
  return copy.apiError;
}

function sortItems(items: ManagedMenuItem[]): ManagedMenuItem[] {
  return [...items].sort(
    (first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name),
  );
}

function getPaginationItems(currentPage: number, totalPages: number): PaginationItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pageSet = new Set([1, totalPages, currentPage]);
  if (currentPage <= 3) {
    pageSet.add(2);
    pageSet.add(3);
    pageSet.add(4);
  } else if (currentPage >= totalPages - 2) {
    pageSet.add(totalPages - 3);
    pageSet.add(totalPages - 2);
    pageSet.add(totalPages - 1);
  } else {
    pageSet.add(currentPage - 1);
    pageSet.add(currentPage + 1);
  }

  const sortedPages = [...pageSet].sort((first, second) => first - second);
  return sortedPages.reduce<PaginationItem[]>((result, page, index) => {
    const previousPage = sortedPages[index - 1];
    if (previousPage !== undefined && page - previousPage > 1) result.push('ellipsis');
    result.push(page);
    return result;
  }, []);
}

export function AdminBrandMark() {
  return (
    <div className="admin-brand-mark" aria-hidden="true">
      <span>✦</span>
      <strong>H</strong>
    </div>
  );
}

export function MenuIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 4.5h14v15H5zM8.5 8h7M8.5 12h7M8.5 16h4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OrdersIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 24 24" fill="none">
      <path
        d="M4.5 7.5h15v11h-15zM7 4.5h10M8 11.5h8M8 15h5"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="4" cy="10" r="1" fill="currentColor" />
      <circle cx="10" cy="10" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="8.7" cy="8.7" r="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.3 12.3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ArrowIcon({ direction }: { direction: 'right' | 'left' }) {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      {direction === 'right' ? (
        <path
          d="M4 10h11M10.5 5.5 15 10l-4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M16 10H5M9.5 5.5 5 10l4.5 4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m4.5 10.2 3.5 3.4 7.5-7.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AdminLanguageSwitcher({
  authCopy,
  language,
  onChange,
}: {
  authCopy: AuthCopy;
  language: Language;
  onChange: (language: Language) => void;
}) {
  return (
    <div className="admin-language-switcher" aria-label={authCopy.languageLabel}>
      {(['uz', 'ru', 'en'] as const).map((option) => (
        <button
          aria-pressed={language === option}
          className={
            language === option ? 'admin-language-option is-active' : 'admin-language-option'
          }
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option === 'uz' ? "O'z" : option === 'ru' ? 'Рус' : 'Eng'}
        </button>
      ))}
    </div>
  );
}

function StatusPill({ active, copy }: { active: boolean; copy: CafeCopy }) {
  return (
    <span className={active ? 'status-pill status-pill--active' : 'status-pill'}>
      {active ? copy.active : copy.inactive}
    </span>
  );
}

function AvailabilityPill({ available, copy }: { available: boolean; copy: CafeCopy }) {
  return (
    <span
      className={available ? 'cafe-availability cafe-availability--available' : 'cafe-availability'}
    >
      {available ? copy.available : copy.unavailable}
    </span>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-state__mark">—</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function LoadingState({ copy }: { copy: CafeCopy }) {
  return (
    <div className="admin-loading-state" aria-live="polite">
      <span className="admin-loading-line admin-loading-line--wide" />
      <span className="admin-loading-line" />
      <span className="admin-loading-line admin-loading-line--short" />
      <p>{copy.loading}</p>
    </div>
  );
}

function CafePagination({
  copy,
  currentPage,
  totalItems,
  totalPages,
  onPageChange,
}: {
  copy: CafeCopy;
  currentPage: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  const firstItem = (currentPage - 1) * MENU_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * MENU_PAGE_SIZE, totalItems);

  return (
    <nav aria-label={copy.pagination} className="cafe-pagination">
      <p className="cafe-pagination__summary">
        {copy.showingRange(firstItem, lastItem, totalItems)}
      </p>
      <div className="cafe-pagination__controls">
        <button
          aria-label={copy.previousPage}
          className="cafe-pagination__control"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          type="button"
        >
          <ArrowIcon direction="left" />
          <span>{copy.previousPage}</span>
        </button>
        <div className="cafe-pagination__pages">
          {getPaginationItems(currentPage, totalPages).map((item, index) =>
            item === 'ellipsis' ? (
              <span
                aria-hidden="true"
                className="cafe-pagination__ellipsis"
                key={`ellipsis-${index}`}
              >
                …
              </span>
            ) : (
              <button
                aria-current={item === currentPage ? 'page' : undefined}
                aria-label={copy.pageLabel(item)}
                className={
                  item === currentPage ? 'cafe-pagination__page is-active' : 'cafe-pagination__page'
                }
                key={item}
                onClick={() => onPageChange(item)}
                type="button"
              >
                {item}
              </button>
            ),
          )}
        </div>
        <button
          aria-label={copy.nextPage}
          className="cafe-pagination__control"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          type="button"
        >
          <span>{copy.nextPage}</span>
          <ArrowIcon direction="right" />
        </button>
      </div>
    </nav>
  );
}

function Drawer({
  title,
  eyebrow,
  children,
  onClose,
  copy,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
  onClose: () => void;
  copy: CafeCopy;
}) {
  return (
    <div
      className="admin-overlay"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside
        aria-label={title}
        aria-modal="true"
        className="admin-drawer cafe-drawer"
        role="dialog"
      >
        <div className="admin-drawer__header">
          <div>
            {eyebrow !== undefined && <p className="admin-eyebrow">{eyebrow}</p>}
            <h2>{title}</h2>
          </div>
          <button
            aria-label={copy.close}
            className="admin-icon-button"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="admin-drawer__body">{children}</div>
      </aside>
    </div>
  );
}

function ItemDrawer({
  copy,
  itemKind,
  item,
  onClose,
  onSaved,
  unit,
  unitCopy,
}: {
  copy: CafeCopy;
  itemKind: MenuItemKind;
  item: ManagedMenuItem | null;
  onClose: () => void;
  onSaved: (item: ManagedMenuItem, message: string) => void;
  unit: MenuUnit;
  unitCopy: CatalogUnitCopy;
}) {
  const editing = item !== null;
  const localizedName = item?.localizedName ?? {
    uz: item?.name ?? '',
    ru: item?.name ?? '',
    en: item?.name ?? '',
  };
  const localizedDescription = item?.localizedDescription;
  const [draft, setDraft] = useState<ItemFormDraft>(() => ({
    nameUz: localizedName.uz,
    nameRu: localizedName.ru,
    nameEn: localizedName.en,
    descriptionUz: localizedDescription?.uz ?? '',
    descriptionRu: localizedDescription?.ru ?? '',
    descriptionEn: localizedDescription?.en ?? '',
    price: item?.price === null || item?.price === undefined ? '' : String(item.price),
    currency: item?.currency ?? 'UZS',
    durationMinutes:
      item?.durationMinutes === null || item?.durationMinutes === undefined
        ? ''
        : String(item.durationMinutes),
    available: item?.available ?? true,
    quantityAllowed: item?.quantityAllowed ?? itemKind === 'PRODUCT',
    sortOrder: item === null ? '0' : String(item.sortOrder),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof ItemFormDraft>(field: K, value: ItemFormDraft[K]) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const names = {
      uz: draft.nameUz.trim(),
      ru: draft.nameRu.trim(),
      en: draft.nameEn.trim(),
    };
    if (Object.values(names).some((value) => value.length === 0)) {
      setError(copy.requiredField);
      return;
    }

    const descriptions = {
      uz: draft.descriptionUz.trim(),
      ru: draft.descriptionRu.trim(),
      en: draft.descriptionEn.trim(),
    };
    const hasDescription = Object.values(descriptions).some((value) => value.length > 0);
    if (hasDescription && Object.values(descriptions).some((value) => value.length === 0)) {
      setError(copy.requiredField);
      return;
    }

    const price = draft.price.trim().length === 0 ? null : Number(draft.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError(copy.invalidPrice);
      return;
    }

    const durationMinutes =
      itemKind === 'SERVICE' && draft.durationMinutes.trim().length > 0
        ? Number(draft.durationMinutes)
        : null;
    if (durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1)) {
      setError(copy.requiredField);
      return;
    }

    const sortOrder = Number(draft.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      setError(copy.requiredField);
      return;
    }

    const sharedInput: UpdateMenuItemInput = {
      localizedName: names,
      localizedDescription: hasDescription ? descriptions : null,
      price,
      currency: draft.currency.trim().toUpperCase() || null,
      durationMinutes,
      available: draft.available,
      quantityAllowed: itemKind === 'PRODUCT' ? draft.quantityAllowed : false,
      sortOrder,
    };

    setSaving(true);
    setError('');
    try {
      const saved = editing
        ? await managementApi.updateMenuItem(item.id, sharedInput)
        : await managementApi.createMenuItem({
            ...sharedInput,
            unit,
            kind: itemKind,
          } as CreateMenuItemInput);
      onSaved(saved, editing ? copy.itemUpdated : copy.itemCreated);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, copy));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer
      copy={copy}
      eyebrow={copy.menu}
      onClose={onClose}
      title={editing ? copy.editItem : copy.createItem}
    >
      <form className="admin-form" noValidate onSubmit={(event) => void handleSubmit(event)}>
        <div className="admin-form-intro admin-form-intro--plain">
          <p>{copy.itemDetails}</p>
        </div>

        <div className="cafe-localized-section">
          <p className="cafe-localized-section__label">{copy.itemName}</p>
          <div className="cafe-localized-grid">
            {(['uz', 'ru', 'en'] as const).map((locale, index) => {
              const field = locale === 'uz' ? 'nameUz' : locale === 'ru' ? 'nameRu' : 'nameEn';
              const languageLabel = LANGUAGE_OPTIONS.find(
                (option) => option.code === locale,
              )?.label;
              return (
                <div className="admin-field" key={locale}>
                  <label htmlFor={`${unit.toLowerCase()}-item-name-${locale}`}>
                    {languageLabel ?? locale.toUpperCase()}
                  </label>
                  <input
                    autoFocus={index === 0}
                    id={`${unit.toLowerCase()}-item-name-${locale}`}
                    onChange={(event) => setField(field, event.target.value)}
                    placeholder={copy.itemNamePlaceholder}
                    value={draft[field]}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="cafe-localized-section">
          <p className="cafe-localized-section__label">{copy.description}</p>
          <div className="cafe-localized-grid">
            {(['uz', 'ru', 'en'] as const).map((locale) => {
              const field =
                locale === 'uz'
                  ? 'descriptionUz'
                  : locale === 'ru'
                    ? 'descriptionRu'
                    : 'descriptionEn';
              const languageLabel = LANGUAGE_OPTIONS.find(
                (option) => option.code === locale,
              )?.label;
              return (
                <div className="admin-field" key={locale}>
                  <label htmlFor={`${unit.toLowerCase()}-item-description-${locale}`}>
                    {languageLabel ?? locale.toUpperCase()}
                  </label>
                  <textarea
                    id={`${unit.toLowerCase()}-item-description-${locale}`}
                    onChange={(event) => setField(field, event.target.value)}
                    placeholder={copy.descriptionPlaceholder}
                    rows={3}
                    value={draft[field]}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="cafe-form-grid">
          <div className="admin-field">
            <label htmlFor={`${unit.toLowerCase()}-item-price`}>{copy.price}</label>
            <input
              id={`${unit.toLowerCase()}-item-price`}
              inputMode="decimal"
              min="0"
              onChange={(event) => setField('price', event.target.value)}
              placeholder={copy.pricePlaceholder}
              step="0.01"
              type="number"
              value={draft.price}
            />
          </div>
          <div className="admin-field">
            <label htmlFor={`${unit.toLowerCase()}-item-currency`}>{copy.currency}</label>
            <input
              id={`${unit.toLowerCase()}-item-currency`}
              maxLength={3}
              onChange={(event) => setField('currency', event.target.value)}
              placeholder={copy.currencyPlaceholder}
              value={draft.currency}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="cafe-item-sort-order">{copy.sortOrder}</label>
            <input
              id={`${unit.toLowerCase()}-item-sort-order`}
              inputMode="numeric"
              min="0"
              onChange={(event) => setField('sortOrder', event.target.value)}
              type="number"
              value={draft.sortOrder}
            />
          </div>
          {itemKind === 'SERVICE' && (
            <div className="admin-field">
              <label htmlFor={`${unit.toLowerCase()}-item-duration`}>
                {unitCopy.durationLabel ?? copy.item}
              </label>
              <input
                id={`${unit.toLowerCase()}-item-duration`}
                inputMode="numeric"
                min="1"
                onChange={(event) => setField('durationMinutes', event.target.value)}
                placeholder={unitCopy.durationPlaceholder ?? ''}
                type="number"
                value={draft.durationMinutes}
              />
              <small className="admin-field-hint">{unitCopy.durationHint ?? ''}</small>
            </div>
          )}
          <div className="cafe-readonly-field">
            <span>{copy.visibleToGuests}</span>
            <strong>{item?.active === false ? copy.inactive : copy.active}</strong>
          </div>
        </div>

        <label className="cafe-check-row">
          <input
            checked={draft.available}
            onChange={(event) => setField('available', event.target.checked)}
            type="checkbox"
          />
          <span>
            <strong>{copy.availableNow}</strong>
            <small>{copy.availability}</small>
          </span>
        </label>

        {itemKind === 'PRODUCT' && (
          <label className="cafe-check-row">
            <input
              checked={draft.quantityAllowed}
              onChange={(event) => setField('quantityAllowed', event.target.checked)}
              type="checkbox"
            />
            <span>
              <strong>{copy.quantityAllowed}</strong>
              <small>{copy.item}</small>
            </span>
          </label>
        )}

        {error.length > 0 && (
          <p className="admin-form-error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-form-actions">
          <button className="admin-button admin-button--quiet" onClick={onClose} type="button">
            {copy.cancel}
          </button>
          <button className="admin-button admin-button--primary" disabled={saving} type="submit">
            {copy.saveItem}
          </button>
        </div>
      </form>
    </Drawer>
  );
}

export function CatalogWorkspace({
  authCopy,
  catalogCopy: copy,
  itemKind,
  language,
  onLanguageChange,
  onNavigate,
  onSignOut,
  unit,
  unitCopy,
  user,
}: CatalogWorkspaceProps) {
  const unitSlug = unit.toLowerCase().replace(/_/g, '-');
  const [items, setItems] = useState<ManagedMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [menuPage, setMenuPage] = useState(1);
  const [drawer, setDrawer] = useState<DrawerState>(null);
  const [actionMenu, setActionMenu] = useState<ActionMenuState | null>(null);
  const [busyItemId, setBusyItemId] = useState('');
  const [toast, setToast] = useState('');

  const loadCatalog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await managementApi.listMenuItems({
        unit,
        includeInactive: true,
        page: 1,
        pageSize: 100,
      });
      setItems(sortItems(response.items));
    } catch (requestError) {
      setError(
        requestError instanceof StaffApiError
          ? copy.errorLoading
          : menuErrorMessage(requestError, copy),
      );
    } finally {
      setLoading(false);
    }
  }, [copy, unit]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    const closeActionMenu = () => setActionMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeActionMenu();
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest('.admin-hover-actions') &&
        !target.closest('.admin-more-button')
      ) {
        closeActionMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('scroll', closeActionMenu, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('scroll', closeActionMenu, true);
    };
  }, []);

  useEffect(() => {
    if (toast.length === 0) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesQuery = query.length === 0 || item.name.toLowerCase().includes(query);
      const matchesStatus =
        status === 'ALL' ||
        (status === 'ACTIVE' && item.active) ||
        (status === 'INACTIVE' && !item.active) ||
        (status === 'AVAILABLE' && item.available) ||
        (status === 'UNAVAILABLE' && !item.available);
      return matchesQuery && matchesStatus;
    });
  }, [items, search, status]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / MENU_PAGE_SIZE));
  const currentPage = Math.min(menuPage, totalPages);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * MENU_PAGE_SIZE;
    return filteredItems.slice(start, start + MENU_PAGE_SIZE);
  }, [currentPage, filteredItems]);

  useEffect(() => {
    if (menuPage !== currentPage) setMenuPage(currentPage);
  }, [currentPage, menuPage]);

  const activeCount = items.filter((item) => item.active).length;
  const unavailableCount = items.filter((item) => !item.available).length;

  function replaceItem(saved: ManagedMenuItem, message: string) {
    setItems((current) => {
      const exists = current.some((item) => item.id === saved.id);
      return sortItems(
        exists ? current.map((item) => (item.id === saved.id ? saved : item)) : [saved, ...current],
      );
    });
    setDrawer(null);
    setToast(message);
  }

  function toggleActionMenu(id: string, event: MouseEvent<HTMLButtonElement>) {
    if (actionMenu?.id === id) {
      setActionMenu(null);
      return;
    }

    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 196;
    const menuHeight = 150;
    const gap = 8;
    const viewportMargin = 12;
    const maximumLeft = Math.max(viewportMargin, window.innerWidth - menuWidth - viewportMargin);
    const left = Math.min(Math.max(viewportMargin, buttonRect.right - menuWidth), maximumLeft);
    const top =
      buttonRect.bottom + menuHeight + gap <= window.innerHeight - viewportMargin
        ? buttonRect.bottom + gap
        : Math.max(viewportMargin, buttonRect.top - menuHeight - gap);
    setActionMenu({ id, left, top });
  }

  async function toggleAvailability(item: ManagedMenuItem) {
    setBusyItemId(item.id);
    setActionMenu(null);
    try {
      const saved = await managementApi.updateMenuItem(item.id, { available: !item.available });
      replaceItem(saved, copy.statusUpdated);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, copy));
    } finally {
      setBusyItemId('');
    }
  }

  async function toggleActive(item: ManagedMenuItem) {
    setBusyItemId(item.id);
    setActionMenu(null);
    try {
      const saved = item.active
        ? await managementApi.deactivateMenuItem(item.id)
        : await managementApi.activateMenuItem(item.id);
      replaceItem(saved, copy.statusUpdated);
    } catch (requestError) {
      setError(menuErrorMessage(requestError, copy));
    } finally {
      setBusyItemId('');
    }
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <AdminBrandMark />
          <div>
            <strong>Hadith Hotel</strong>
            <span>{copy.administration}</span>
          </div>
        </div>
        <div className="admin-sidebar__rule" />
        <p className="admin-sidebar__label">{copy.mainNavigation}</p>
        <nav aria-label={copy.mainNavigation} className="admin-sidebar__nav">
          <button className="admin-nav-item" onClick={() => onNavigate('requests')} type="button">
            <OrdersIcon />
            <span>{copy.dashboard.orders}</span>
            <ArrowIcon direction="right" />
          </button>
          <button className="admin-nav-item is-active" type="button">
            <MenuIcon />
            <span>{copy.menu}</span>
            <ArrowIcon direction="right" />
          </button>
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>{copy.administration}</span>
            <ArrowIcon direction="right" />
            <strong>{copy.menu}</strong>
          </div>
          <div className="admin-topbar__actions">
            <AdminLanguageSwitcher
              authCopy={authCopy}
              language={language}
              onChange={onLanguageChange}
            />
            <div className="admin-topbar__user">
              <span className="admin-avatar admin-avatar--small">
                {getInitials(user.displayName)}
              </span>
              <span>
                <strong>{user.displayName}</strong>
                <small>{copy.cafeName}</small>
              </span>
            </div>
            <button className="admin-signout" onClick={onSignOut} type="button">
              {authCopy.signOut}
            </button>
          </div>
        </header>

        <main className="admin-content admin-content--cafe">
          {error.length > 0 && (
            <div className="admin-global-error" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadCatalog()} type="button">
                {copy.retry}
              </button>
            </div>
          )}

          <section className="admin-page" aria-labelledby={`${unitSlug}-menu-title`}>
            <div className="admin-page-heading">
              <div>
                <p className="admin-eyebrow">{copy.workspaceLabel}</p>
                <h1 id={`${unitSlug}-menu-title`}>{copy.menu}</h1>
                <p>{copy.menuSubtitle}</p>
              </div>
              <div className="cafe-page-actions">
                <button
                  className="admin-button admin-button--primary"
                  onClick={() => setDrawer({ type: 'create-item' })}
                  type="button"
                >
                  <PlusIcon />
                  {copy.addItem}
                </button>
              </div>
            </div>

            <div className="admin-stat-strip cafe-stat-strip" aria-label={copy.menu}>
              <div>
                <span>{copy.totalItems}</span>
                <strong>{items.length}</strong>
              </div>
              <div>
                <span>{copy.activeItems}</span>
                <strong>{activeCount}</strong>
              </div>
              <div>
                <span>{copy.unavailableItems}</span>
                <strong>{unavailableCount}</strong>
              </div>
            </div>

            <div className="admin-toolbar cafe-toolbar">
              <label className="admin-search-field">
                <span className="sr-only">{copy.searchMenu}</span>
                <SearchIcon />
                <input
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setMenuPage(1);
                  }}
                  placeholder={copy.searchMenuPlaceholder}
                  value={search}
                />
              </label>
              <AdminSelect
                ariaLabel={copy.status}
                className="admin-filter-field"
                onChange={(value) => {
                  setStatus(value as StatusFilter);
                  setMenuPage(1);
                }}
                options={[
                  { label: copy.allStatuses, value: 'ALL' },
                  { label: copy.active, value: 'ACTIVE' },
                  { label: copy.inactive, value: 'INACTIVE' },
                  { label: copy.available, value: 'AVAILABLE' },
                  { label: copy.unavailable, value: 'UNAVAILABLE' },
                ]}
                value={status}
              />
              <span className="admin-toolbar-count">{copy.showing(filteredItems.length)}</span>
            </div>

            {loading ? (
              <LoadingState copy={copy} />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                action={
                  <button
                    className="admin-text-button"
                    onClick={() => setDrawer({ type: 'create-item' })}
                    type="button"
                  >
                    {copy.addItem}
                    <ArrowIcon direction="right" />
                  </button>
                }
                description={copy.noItemsDescription}
                title={copy.noItems}
              />
            ) : (
              <section className="cafe-menu-panel" aria-labelledby={`${unitSlug}-menu-panel-title`}>
                <div className="cafe-menu-panel__header">
                  <div>
                    <p className="admin-eyebrow">{copy.catalog}</p>
                    <h2 id={`${unitSlug}-menu-panel-title`}>{copy.menu}</h2>
                  </div>
                  <span>{copy.showing(filteredItems.length)}</span>
                </div>
                <div className="admin-table-wrap">
                  <table className="admin-table cafe-item-table">
                    <thead>
                      <tr>
                        <th>{copy.item}</th>
                        <th>{copy.price}</th>
                        <th>{copy.status}</th>
                        <th>{copy.availability}</th>
                        <th>
                          <span className="sr-only">{copy.actions}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedItems.map((item) => {
                        const currentActionMenu = actionMenu?.id === item.id ? actionMenu : null;
                        const isBusy = busyItemId === item.id;
                        return (
                          <tr key={item.id}>
                            <td className="cafe-item-cell" data-label={copy.item}>
                              <strong>{item.name}</strong>
                              <small>{unitCopy.itemSubline}</small>
                            </td>
                            <td data-label={copy.price}>{formatPrice(item, language, copy)}</td>
                            <td data-label={copy.status}>
                              <StatusPill active={item.active} copy={copy} />
                            </td>
                            <td data-label={copy.availability}>
                              <AvailabilityPill available={item.available} copy={copy} />
                            </td>
                            <td className="admin-table-actions">
                              <div className="admin-action-menu">
                                <button
                                  aria-label={`${copy.actions}: ${item.name}`}
                                  aria-expanded={currentActionMenu !== null}
                                  aria-controls={`${unitSlug}-item-actions-${item.id}`}
                                  aria-haspopup="menu"
                                  className="admin-more-button"
                                  disabled={isBusy}
                                  onClick={(event) => toggleActionMenu(item.id, event)}
                                  type="button"
                                >
                                  <MoreIcon />
                                </button>
                                {currentActionMenu &&
                                  createPortal(
                                    <div
                                      id={`${unitSlug}-item-actions-${item.id}`}
                                      className="admin-hover-actions"
                                      role="menu"
                                      style={{
                                        left: currentActionMenu.left,
                                        top: currentActionMenu.top,
                                      }}
                                    >
                                      <button
                                        onClick={() => {
                                          setActionMenu(null);
                                          setDrawer({ type: 'edit-item', item });
                                        }}
                                        role="menuitem"
                                        type="button"
                                      >
                                        {copy.edit}
                                      </button>
                                      <button
                                        onClick={() => void toggleAvailability(item)}
                                        role="menuitem"
                                        type="button"
                                      >
                                        {item.available ? copy.markUnavailable : copy.markAvailable}
                                      </button>
                                      <button
                                        onClick={() => void toggleActive(item)}
                                        role="menuitem"
                                        type="button"
                                      >
                                        {item.active ? copy.deactivate : copy.activate}
                                      </button>
                                    </div>,
                                    document.body,
                                  )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <CafePagination
                    copy={copy}
                    currentPage={currentPage}
                    onPageChange={setMenuPage}
                    totalItems={filteredItems.length}
                    totalPages={totalPages}
                  />
                )}
              </section>
            )}
          </section>
        </main>
      </div>

      {toast.length > 0 && (
        <div className="admin-toast" role="status">
          <CheckIcon />
          <span>{toast}</span>
        </div>
      )}

      {drawer?.type === 'create-item' && (
        <ItemDrawer
          copy={copy}
          item={null}
          itemKind={itemKind}
          onClose={() => setDrawer(null)}
          onSaved={replaceItem}
          unit={unit}
          unitCopy={unitCopy}
        />
      )}
      {drawer?.type === 'edit-item' && (
        <ItemDrawer
          copy={copy}
          item={drawer.item}
          itemKind={itemKind}
          onClose={() => setDrawer(null)}
          onSaved={replaceItem}
          unit={unit}
          unitCopy={unitCopy}
        />
      )}
    </div>
  );
}

export function CafeWorkspace(props: CafeWorkspaceProps) {
  return (
    <CatalogWorkspace
      authCopy={props.authCopy}
      catalogCopy={props.authCopy.cafe}
      itemKind="PRODUCT"
      language={props.language}
      onLanguageChange={props.onLanguageChange}
      onNavigate={(page) => props.onNavigate(page === 'menu' ? 'menu' : 'orders')}
      onSignOut={props.onSignOut}
      unit="CAFE"
      unitCopy={catalogUnitCopy[props.language].CAFE}
      user={props.user}
    />
  );
}
