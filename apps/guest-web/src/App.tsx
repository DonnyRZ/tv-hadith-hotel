import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  createGuestApiClient,
  GuestApiError,
  type GuestContext,
  type GuestDepartmentUnit,
  type GuestMenuCategory,
  type GuestMenuItem,
  type GuestMenuVariant,
  type GuestRequest,
  type GuestRequestGroup,
  type RequestStatus,
  type UnitCode,
} from '@room-service/api-client';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, type Language } from '@room-service/translations';

import {
  ABOUT_FEATURES,
  DESTINATIONS,
  GALLERY_ITEM_LABELS,
  localize,
  SERVICE_ENTRIES,
  type IconName,
  UI_COPY,
  unitLabel,
} from './content';
import {
  GALLERY_BRAND_LABELS,
  GALLERY_MANIFEST,
  STAY_ROOM_GALLERY_ORDER,
  type GalleryBrand,
  type GalleryId,
  type GalleryItem,
  type StayRoomType,
} from './gallery-manifest';
import { getStaySummary } from './stay-summary';

const MENU_PAGE_SIZE = 10;
const UNIT_CODES: readonly UnitCode[] = [
  'CAFE',
  'RESTAURANT',
  'LOUNGE',
  'SPA',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
  'BUTIK_INDONESIA',
];

type View =
  'home' | 'service' | 'fnb' | 'menu' | 'about' | 'about-gallery' | 'destinations' | 'requests';

interface RouteState {
  view: View;
  unit?: UnitCode;
  gallery?: GalleryId;
  brand?: GalleryBrand;
}

interface CartLine {
  item: GuestMenuItem;
  variantId?: string | null;
  variant?: GuestMenuVariant;
  quantity: number;
  note: string;
}

function cartKey(itemId: string, variantId?: string | null): string {
  return `${itemId}:${variantId ?? ''}`;
}

function groupCartLines(lines: readonly CartLine[]): Array<[UnitCode, CartLine[]]> {
  const groups = new Map<UnitCode, CartLine[]>();
  for (const line of lines) {
    const current = groups.get(line.item.unit) ?? [];
    current.push(line);
    groups.set(line.item.unit, current);
  }
  return [...groups.entries()];
}

interface GuestMenuPage {
  items: GuestMenuItem[];
  categories?: GuestMenuCategory[];
  page: number;
  pageSize: number;
  total: number;
}

interface GuestRequestPage {
  items: GuestRequest[];
  page: number;
  pageSize: number;
  total: number;
}

const DESTINATION_COUNT = DESTINATIONS.length;

function parseRoute(): RouteState {
  const hash = window.location.hash.replace(/^#/, '').replace(/\/$/, '');
  if (hash === 'service') return { view: 'service' };
  if (hash === 'service/fnb') return { view: 'fnb' };
  if (hash === 'about') return { view: 'about' };
  if (hash === 'about/stay') return { view: 'about-gallery', gallery: 'stay' };
  if (hash === 'about/rest') return { view: 'about-gallery', gallery: 'rest' };
  if (hash === 'about/taste' || hash === 'about/taste/saji') {
    return { brand: 'saji', gallery: 'taste', view: 'about-gallery' };
  }
  if (hash === 'about/taste/7oz') {
    return { brand: '7oz', gallery: 'taste', view: 'about-gallery' };
  }
  if (hash === 'destinations') return { view: 'destinations' };
  if (hash === 'requests') return { view: 'requests' };
  if (hash.startsWith('menu/')) {
    const unit = hash.slice('menu/'.length).toUpperCase();
    if (isUnitCode(unit)) return { view: 'menu', unit };
  }
  return { view: 'home' };
}

function isUnitCode(value: string): value is UnitCode {
  return UNIT_CODES.includes(value as UnitCode);
}

function readGuestToken(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const queryToken = params.get('access_token') ?? params.get('token');
  const configuredToken = import.meta.env.VITE_GUEST_ACCESS_TOKEN;
  const token = queryToken ?? configuredToken;
  return token === null || token === undefined || token.trim().length === 0 ? undefined : token;
}

function createClientRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getLocale(language: Language): string {
  if (language === 'uz') return 'uz-UZ';
  if (language === 'ru') return 'ru-RU';
  return 'en-GB';
}

function formatPrice(item: GuestMenuItem, language: Language, priceNotSet: string): string {
  if (item.price === null || item.currency === null) return priceNotSet;
  try {
    return new Intl.NumberFormat(getLocale(language), {
      currency: item.currency,
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(item.price);
  } catch {
    return `${item.price.toLocaleString(getLocale(language))} ${item.currency}`;
  }
}

function formatVariantPrice(variant: GuestMenuVariant, language: Language): string {
  try {
    return new Intl.NumberFormat(getLocale(language), {
      currency: variant.currency,
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(variant.price);
  } catch {
    return `${variant.price.toLocaleString(getLocale(language))} ${variant.currency}`;
  }
}

function formatDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(getLocale(language), {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function mediaUrl(mediaId: string): string {
  const apiBase = (import.meta.env.VITE_API_BASE_URL ?? '/api/v1').replace(/\/$/, '');
  return `${apiBase}/media/${encodeURIComponent(mediaId)}`;
}

function menuItemName(item: GuestMenuItem, language: Language): string {
  return localize(item.localizedName, language) || item.name;
}

function menuItemDescription(item: GuestMenuItem, language: Language): string {
  return localize(item.localizedDescription, language) || item.description || '';
}

function requestItemName(item: GuestRequest['items'][number], language: Language): string {
  return localize(item.localizedName, language) || item.name;
}

function requestItemVariant(item: GuestRequest['items'][number], language: Language): string {
  const options = (item.variantOptions ?? [])
    .map((option) => {
      const label = localize(option.label, language);
      const value = localize(option.value, language);
      return label.length > 0 && value.length > 0 ? `${label}: ${value}` : value || label;
    })
    .filter((value) => value.length > 0)
    .join(' · ');
  return options || item.sku || '';
}

function getRequestStatusLabel(status: RequestStatus, language: Language): string {
  const copy = UI_COPY[language];
  if (status === 'IN_PROCESS') return copy.statusInProcess;
  if (status === 'COMPLETED') return copy.statusCompleted;
  if (status === 'CANCELLED') return copy.statusCancelled;
  return copy.statusNew;
}

function getErrorMessage(error: unknown, language: Language): string {
  const copy = UI_COPY[language];
  if (error instanceof GuestApiError && error.status === 401) return copy.accessError;
  if (
    error instanceof GuestApiError &&
    error.status === 404 &&
    error.code === 'CONTEXT_NOT_FOUND'
  ) {
    return copy.accessNotReady;
  }
  if (error instanceof GuestApiError && error.code === 'MENU_NOT_CONFIGURED') {
    return copy.menuNotConfigured;
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) return copy.offline;
  return copy.unavailable;
}

function getBackRoute(route: RouteState): string {
  if (route.view === 'menu')
    return route.unit === 'RESTAURANT' || route.unit === 'LOUNGE' ? '#service/fnb' : '#service';
  if (route.view === 'fnb') return '#service';
  if (route.view === 'about-gallery') return '#about';
  return '#home';
}

function resetPageScroll() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  window.scrollTo(0, 0);
}

export default function App() {
  const token = useMemo(readGuestToken, []);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [route, setRoute] = useState<RouteState>(() => parseRoute());
  const [menuPage, setMenuPage] = useState(1);
  const [menuCategoryId, setMenuCategoryId] = useState<string | undefined>(undefined);
  const [menuCategories, setMenuCategories] = useState<GuestMenuCategory[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [sentRequestGroup, setSentRequestGroup] = useState<GuestRequestGroup | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const copy = UI_COPY[language];

  const api = useMemo(
    () =>
      createGuestApiClient({
        baseUrl: import.meta.env.VITE_API_BASE_URL ?? '/api/v1',
        getGuestAccessToken: () => token,
      }),
    [token],
  );

  const contextQuery = useQuery({
    enabled: token !== undefined,
    queryFn: api.getContext,
    queryKey: ['guest', 'context'],
  });
  const departmentsQuery = useQuery({
    enabled: contextQuery.data !== undefined,
    queryFn: api.listDepartments,
    queryKey: ['guest', 'departments'],
  });
  const departments = departmentsQuery.data?.items ?? [];
  const unitRecords = useMemo(() => {
    const records = new Map<UnitCode, GuestDepartmentUnit>();
    for (const department of departments) {
      for (const unit of department.units) records.set(unit.code, unit);
    }
    return records;
  }, [departments]);
  const isUnitEnabled = useCallback(
    (unit: UnitCode) => {
      const record = unitRecords.get(unit);
      const includedByContext = contextQuery.data?.availableUnits.includes(unit) ?? false;
      return includedByContext && record?.enabled !== false;
    },
    [contextQuery.data?.availableUnits, unitRecords],
  );
  const activeMenuUnit = route.view === 'menu' ? route.unit : undefined;
  const menuQuery = useQuery({
    enabled:
      contextQuery.data !== undefined &&
      activeMenuUnit !== undefined &&
      isUnitEnabled(activeMenuUnit),
    queryFn: () =>
      api.listMenus({
        page: menuPage,
        pageSize: MENU_PAGE_SIZE,
        unit: activeMenuUnit!,
        ...(activeMenuUnit === 'BUTIK_INDONESIA' && menuCategoryId !== undefined
          ? { categoryId: menuCategoryId }
          : {}),
      }),
    queryKey: ['guest', 'menu', activeMenuUnit, menuCategoryId, menuPage],
  });
  const requestsQuery = useQuery({
    enabled: contextQuery.data !== undefined && route.view === 'requests',
    queryFn: () => api.listRequests({ page: 1, pageSize: 50 }),
    queryKey: ['guest', 'requests'],
    refetchInterval: route.view === 'requests' ? 30_000 : false,
  });

  const contextIdentity =
    contextQuery.data === undefined
      ? null
      : `${contextQuery.data.room.id}:${contextQuery.data.welcome.guestName}`;
  const previousContextIdentity = useRef<string | null>(null);

  useEffect(() => {
    if (contextQuery.isError || contextIdentity === null) {
      previousContextIdentity.current = null;
      setCart([]);
      setRequestOpen(false);
      setRequestNote('');
      setClientRequestId(null);
      setSentRequestGroup(null);
      return;
    }

    if (
      previousContextIdentity.current !== null &&
      previousContextIdentity.current !== contextIdentity
    ) {
      setCart([]);
      setRequestOpen(false);
      setRequestNote('');
      setClientRequestId(null);
      setSentRequestGroup(null);
    }
    previousContextIdentity.current = contextIdentity;
  }, [contextIdentity, contextQuery.isError]);

  const navigate = useCallback((path: string) => {
    if (window.location.hash !== path) {
      window.history.pushState(null, '', path);
    }
    setRoute(parseRoute());
    resetPageScroll();
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  useEffect(() => {
    resetPageScroll();
    let timeoutId: number | undefined;
    const frameId = window.requestAnimationFrame(() => {
      resetPageScroll();
      timeoutId = window.setTimeout(resetPageScroll, 0);
    });
    return () => {
      window.cancelAnimationFrame(frameId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [menuPage, route.brand, route.gallery, route.unit, route.view]);

  useEffect(() => {
    setMenuPage(1);
    setMenuCategoryId(undefined);
    setMenuCategories([]);
  }, [activeMenuUnit]);

  useEffect(() => {
    setMenuPage(1);
  }, [menuCategoryId]);

  useEffect(() => {
    if (activeMenuUnit !== 'BUTIK_INDONESIA') return;
    const incoming = menuQuery.data?.items ?? [];
    const incomingCategories = menuQuery.data?.categories ?? [];
    setMenuCategories((current) => {
      const next = new Map(current.map((category) => [category.id, category]));
      for (const category of incomingCategories) next.set(category.id, category);
      for (const item of incoming) {
        if (item.category !== undefined) next.set(item.category.id, item.category);
      }
      return [...next.values()].sort((left, right) => left.sortOrder - right.sortOrder);
    });
  }, [activeMenuUnit, menuQuery.data?.categories, menuQuery.data?.items]);

  useEffect(() => {
    const total = menuQuery.data?.total;
    const pageSize = menuQuery.data?.pageSize ?? MENU_PAGE_SIZE;
    if (total === undefined) return;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    setMenuPage((page) => Math.min(page, pageCount));
  }, [menuQuery.data?.pageSize, menuQuery.data?.total]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `Hadith Hotel · ${copy.guestServices}`;
  }, [copy.guestServices, language]);

  useEffect(() => {
    if (toast === null) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle('drawer-open', requestOpen);
    return () => document.body.classList.remove('drawer-open');
  }, [requestOpen]);

  const openService = useCallback(
    (key: UnitCode | 'FOOD_AND_BEVERAGES') => {
      if (key === 'FOOD_AND_BEVERAGES') {
        navigate('#service/fnb');
        return;
      }
      if (!isUnitEnabled(key)) {
        notify(copy.menuNotConfigured);
        return;
      }
      navigate(`#menu/${key}`);
    },
    [copy.menuNotConfigured, isUnitEnabled, navigate, notify],
  );

  const addToCart = useCallback(
    (item: GuestMenuItem, variantId?: string | null) => {
      if (isSubmitting) return;
      const variant = item.variants?.find((candidate) => candidate.id === variantId);
      if (
        item.unit === 'BUTIK_INDONESIA' &&
        (variant === undefined || variant.availableQuantity <= 0)
      ) {
        notify(copy.boutiqueOutOfStock);
        return;
      }
      setCart((current) => {
        const key = cartKey(item.id, variantId);
        const existing = current.find((line) => cartKey(line.item.id, line.variantId) === key);
        if (existing === undefined) {
          const variantFields =
            variantId === undefined || variant === undefined ? {} : { variantId, variant };
          return [...current, { item, note: '', quantity: 1, ...variantFields }];
        }
        const maxQuantity = variant?.availableQuantity;
        return current.map((line) =>
          cartKey(line.item.id, line.variantId) === key
            ? {
                ...line,
                quantity:
                  item.quantityAllowed && (maxQuantity === undefined || line.quantity < maxQuantity)
                    ? line.quantity + 1
                    : line.quantity,
              }
            : line,
        );
      });
      notify(copy.addToRequest);
    },
    [copy.addToRequest, copy.boutiqueOutOfStock, isSubmitting, notify],
  );

  const updateCartLine = useCallback(
    (lineKey: string, change: number) => {
      if (isSubmitting) return;
      setCart((current) =>
        current.flatMap((line) => {
          if (cartKey(line.item.id, line.variantId) !== lineKey) return [line];
          const nextQuantity = line.quantity + change;
          const maxQuantity =
            line.variant?.availableQuantity ?? (line.item.quantityAllowed ? 100 : 1);
          const boundedQuantity = Math.min(nextQuantity, maxQuantity);
          return boundedQuantity > 0 ? [{ ...line, quantity: boundedQuantity }] : [];
        }),
      );
    },
    [isSubmitting],
  );

  const updateCartNote = useCallback(
    (lineKey: string, note: string) => {
      if (isSubmitting) return;
      setCart((current) =>
        current.map((line) =>
          cartKey(line.item.id, line.variantId) === lineKey ? { ...line, note } : line,
        ),
      );
    },
    [isSubmitting],
  );

  const openRequest = useCallback(() => {
    if (cart.length === 0) return;
    setSentRequestGroup(null);
    setRequestOpen(true);
  }, [cart.length]);

  const closeRequest = useCallback(() => {
    setRequestOpen(false);
    setSentRequestGroup(null);
    setRequestNote('');
  }, []);

  useEffect(() => {
    if (requestOpen && sentRequestGroup === null && cart.length === 0) closeRequest();
  }, [cart.length, closeRequest, requestOpen, sentRequestGroup]);

  useEffect(() => {
    if (!requestOpen && cart.length === 0) setClientRequestId(null);
  }, [cart.length, requestOpen]);

  useEffect(() => {
    if (!requestOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRequest();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeRequest, requestOpen]);

  const submitRequest = useCallback(async () => {
    if (cart.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    const idempotencyKey = clientRequestId ?? createClientRequestId();
    setClientRequestId(idempotencyKey);
    try {
      const requestGroup = await api.createRequestGroup({
        clientRequestId: idempotencyKey,
        guestNote: requestNote.trim().length > 0 ? requestNote.trim() : null,
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          note: line.note.trim().length > 0 ? line.note.trim() : null,
          quantity: line.quantity,
          ...(line.variantId === undefined ? {} : { variantId: line.variantId }),
        })),
      });
      setSentRequestGroup(requestGroup);
      setCart([]);
      setRequestNote('');
      setClientRequestId(null);
      await queryClient.invalidateQueries({ queryKey: ['guest', 'requests'] });
    } catch (error) {
      notify(getErrorMessage(error, language));
    } finally {
      setIsSubmitting(false);
    }
  }, [api, cart, clientRequestId, isSubmitting, language, notify, queryClient, requestNote]);

  const cartCount = cart.reduce((total, line) => total + line.quantity, 0);

  return (
    <div className="guest-app">
      <div className="guest-scene" aria-hidden="true" />
      <div className="guest-frame">
        <Header
          context={contextQuery.data}
          language={language}
          onLanguageChange={setLanguage}
          onNavigate={navigate}
          route={route}
        />
        <div className="guest-content">
          {token === undefined ? (
            <AccessState language={language} />
          ) : contextQuery.isPending ? (
            <LoadingState language={language} />
          ) : contextQuery.isError || contextQuery.data === undefined ? (
            <ErrorState
              error={contextQuery.error}
              language={language}
              onRetry={() => void contextQuery.refetch()}
            />
          ) : (
            <>
              {route.view === 'home' && (
                <HomeView context={contextQuery.data} language={language} onNavigate={navigate} />
              )}
              {route.view === 'service' && (
                <ServicesView
                  language={language}
                  isUnitEnabled={isUnitEnabled}
                  onBack={() => navigate('#home')}
                  onOpenService={openService}
                />
              )}
              {route.view === 'fnb' && (
                <FnbView
                  language={language}
                  isUnitEnabled={isUnitEnabled}
                  onBack={() => navigate('#service')}
                  onOpenUnit={(unit) => openService(unit)}
                />
              )}
              {route.view === 'menu' && activeMenuUnit !== undefined && (
                <MenuView
                  cart={cart}
                  cartCount={cartCount}
                  language={language}
                  menuQuery={menuQuery}
                  categoryId={menuCategoryId}
                  categories={menuCategories}
                  onCategoryChange={setMenuCategoryId}
                  onAdd={addToCart}
                  onBack={() => navigate(getBackRoute(route))}
                  onNext={() => setMenuPage((page) => page + 1)}
                  onPrevious={() => setMenuPage((page) => Math.max(1, page - 1))}
                  onRemove={updateCartLine}
                  onRequest={openRequest}
                  page={menuPage}
                  serviceAvailable={isUnitEnabled(activeMenuUnit)}
                  unit={activeMenuUnit}
                />
              )}
              {route.view === 'about' && (
                <AboutView
                  language={language}
                  onBack={() => navigate('#home')}
                  onOpenGallery={(gallery) =>
                    navigate(gallery === 'taste' ? '#about/taste/saji' : `#about/${gallery}`)
                  }
                />
              )}
              {route.view === 'about-gallery' && route.gallery !== undefined && (
                <AboutGalleryView
                  brand={route.brand}
                  gallery={route.gallery}
                  language={language}
                  onBack={() => navigate('#about')}
                  onBrandChange={(brand) => navigate(`#about/taste/${brand}`)}
                />
              )}
              {route.view === 'destinations' && (
                <DestinationsView language={language} onBack={() => navigate('#home')} />
              )}
              {route.view === 'requests' && (
                <RequestsView
                  language={language}
                  onBack={() => navigate('#home')}
                  query={requestsQuery}
                />
              )}
            </>
          )}
        </div>
        <Footer language={language} />
      </div>
      {toast !== null && <Toast message={toast} />}
      <RequestDrawer
        cart={cart}
        isSubmitting={isSubmitting}
        language={language}
        onClose={closeRequest}
        onNoteChange={updateCartNote}
        onRequestNoteChange={setRequestNote}
        onRemove={updateCartLine}
        onSubmit={() => void submitRequest()}
        onViewRequests={() => {
          closeRequest();
          navigate('#requests');
        }}
        open={requestOpen}
        requestNote={requestNote}
        sentRequestGroup={sentRequestGroup}
      />
    </div>
  );
}

interface HeaderProps {
  context: GuestContext | undefined;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigate: (path: string) => void;
  route: RouteState;
}

function Header({ context, language, onLanguageChange, onNavigate, route }: HeaderProps) {
  const copy = UI_COPY[language];
  return (
    <header className="topbar">
      <button className="brand-lockup" type="button" onClick={() => onNavigate('#home')}>
        <span className="brand-mark">
          <img alt="Hadith Hotel" src="/assets/hadith-hotel/brand/logo-hadith-2.png" />
        </span>
        <span className="brand-copy">
          <strong>HADITH HOTEL</strong>
          <small>{copy.guestServices}</small>
        </span>
      </button>
      <div className="topbar-actions">
        <LanguageSwitcher language={language} onChange={onLanguageChange} />
        {context !== undefined && route.view !== 'requests' && (
          <button
            aria-label={copy.requests}
            className="requests-link"
            type="button"
            onClick={() => onNavigate('#requests')}
          >
            <Icon name="requests" size={17} />
            <span>{copy.requests}</span>
          </button>
        )}
      </div>
    </header>
  );
}

function LanguageSwitcher({
  language,
  onChange,
}: {
  language: Language;
  onChange: (language: Language) => void;
}) {
  const copy = UI_COPY[language];
  return (
    <div className="language-switcher" aria-label={copy.language} role="group">
      <Icon name="language" size={16} />
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          aria-pressed={language === option.code}
          className={language === option.code ? 'language-option is-active' : 'language-option'}
          key={option.code}
          type="button"
          onClick={() => onChange(option.code)}
        >
          {option.code === 'uz' ? 'UZ' : option.code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function HomeView({
  context,
  language,
  onNavigate,
}: {
  context: Pick<GuestContext, 'room' | 'stay' | 'welcome'>;
  language: Language;
  onNavigate: (path: string) => void;
}) {
  const copy = UI_COPY[language];
  return (
    <main className="page page-home">
      <section className="welcome-block" aria-labelledby="welcome-title">
        <p className="eyebrow">
          <Icon name="spark" size={15} /> {copy.homeKicker}
        </p>
        <h1 id="welcome-title">
          {copy.welcomeGuest}, <em>{context.welcome.guestName}</em>
        </h1>
        <p className="hero-description">{copy.homeDescription}</p>
        <StaySummary language={language} roomNumber={context.room.number} stay={context.stay} />
      </section>
      <section className="home-actions" aria-label={copy.allServices}>
        <HomeAction
          description={copy.serviceDescription}
          icon="spark"
          index="01"
          label={copy.services}
          onClick={() => onNavigate('#service')}
        />
        <HomeAction
          description={copy.aboutDescription}
          icon="building"
          index="02"
          label={copy.about}
          onClick={() => onNavigate('#about')}
        />
        <HomeAction
          description={copy.destinationsDescription}
          icon="map"
          index="03"
          label={copy.destinations}
          onClick={() => onNavigate('#destinations')}
        />
      </section>
      <p className="home-footnote">
        <Icon name="check" size={15} /> {copy.trackRequests}
      </p>
    </main>
  );
}

function StaySummary({
  language,
  roomNumber,
  stay,
}: {
  language: Language;
  roomNumber: string;
  stay: GuestContext['stay'] | undefined;
}) {
  const copy = UI_COPY[language];
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refreshNow = () => setNow(new Date());
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };

    const interval = window.setInterval(refreshNow, 60_000);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', refreshNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', refreshNow);
    };
  }, [stay?.checkOutAt]);

  const summary = getStaySummary(stay, now);
  const formattedCheckOut =
    stay === undefined ? '' : formatStayDate(stay.checkOutAt, language, stay.timeZone);
  const formattedCheckOutTime =
    stay === undefined ? '' : formatStayTime(stay.checkOutAt, language, stay.timeZone);
  const checkOutValue =
    summary?.isCheckOutToday === true
      ? copy.stayCheckOutToday(formattedCheckOutTime)
      : formattedCheckOut;

  return (
    <div
      aria-label={copy.stayDetails}
      className={summary === null ? 'stay-summary is-unavailable' : 'stay-summary'}
    >
      <div className="stay-summary-item stay-summary-room">
        <span className="stay-summary-icon">
          <Icon name="building" size={17} />
        </span>
        <span className="stay-summary-copy">
          <span className="stay-summary-label">{copy.room}</span>
          <strong>{roomNumber}</strong>
        </span>
      </div>
      <div className="stay-summary-item stay-summary-duration">
        <span className="stay-summary-label">{copy.stayDetails}</span>
        <strong aria-live="polite">
          {summary === null
            ? copy.stayUnavailable
            : summary.isExpired
              ? copy.stayEnded
              : copy.stayDaysRemaining(summary.daysRemaining)}
        </strong>
        {summary !== null && stay !== undefined && (
          <span className="stay-summary-detail">{copy.stayTotalDays(stay.totalDays)}</span>
        )}
      </div>
      {summary !== null && stay !== undefined && (
        <div className="stay-summary-item stay-summary-checkout">
          <span className="stay-summary-label">{copy.stayCheckOut}</span>
          <time dateTime={stay.checkOutAt}>{checkOutValue}</time>
        </div>
      )}
    </div>
  );
}

function formatStayDate(value: string, language: Language, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(getLocale(language), {
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      month: 'long',
      timeZone,
      year: 'numeric',
    }).format(date);
  } catch {
    return formatDate(value, language);
  }
}

function formatStayTime(value: string, language: Language, timeZone: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(getLocale(language), {
      hour: '2-digit',
      minute: '2-digit',
      timeZone,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat(getLocale(language), {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }
}

function HomeAction({
  description,
  icon,
  index,
  label,
  onClick,
}: {
  description: string;
  icon: IconName;
  index: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className="home-action" type="button" onClick={onClick}>
      <span className="action-index">{index}</span>
      <span className="action-icon">
        <Icon name={icon} size={24} />
      </span>
      <span className="action-body">
        <strong>{label}</strong>
        <span>{description}</span>
      </span>
      <span className="action-arrow">
        <Icon name="arrow" size={20} />
      </span>
    </button>
  );
}

function ServicesView({
  language,
  isUnitEnabled,
  onBack,
  onOpenService,
}: {
  language: Language;
  isUnitEnabled: (unit: UnitCode) => boolean;
  onBack: () => void;
  onOpenService: (key: UnitCode | 'FOOD_AND_BEVERAGES') => void;
}) {
  const copy = UI_COPY[language];
  return (
    <main className="page page-inner">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.serviceKicker}
        onBack={onBack}
        title={copy.services}
        description={copy.serviceDescription}
      />
      <section className="service-grid" aria-label={copy.allServices}>
        {SERVICE_ENTRIES.map((entry, index) => {
          const enabled = entry.unitCodes.some(isUnitEnabled);
          return (
            <button
              className={enabled ? 'service-card' : 'service-card is-muted'}
              disabled={!enabled}
              key={entry.key}
              type="button"
              onClick={() => {
                if (enabled) onOpenService(entry.key);
              }}
            >
              <span className="service-card-top">
                <span className="service-number">0{index + 1}</span>
                <span className="service-icon">
                  <Icon name={entry.icon} size={25} />
                </span>
              </span>
              <span className="service-card-copy">
                <strong>{localize(entry.title, language)}</strong>
                <span>{localize(entry.description, language)}</span>
              </span>
              <span className="service-card-bottom">
                <span>{enabled ? copy.explore : copy.unavailable}</span>
                <Icon name="arrow" size={18} />
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function FnbView({
  language,
  isUnitEnabled,
  onBack,
  onOpenUnit,
}: {
  language: Language;
  isUnitEnabled: (unit: UnitCode) => boolean;
  onBack: () => void;
  onOpenUnit: (unit: UnitCode) => void;
}) {
  const copy = UI_COPY[language];
  const units: readonly UnitCode[] = ['RESTAURANT', 'LOUNGE'];
  return (
    <main className="page page-inner">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.fnb}
        onBack={onBack}
        title={copy.fnb}
        description={copy.fnbDescription}
      />
      <section className="unit-grid" aria-label={copy.fnb}>
        {units.map((unit, index) => {
          const enabled = isUnitEnabled(unit);
          return (
            <button
              className={enabled ? 'unit-card' : 'unit-card is-disabled'}
              key={unit}
              type="button"
              onClick={() => {
                if (enabled) onOpenUnit(unit);
              }}
              disabled={!enabled}
            >
              <span className="unit-card-visual">
                <span className="unit-card-overlay" />
                <img
                  alt=""
                  src={
                    unit === 'RESTAURANT'
                      ? '/assets/hadith-hotel/about/saji-nusantara.png'
                      : '/assets/hadith-hotel/about/hotel-exterior.png'
                  }
                />
                <span className="unit-card-index">0{index + 1}</span>
              </span>
              <span className="unit-card-content">
                <span className="unit-card-heading">
                  <strong>{unitLabel(unit, language)}</strong>
                  <Icon name={enabled ? 'arrow' : 'close'} size={18} />
                </span>
                <span>{enabled ? copy.explore : copy.menuNotConfigured}</span>
              </span>
            </button>
          );
        })}
      </section>
    </main>
  );
}

function MenuView({
  cart,
  cartCount,
  categoryId,
  categories,
  language,
  menuQuery,
  onAdd,
  onBack,
  onCategoryChange,
  onNext,
  onPrevious,
  onRemove,
  onRequest,
  page,
  serviceAvailable,
  unit,
}: {
  cart: CartLine[];
  cartCount: number;
  categoryId?: string | undefined;
  categories: GuestMenuCategory[];
  language: Language;
  menuQuery: UseQueryResult<GuestMenuPage, Error>;
  onAdd: (item: GuestMenuItem, variantId?: string | null) => void;
  onBack: () => void;
  onCategoryChange: (categoryId: string | undefined) => void;
  onNext: () => void;
  onPrevious: () => void;
  onRemove: (lineKey: string, change: number) => void;
  onRequest: () => void;
  page: number;
  serviceAvailable: boolean;
  unit: UnitCode;
}) {
  const copy = UI_COPY[language];
  const result = menuQuery.data;
  const total = result?.total ?? 0;
  const pageSize = result?.pageSize ?? MENU_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = result?.items ?? [];
  return (
    <main className="page page-inner page-menu">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.menu}
        onBack={onBack}
        title={unitLabel(unit, language)}
        description={copy.serviceDescription}
        trailing={
          cartCount > 0 ? (
            <button className="request-launcher" type="button" onClick={onRequest}>
              <span className="request-launcher-count">{cartCount}</span>
              <span>{copy.request}</span>
              <Icon name="arrow" size={17} />
            </button>
          ) : undefined
        }
      />
      {!serviceAvailable ? (
        <EmptyState icon="close" title={copy.menuNotConfigured} />
      ) : menuQuery.isPending ? (
        <MenuLoading />
      ) : menuQuery.isError ? (
        <InlineError language={language} onRetry={() => void menuQuery.refetch()} />
      ) : (
        <>
          {unit === 'BUTIK_INDONESIA' && categories.length > 0 && (
            <nav className="boutique-category-nav" aria-label={copy.boutiqueCategory}>
              <button
                className={categoryId === undefined ? 'is-active' : ''}
                type="button"
                onClick={() => onCategoryChange(undefined)}
              >
                {copy.boutiqueAll}
              </button>
              {categories.map((category) => (
                <button
                  className={categoryId === category.id ? 'is-active' : ''}
                  key={category.id}
                  type="button"
                  onClick={() => onCategoryChange(category.id)}
                >
                  {localize(category.localizedName, language)}
                </button>
              ))}
            </nav>
          )}
          {items.length === 0 ? (
            <EmptyState icon="spark" title={copy.noMenuItems} />
          ) : (
            <>
              <section
                className="menu-grid"
                aria-label={`${copy.menu}: ${unitLabel(unit, language)}`}
              >
                {items.map((item: GuestMenuItem) => (
                  <MenuCard
                    item={item}
                    key={item.id}
                    language={language}
                    onAdd={onAdd}
                    selectedQuantity={(variantId) =>
                      cart.find(
                        (line) =>
                          cartKey(line.item.id, line.variantId) === cartKey(item.id, variantId),
                      )?.quantity ?? 0
                    }
                    onRemove={onRemove}
                  />
                ))}
              </section>
              <nav className="pagination" aria-label={copy.menuPage}>
                <button
                  aria-label={copy.previous}
                  className="pagination-button"
                  disabled={page <= 1}
                  type="button"
                  onClick={onPrevious}
                >
                  <Icon name="back" size={17} />
                  <span>{copy.previous}</span>
                </button>
                <span className="pagination-status">
                  {copy.menuPage} <strong>{page}</strong> / {pageCount}
                </span>
                <button
                  aria-label={copy.next}
                  className="pagination-button pagination-button-next"
                  disabled={page >= pageCount}
                  type="button"
                  onClick={onNext}
                >
                  <span>{copy.next}</span>
                  <Icon name="chevron" size={17} />
                </button>
              </nav>
            </>
          )}
        </>
      )}
    </main>
  );
}

function MenuCard({
  item,
  language,
  onAdd,
  onRemove,
  selectedQuantity,
}: {
  item: GuestMenuItem;
  language: Language;
  onAdd: (item: GuestMenuItem, variantId?: string | null) => void;
  onRemove: (lineKey: string, change: number) => void;
  selectedQuantity: (variantId?: string | null) => number;
}) {
  const copy = UI_COPY[language];
  const description = menuItemDescription(item, language);
  const boutiqueVariants = (item.variants ?? []).filter((variant) => variant.active);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    boutiqueVariants.find((variant) => variant.availableQuantity > 0)?.id ??
      boutiqueVariants[0]?.id ??
      null,
  );
  useEffect(() => {
    if (
      selectedVariantId !== null &&
      boutiqueVariants.some((variant) => variant.id === selectedVariantId)
    )
      return;
    setSelectedVariantId(boutiqueVariants[0]?.id ?? null);
  }, [boutiqueVariants, selectedVariantId]);
  const selectedVariant = boutiqueVariants.find((variant) => variant.id === selectedVariantId);
  const lineKey = cartKey(item.id, selectedVariantId);
  const quantity = selectedQuantity(selectedVariantId);
  const unavailable =
    item.unit === 'BUTIK_INDONESIA' &&
    (selectedVariant === undefined || selectedVariant.availableQuantity <= 0);
  return (
    <article className={quantity > 0 ? 'menu-card is-selected' : 'menu-card'}>
      {item.imageMediaId !== null && (
        <div className="menu-card-image">
          <img src={mediaUrl(item.imageMediaId)} alt="" loading="lazy" />
        </div>
      )}
      <div className="menu-card-topline">
        <span className="menu-kind">
          <Icon name={item.kind === 'PRODUCT' ? 'utensils' : 'spark'} size={14} />
          {item.kind === 'PRODUCT' ? copy.menu : copy.services}
        </span>
        {quantity > 0 && (
          <span className="selected-mark">
            <Icon name="check" size={13} />
          </span>
        )}
      </div>
      <h2>{menuItemName(item, language)}</h2>
      {item.unit === 'BUTIK_INDONESIA' && selectedVariant !== undefined && (
        <div className="boutique-card-meta">
          <label>
            <span>{copy.boutiqueSelectVariant}</span>
            <select
              value={selectedVariantId ?? ''}
              onChange={(event) => setSelectedVariantId(event.target.value)}
            >
              {boutiqueVariants.map((variant) => (
                <option
                  disabled={variant.availableQuantity <= 0}
                  key={variant.id}
                  value={variant.id}
                >
                  {variant.options.map((option) => localize(option.value, language)).join(' · ') ||
                    variant.sku}
                </option>
              ))}
            </select>
          </label>
          <small>
            {copy.boutiqueSku}: {selectedVariant.sku} · {copy.boutiqueStock}:{' '}
            {selectedVariant.availableQuantity}
          </small>
        </div>
      )}
      {description.length > 0 ? (
        <p>{description}</p>
      ) : (
        <p className="menu-card-placeholder">&nbsp;</p>
      )}
      <div className="menu-card-footer">
        <span className="menu-price">
          {selectedVariant === undefined
            ? formatPrice(item, language, copy.priceNotSet)
            : formatVariantPrice(selectedVariant, language)}
        </span>
        {item.quantityAllowed && quantity > 0 ? (
          <span className="quantity-control" aria-label={copy.quantity}>
            <button type="button" onClick={() => onRemove(lineKey, -1)} aria-label={copy.remove}>
              <Icon name="minus" size={15} />
            </button>
            <strong>{quantity}</strong>
            <button
              disabled={
                selectedVariant !== undefined && quantity >= selectedVariant.availableQuantity
              }
              type="button"
              onClick={() => onAdd(item, selectedVariantId)}
              aria-label={copy.add}
            >
              <Icon name="plus" size={15} />
            </button>
          </span>
        ) : (
          <button
            className={quantity > 0 ? 'add-button is-added' : 'add-button'}
            disabled={unavailable}
            type="button"
            onClick={() => onAdd(item, selectedVariantId)}
          >
            <span>
              {unavailable ? copy.boutiqueOutOfStock : quantity > 0 ? quantity : copy.add}
            </span>
            <Icon name={quantity > 0 ? 'check' : 'plus'} size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

function galleryItemLabel(item: GalleryItem, language: Language): string {
  return localize(
    GALLERY_ITEM_LABELS[item.id] ?? {
      uz: item.caption,
      ru: item.caption,
      en: item.caption,
    },
    language,
  );
}

function GalleryImage({
  alt,
  className,
  item,
  loading = 'lazy',
}: {
  alt: string;
  className: string;
  item: GalleryItem;
  loading?: 'eager' | 'lazy';
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span aria-label={alt} className={`${className} gallery-image-fallback`} role="img">
        <Icon name="building" size={28} />
      </span>
    );
  }
  return (
    <img
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setFailed(true)}
      src={item.optimizedPath}
    />
  );
}

function AboutView({
  language,
  onBack,
  onOpenGallery,
}: {
  language: Language;
  onBack: () => void;
  onOpenGallery: (gallery: GalleryId) => void;
}) {
  const copy = UI_COPY[language];
  return (
    <main className="page page-inner page-about">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.aboutKicker}
        onBack={onBack}
        title={copy.about}
        description={copy.aboutDescription}
      />
      <section className="about-hero">
        <img alt="Hadith Hotel" src="/assets/hadith-hotel/about/hotel-exterior.png" />
        <div className="about-hero-overlay" />
        <div className="about-hero-copy">
          <span>{copy.aboutKicker}</span>
          <h2>{copy.aboutStory}</h2>
        </div>
      </section>
      <section className="about-features" aria-label={copy.hotelMoments}>
        {ABOUT_FEATURES.map((feature) => (
          <button
            aria-label={`${localize(feature.title, language)} · ${copy.explore}`}
            className="about-feature"
            key={feature.gallery}
            onClick={() => onOpenGallery(feature.gallery)}
            type="button"
          >
            <div className="about-feature-image">
              <img alt="" src={feature.image} />
            </div>
            <div className="about-feature-copy">
              <h2>{localize(feature.title, language)}</h2>
              <p>{localize(feature.body, language)}</p>
              <span className="about-feature-action">
                {copy.explore}
                <Icon name="arrow" size={15} />
              </span>
            </div>
          </button>
        ))}
      </section>
    </main>
  );
}

function AboutGalleryView({
  brand,
  gallery,
  language,
  onBack,
  onBrandChange,
}: {
  brand?: GalleryBrand | undefined;
  gallery: GalleryId;
  language: Language;
  onBack: () => void;
  onBrandChange: (brand: GalleryBrand) => void;
}) {
  const copy = UI_COPY[language];
  const activeBrand: GalleryBrand = brand ?? 'saji';
  const feature = ABOUT_FEATURES.find((entry) => entry.gallery === gallery);
  const title = feature === undefined ? copy.about : localize(feature.title, language);
  const description =
    gallery === 'stay'
      ? copy.galleryStayDescription
      : gallery === 'rest'
        ? copy.galleryRestDescription
        : copy.galleryTasteDescription;
  const [activeRoomType, setActiveRoomType] = useState<StayRoomType>('junior-suite');
  const items =
    gallery === 'taste'
      ? GALLERY_MANIFEST.taste.filter((item) => item.brand === activeBrand)
      : gallery === 'stay'
        ? GALLERY_MANIFEST.stay[activeRoomType].items
        : GALLERY_MANIFEST[gallery];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightboxCloseRef = useRef<HTMLButtonElement>(null);
  const stagePointerStartX = useRef<number | null>(null);
  const suppressStageClick = useRef(false);
  const activeItem = items[activeIndex] ?? items[0];

  useEffect(() => {
    setActiveIndex(0);
    setLightboxOpen(false);
  }, [activeBrand, activeRoomType, gallery]);

  useEffect(() => {
    if (!lightboxOpen) return undefined;
    lightboxCloseRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false);
      if (event.key === 'ArrowLeft') {
        setActiveIndex((index) => (index - 1 + items.length) % items.length);
      }
      if (event.key === 'ArrowRight') {
        setActiveIndex((index) => (index + 1) % items.length);
      }
    };
    document.body.classList.add('gallery-lightbox-open');
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.classList.remove('gallery-lightbox-open');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [items.length, lightboxOpen]);

  const selectPrevious = () => {
    if (items.length === 0) return;
    setActiveIndex((index) => (index - 1 + items.length) % items.length);
  };
  const selectNext = () => {
    if (items.length === 0) return;
    setActiveIndex((index) => (index + 1) % items.length);
  };

  if (activeItem === undefined) {
    return (
      <main className="page page-inner page-gallery">
        <PageHeader
          backLabel={copy.back}
          eyebrow={copy.aboutKicker}
          onBack={onBack}
          title={title}
          description={description}
        />
        <div className="gallery-empty" role="status">
          <Icon name="building" size={28} />
          <strong>{copy.galleryUnavailable}</strong>
        </div>
      </main>
    );
  }

  const activeLabel = galleryItemLabel(activeItem, language);
  const brandLabel = localize(GALLERY_BRAND_LABELS[activeBrand], language);
  const roomLabel =
    gallery === 'stay' ? localize(GALLERY_MANIFEST.stay[activeRoomType].label, language) : '';

  return (
    <main className="page page-inner page-gallery">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.aboutKicker}
        onBack={onBack}
        title={title}
        description={description}
      />
      {gallery === 'taste' && (
        <nav
          aria-label={copy.galleryTasteDescription}
          className="gallery-brand-tabs"
          role="tablist"
        >
          {(['saji', '7oz'] as const).map((entry) => {
            const selected = entry === activeBrand;
            return (
              <button
                aria-selected={selected}
                className={selected ? 'gallery-brand-tab is-active' : 'gallery-brand-tab'}
                key={entry}
                onClick={() => onBrandChange(entry)}
                role="tab"
                type="button"
              >
                {localize(GALLERY_BRAND_LABELS[entry], language)}
              </button>
            );
          })}
        </nav>
      )}
      {gallery === 'stay' && (
        <nav aria-label={title} className="gallery-room-tabs" role="tablist">
          {STAY_ROOM_GALLERY_ORDER.map((roomType) => {
            const selected = roomType === activeRoomType;
            const roomGallery = GALLERY_MANIFEST.stay[roomType];
            return (
              <button
                aria-selected={selected}
                className={selected ? 'gallery-room-tab is-active' : 'gallery-room-tab'}
                key={roomType}
                onClick={() => setActiveRoomType(roomType)}
                role="tab"
                type="button"
              >
                {localize(roomGallery.label, language)}
              </button>
            );
          })}
        </nav>
      )}
      <section aria-label={title} className="gallery-layout">
        <div className="gallery-main-column">
          <div className="gallery-stage" aria-live="polite">
            <button
              aria-label={`${copy.explore}: ${activeLabel}`}
              className="gallery-stage-trigger"
              onClick={() => {
                if (suppressStageClick.current) {
                  suppressStageClick.current = false;
                  return;
                }
                setLightboxOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowLeft') {
                  event.preventDefault();
                  selectPrevious();
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault();
                  selectNext();
                }
              }}
              onPointerCancel={() => {
                stagePointerStartX.current = null;
              }}
              onPointerDown={(event) => {
                stagePointerStartX.current = event.clientX;
              }}
              onPointerUp={(event) => {
                const startX = stagePointerStartX.current;
                stagePointerStartX.current = null;
                if (startX === null || items.length < 2) return;
                const deltaX = event.clientX - startX;
                if (Math.abs(deltaX) < 40) return;
                suppressStageClick.current = true;
                if (deltaX > 0) selectPrevious();
                else selectNext();
              }}
              type="button"
            >
              <GalleryImage
                key={activeItem.id}
                alt={activeItem.alt}
                className="gallery-stage-image"
                item={activeItem}
                loading="eager"
              />
              <span className="gallery-stage-gradient" />
              <span className="gallery-stage-open">{copy.explore}</span>
            </button>
            {items.length > 1 && (
              <>
                <button
                  aria-label={copy.previous}
                  className="gallery-stage-nav gallery-stage-nav-previous"
                  onClick={selectPrevious}
                  type="button"
                >
                  <Icon name="back" size={18} />
                </button>
                <button
                  aria-label={copy.next}
                  className="gallery-stage-nav gallery-stage-nav-next"
                  onClick={selectNext}
                  type="button"
                >
                  <Icon name="chevron" size={18} />
                </button>
              </>
            )}
          </div>
          <div className="gallery-caption-row">
            <div>
              <span className="eyebrow">
                {gallery === 'taste'
                  ? brandLabel
                  : gallery === 'stay'
                    ? roomLabel
                    : copy.aboutKicker}
              </span>
              <h2>{activeLabel}</h2>
            </div>
            <span className="gallery-counter">
              {copy.galleryPhotoCount(activeIndex + 1, items.length)}
            </span>
          </div>
        </div>
      </section>
      {lightboxOpen && (
        <div
          aria-label={activeLabel}
          aria-modal="true"
          className="gallery-lightbox"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
        >
          <div className="gallery-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <button
              aria-label={copy.close}
              className="gallery-lightbox-close"
              onClick={() => setLightboxOpen(false)}
              ref={lightboxCloseRef}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
            <GalleryImage
              key={activeItem.id}
              alt={activeItem.alt}
              className="gallery-lightbox-image"
              item={activeItem}
              loading="eager"
            />
            {items.length > 1 && (
              <>
                <button
                  aria-label={copy.previous}
                  className="gallery-lightbox-nav gallery-lightbox-nav-previous"
                  onClick={selectPrevious}
                  type="button"
                >
                  <Icon name="back" size={20} />
                </button>
                <button
                  aria-label={copy.next}
                  className="gallery-lightbox-nav gallery-lightbox-nav-next"
                  onClick={selectNext}
                  type="button"
                >
                  <Icon name="chevron" size={20} />
                </button>
              </>
            )}
            <div className="gallery-lightbox-footer">
              <strong>{activeLabel}</strong>
              <span>{copy.galleryPhotoCount(activeIndex + 1, items.length)}</span>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function DestinationsView({ language, onBack }: { language: Language; onBack: () => void }) {
  const copy = UI_COPY[language];
  const [activeIndex, setActiveIndex] = useState(0);
  const destination = DESTINATIONS[activeIndex]!;
  const goPrevious = () =>
    setActiveIndex((index) => (index - 1 + DESTINATION_COUNT) % DESTINATION_COUNT);
  const goNext = () => setActiveIndex((index) => (index + 1) % DESTINATION_COUNT);
  return (
    <main className="page page-inner page-destinations">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.destinationsKicker}
        onBack={onBack}
        title={copy.destinations}
        description={copy.destinationsDescription}
      />
      <section className="destination-feature" aria-live="polite">
        <div className="destination-video-wrap">
          <video
            controls
            key={destination.video}
            playsInline
            preload="metadata"
            src={destination.video}
          >
            {copy.videoUnavailable}
          </video>
          <span className="destination-counter">
            0{activeIndex + 1} / 0{DESTINATION_COUNT}
          </span>
        </div>
        <div className="destination-detail">
          <div className="destination-detail-heading">
            <span className="eyebrow">{localize(destination.eyebrow, language)}</span>
            <span className="distance-chip">
              <Icon name="map" size={14} /> {localize(destination.distance, language)}
            </span>
          </div>
          <h2>{localize(destination.title, language)}</h2>
          <p>{localize(destination.description, language)}</p>
          <div className="destination-facts">
            {destination.facts.map((fact) => (
              <span key={fact.en}>
                <Icon name="check" size={14} /> {localize(fact, language)}
              </span>
            ))}
          </div>
          <div className="destination-tags">
            {destination.tags.map((tag) => (
              <span key={tag.en}>{localize(tag, language)}</span>
            ))}
          </div>
          <div className="destination-navigation">
            <button
              aria-label={copy.previous}
              className="round-button"
              type="button"
              onClick={goPrevious}
            >
              <Icon name="back" size={18} />
            </button>
            <div className="destination-dots">
              {DESTINATIONS.map((entry, index) => (
                <button
                  aria-label={`${index + 1}`}
                  aria-pressed={activeIndex === index}
                  className={
                    activeIndex === index ? 'destination-dot is-active' : 'destination-dot'
                  }
                  key={entry.video}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                />
              ))}
            </div>
            <button aria-label={copy.next} className="round-button" type="button" onClick={goNext}>
              <Icon name="chevron" size={18} />
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function RequestsView({
  language,
  onBack,
  query,
}: {
  language: Language;
  onBack: () => void;
  query: UseQueryResult<GuestRequestPage, Error>;
}) {
  const copy = UI_COPY[language];
  return (
    <main className="page page-inner page-requests">
      <PageHeader
        backLabel={copy.back}
        eyebrow={copy.trackRequests}
        onBack={onBack}
        title={copy.requests}
        description={copy.requestStatus}
      />
      {query.isPending ? (
        <LoadingState language={language} compact />
      ) : query.isError ? (
        <InlineError language={language} onRetry={() => void query.refetch()} />
      ) : query.data.items.length === 0 ? (
        <EmptyState
          description={copy.noRequestsDescription}
          icon="requests"
          title={copy.noRequests}
        />
      ) : (
        <section className="requests-list">
          {groupGuestRequests(query.data.items).map((requests) => (
            <RequestCard
              key={requests[0]?.clientRequestId ?? requests[0]?.id}
              language={language}
              requests={requests}
            />
          ))}
        </section>
      )}
    </main>
  );
}

function groupGuestRequests(requests: readonly GuestRequest[]): GuestRequest[][] {
  const groups = new Map<string, GuestRequest[]>();
  for (const request of requests) {
    const group = groups.get(request.clientRequestId) ?? [];
    group.push(request);
    groups.set(request.clientRequestId, group);
  }
  return [...groups.values()];
}

function RequestCard({ language, requests }: { language: Language; requests: GuestRequest[] }) {
  const copy = UI_COPY[language];
  const request = requests[0];
  if (request === undefined) return null;
  const statusIndex =
    request.status === 'COMPLETED' || request.status === 'CANCELLED'
      ? 2
      : request.status === 'IN_PROCESS'
        ? 1
        : 0;
  const statusSteps: Array<{ status: RequestStatus; label: string }> =
    request.status === 'CANCELLED'
      ? [
          { label: copy.statusNew, status: 'NEW' },
          { label: copy.statusInProcess, status: 'IN_PROCESS' },
          { label: copy.statusCancelled, status: 'CANCELLED' },
        ]
      : [
          { label: copy.statusNew, status: 'NEW' },
          { label: copy.statusInProcess, status: 'IN_PROCESS' },
          { label: copy.statusCompleted, status: 'COMPLETED' },
        ];
  return (
    <article className="request-card">
      <div className="request-card-heading">
        <div>
          <span className="eyebrow">
            {requests.length > 1 ? copy.combinedRequest : unitLabel(request.unit, language)}
          </span>
          <h2>
            {requests.length > 1
              ? getCombinedRequestStatusLabel(requests, language)
              : getRequestStatusLabel(request.status, language)}
          </h2>
        </div>
        <time dateTime={request.requestedAt}>{formatDate(request.requestedAt, language)}</time>
      </div>
      <div className="request-group-services">
        {requests.map((serviceRequest) => (
          <section className="request-service-section" key={serviceRequest.id}>
            <div className="request-service-heading">
              <strong>{unitLabel(serviceRequest.unit, language)}</strong>
              <StatusPill language={language} status={serviceRequest.status} />
            </div>
            <div className="request-items">
              {serviceRequest.items.map((item) => (
                <div
                  className="request-item"
                  key={`${serviceRequest.id}:${item.menuItemId}:${item.variantId ?? ''}`}
                >
                  <span className="request-item-copy">
                    <span>{requestItemName(item, language)}</span>
                    {requestItemVariant(item, language).length > 0 && (
                      <small>{requestItemVariant(item, language)}</small>
                    )}
                  </span>
                  <strong>× {item.quantity}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      {requests.length === 1 && (
        <div className="status-track" aria-label={copy.requestStatus}>
          {statusSteps.map((step, index) => (
            <div
              className={index <= statusIndex ? 'status-step is-done' : 'status-step'}
              key={step.status}
            >
              <span className="status-step-dot">
                {index <= statusIndex ? <Icon name="check" size={11} /> : index + 1}
              </span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>
      )}
      {requests.length > 1 && (
        <div className="request-group-footnote">{copy.combinedRequestDescription}</div>
      )}
    </article>
  );
}

function getCombinedRequestStatusLabel(
  requests: readonly GuestRequest[],
  language: Language,
): string {
  const statuses = new Set(requests.map((request) => request.status));
  if (statuses.size === 1) return getRequestStatusLabel(requests[0]!.status, language);
  if (statuses.has('IN_PROCESS')) return UI_COPY[language].statusInProcess;
  if (statuses.has('NEW')) return UI_COPY[language].statusInProcess;
  if (statuses.has('COMPLETED')) return UI_COPY[language].statusCompleted;
  return UI_COPY[language].statusCancelled;
}

function RequestDrawer({
  cart,
  isSubmitting,
  language,
  onClose,
  onNoteChange,
  onRequestNoteChange,
  onRemove,
  onSubmit,
  onViewRequests,
  open,
  requestNote,
  sentRequestGroup,
}: {
  cart: CartLine[];
  isSubmitting: boolean;
  language: Language;
  onClose: () => void;
  onNoteChange: (lineKey: string, note: string) => void;
  onRequestNoteChange: (note: string) => void;
  onRemove: (lineKey: string, change: number) => void;
  onSubmit: () => void;
  onViewRequests: () => void;
  open: boolean;
  requestNote: string;
  sentRequestGroup: GuestRequestGroup | null;
}) {
  const copy = UI_COPY[language];
  if (!open) return null;
  return (
    <div
      className="drawer-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-label={copy.requestSummary}
        aria-modal="true"
        className="request-drawer"
        role="dialog"
      >
        <div className="drawer-handle" />
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">{copy.request}</span>
            <h2>{sentRequestGroup === null ? copy.requestSummary : copy.requestSubmitted}</h2>
          </div>
          <button aria-label={copy.close} className="drawer-close" type="button" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {sentRequestGroup !== null ? (
          <div className="request-success">
            <span className="success-icon">
              <Icon name="check" size={25} />
            </span>
            <p>
              {sentRequestGroup.requests.length > 1
                ? copy.combinedRequestSentDescription
                : copy.requestSentDescription}
            </p>
            <div className="request-success-services">
              {sentRequestGroup.requests.map((request) => (
                <div className="request-success-service" key={request.id}>
                  <span>{unitLabel(request.unit, language)}</span>
                  <StatusPill status={request.status} language={language} />
                </div>
              ))}
            </div>
            <button className="primary-button" type="button" onClick={onViewRequests}>
              {copy.viewRequests}
              <Icon name="arrow" size={18} />
            </button>
            <button className="text-button" type="button" onClick={onClose}>
              {copy.continueExploring}
            </button>
          </div>
        ) : (
          <>
            <p className="drawer-description">{copy.requestSheetDescription}</p>
            <div className="drawer-scroll">
              <div className="drawer-section-label">{copy.requestItems}</div>
              <div className="drawer-lines">
                {groupCartLines(cart).map(([unit, lines]) => (
                  <section className="drawer-service-group" key={unit}>
                    <div className="drawer-service-heading">{unitLabel(unit, language)}</div>
                    {lines.map((line) => (
                      <div className="drawer-line" key={cartKey(line.item.id, line.variantId)}>
                        <div className="drawer-line-top">
                          <div>
                            <strong>{menuItemName(line.item, language)}</strong>
                            <span>
                              {line.variant === undefined
                                ? formatPrice(line.item, language, copy.priceNotSet)
                                : `${formatVariantPrice(line.variant, language)} · ${line.variant.sku}`}
                            </span>
                          </div>
                          <button
                            className="remove-line"
                            disabled={isSubmitting}
                            type="button"
                            onClick={() =>
                              onRemove(cartKey(line.item.id, line.variantId), -line.quantity)
                            }
                          >
                            {copy.remove}
                          </button>
                        </div>
                        <div className="drawer-line-bottom">
                          <span className="drawer-quantity">
                            {line.item.quantityAllowed && (
                              <button
                                disabled={isSubmitting}
                                type="button"
                                onClick={() => onRemove(cartKey(line.item.id, line.variantId), -1)}
                                aria-label={copy.remove}
                              >
                                <Icon name="minus" size={14} />
                              </button>
                            )}
                            <b>{line.quantity}</b>
                            {line.item.quantityAllowed && (
                              <button
                                disabled={isSubmitting}
                                type="button"
                                onClick={() => onRemove(cartKey(line.item.id, line.variantId), 1)}
                                aria-label={copy.add}
                              >
                                <Icon name="plus" size={14} />
                              </button>
                            )}
                          </span>
                          <input
                            aria-label={`${copy.itemNote}: ${menuItemName(line.item, language)}`}
                            disabled={isSubmitting}
                            maxLength={500}
                            placeholder={copy.itemNote}
                            value={line.note}
                            onChange={(event) =>
                              onNoteChange(
                                cartKey(line.item.id, line.variantId),
                                event.target.value,
                              )
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <label className="field-label" htmlFor="guest-request-note">
                {copy.requestNote}
              </label>
              <textarea
                disabled={isSubmitting}
                id="guest-request-note"
                maxLength={1000}
                placeholder={copy.requestNotePlaceholder}
                value={requestNote}
                onChange={(event) => onRequestNoteChange(event.target.value)}
              />
            </div>
            <button
              className="primary-button drawer-submit"
              disabled={isSubmitting || cart.length === 0}
              type="button"
              onClick={onSubmit}
            >
              {isSubmitting ? copy.loading : copy.submitRequest}
              <Icon name="arrow" size={18} />
            </button>
          </>
        )}
      </aside>
    </div>
  );
}

function StatusPill({ language, status }: { language: Language; status: RequestStatus }) {
  return (
    <span className={`status-pill status-${status.toLowerCase()}`}>
      {getRequestStatusLabel(status, language)}
    </span>
  );
}

function PageHeader({
  backLabel,
  description,
  eyebrow,
  onBack,
  title,
  trailing,
}: {
  backLabel: string;
  description: string;
  eyebrow: string;
  onBack: () => void;
  title: string;
  trailing?: ReactNode;
}) {
  return (
    <header className="page-header">
      <button className="back-link" type="button" onClick={onBack}>
        <Icon name="back" size={17} /> {backLabel}
      </button>
      <div className="page-header-main">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {trailing}
      </div>
    </header>
  );
}

function Footer({ language }: { language: Language }) {
  const copy = UI_COPY[language];
  return (
    <footer className="guest-footer">
      <span>HADITH HOTEL</span>
      <span>{copy.guestServices}</span>
      <span className="footer-dot" />
      <span>
        {copy.language}: {LANGUAGE_OPTIONS.find((option) => option.code === language)?.label}
      </span>
    </footer>
  );
}

function AccessState({ language }: { language: Language }) {
  const copy = UI_COPY[language];
  return (
    <main className="state-page">
      <div className="state-symbol">
        <Icon name="building" size={29} />
      </div>
      <p className="eyebrow">HADITH HOTEL</p>
      <h1>{copy.accessRequired}</h1>
      <p>{copy.accessDescription}</p>
    </main>
  );
}

function LoadingState({ language, compact = false }: { language: Language; compact?: boolean }) {
  const copy = UI_COPY[language];
  return (
    <main className={compact ? 'state-page is-compact' : 'state-page'}>
      <span className="loader" />
      <p>{copy.loading}</p>
    </main>
  );
}

function ErrorState({
  error,
  language,
  onRetry,
}: {
  error: unknown;
  language: Language;
  onRetry: () => void;
}) {
  const copy = UI_COPY[language];
  const message = getErrorMessage(error, language);
  return (
    <main className="state-page">
      <div className="state-symbol is-error">
        <Icon name="refresh" size={27} />
      </div>
      <p className="eyebrow">{copy.unavailable}</p>
      <h1>{message}</h1>
      <button className="primary-button state-button" type="button" onClick={onRetry}>
        {copy.retry}
        <Icon name="refresh" size={17} />
      </button>
    </main>
  );
}

function InlineError({ language, onRetry }: { language: Language; onRetry: () => void }) {
  const copy = UI_COPY[language];
  return (
    <div className="inline-error">
      <span>
        <Icon name="refresh" size={17} /> {copy.unavailable}
      </span>
      <button type="button" onClick={onRetry}>
        {copy.retry}
      </button>
    </div>
  );
}

function MenuLoading() {
  return (
    <div className="menu-grid menu-grid-skeleton" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((item) => (
        <div className="menu-skeleton" key={item} />
      ))}
    </div>
  );
}

function EmptyState({
  description,
  icon,
  title,
}: {
  description?: string;
  icon: IconName;
  title: string;
}) {
  return (
    <div className="empty-state">
      <span className="state-symbol">
        <Icon name={icon} size={25} />
      </span>
      <h2>{title}</h2>
      {description !== undefined && <p>{description}</p>}
    </div>
  );
}

function Toast({ message }: { message: string }) {
  return (
    <div className="toast" role="status">
      <Icon name="check" size={15} /> {message}
    </div>
  );
}

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const common = {
    'aria-hidden': true,
    fill: 'none',
    height: size,
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.7,
    viewBox: '0 0 24 24',
    width: size,
  };
  switch (name) {
    case 'arrow':
      return (
        <svg {...common}>
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      );
    case 'back':
      return (
        <svg {...common}>
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      );
    case 'building':
      return (
        <svg {...common}>
          <path d="M4 21h16M6 21V5l6-2 6 2v16M9 8h1M14 8h1M9 12h1M14 12h1M11 21v-5h2v5" />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
    case 'chevron':
      return (
        <svg {...common}>
          <path d="m9 5 7 7-7 7" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case 'cup':
      return (
        <svg {...common}>
          <path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8ZM16 10h2a2 2 0 0 1 0 4h-2M7 21h9M9 5c0-1 1-1 1-2M13 5c0-1 1-1 1-2" />
        </svg>
      );
    case 'language':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M4 12h16M12 4c2 2.2 3 4.9 3 8s-1 5.8-3 8c-2-2.2-3-4.9-3-8s1-5.8 3-8Z" />
        </svg>
      );
    case 'map':
      return (
        <svg {...common}>
          <path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2Z" />
          <path d="M9 4v14M15 6v14" />
        </svg>
      );
    case 'minus':
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.7-3L4 10M4 5v5h5M4 13a8 8 0 0 0 14.7 3L20 14M20 19v-5h-5" />
        </svg>
      );
    case 'requests':
      return (
        <svg {...common}>
          <path d="M6 4h12v16H6zM9 8h6M9 12h6M9 16h3" />
        </svg>
      );
    case 'scissors':
      return (
        <svg {...common}>
          <circle cx="6" cy="7" r="2" />
          <circle cx="6" cy="17" r="2" />
          <path d="m8 8 10 8M8 16 18 8" />
        </svg>
      );
    case 'spark':
      return (
        <svg {...common}>
          <path d="m12 3 1.6 6.4L20 11l-6.4 1.6L12 19l-1.6-6.4L4 11l6.4-1.6L12 3Z" />
          <path d="m19 3 .5 2 1.5.5-1.5.5-.5 2-.5-2L17 5.5l1.5-.5.5-2Z" />
        </svg>
      );
    case 'utensils':
      return (
        <svg {...common}>
          <path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M17 3v18M17 3c-2 2-3 4-3 7h3" />
        </svg>
      );
    case 'waves':
      return (
        <svg {...common}>
          <path d="M3 9c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 15c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2M3 21c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2" />
        </svg>
      );
  }
}
