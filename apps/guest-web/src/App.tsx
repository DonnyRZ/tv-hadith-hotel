import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import {
  createGuestApiClient,
  GuestApiError,
  type GuestDepartmentUnit,
  type GuestMenuItem,
  type GuestRequest,
  type RequestStatus,
  type UnitCode,
} from '@room-service/api-client';
import { DEFAULT_LANGUAGE, LANGUAGE_OPTIONS, type Language } from '@room-service/translations';

import {
  ABOUT_FEATURES,
  DESTINATIONS,
  localize,
  SERVICE_ENTRIES,
  type IconName,
  UI_COPY,
  unitLabel,
} from './content';

const MENU_PAGE_SIZE = 10;
const UNIT_CODES: readonly UnitCode[] = [
  'CAFE',
  'RESTAURANT',
  'LOUNGE',
  'SPA',
  'HOUSEKEEPING',
  'BEAUTY_AND_SALON',
];

type View = 'home' | 'service' | 'fnb' | 'menu' | 'about' | 'destinations' | 'requests';

interface RouteState {
  view: View;
  unit?: UnitCode;
}

interface CartLine {
  item: GuestMenuItem;
  quantity: number;
  note: string;
}

interface GuestMenuPage {
  items: GuestMenuItem[];
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

function formatDate(value: string, language: Language): string {
  return new Intl.DateTimeFormat(getLocale(language), {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(new Date(value));
}

function getRequestStatusLabel(status: RequestStatus, language: Language): string {
  const copy = UI_COPY[language];
  if (status === 'IN_PROCESS') return copy.statusInProcess;
  if (status === 'COMPLETED') return copy.statusCompleted;
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
  if (error instanceof GuestApiError && error.status === 409) return copy.requestUnitConflict;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return copy.offline;
  return copy.unavailable;
}

function getBackRoute(route: RouteState): string {
  if (route.view === 'menu')
    return route.unit === 'RESTAURANT' || route.unit === 'LOUNGE' ? '#service/fnb' : '#service';
  if (route.view === 'fnb') return '#service';
  return '#home';
}

export default function App() {
  const token = useMemo(readGuestToken, []);
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);
  const [route, setRoute] = useState<RouteState>(() => parseRoute());
  const [menuPage, setMenuPage] = useState(1);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartUnit, setCartUnit] = useState<UnitCode | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestNote, setRequestNote] = useState('');
  const [clientRequestId, setClientRequestId] = useState<string | null>(null);
  const [sentRequest, setSentRequest] = useState<GuestRequest | null>(null);
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
  const activeMenuUnit = route.view === 'menu' ? route.unit : undefined;
  const menuQuery = useQuery({
    enabled: contextQuery.data !== undefined && activeMenuUnit !== undefined,
    queryFn: () =>
      api.listMenus({ page: menuPage, pageSize: MENU_PAGE_SIZE, unit: activeMenuUnit! }),
    queryKey: ['guest', 'menu', activeMenuUnit, menuPage],
  });
  const requestsQuery = useQuery({
    enabled: contextQuery.data !== undefined && route.view === 'requests',
    queryFn: () => api.listRequests({ page: 1, pageSize: 50 }),
    queryKey: ['guest', 'requests'],
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
      setCartUnit(null);
      setRequestOpen(false);
      setRequestNote('');
      setClientRequestId(null);
      setSentRequest(null);
      return;
    }

    if (
      previousContextIdentity.current !== null &&
      previousContextIdentity.current !== contextIdentity
    ) {
      setCart([]);
      setCartUnit(null);
      setRequestOpen(false);
      setRequestNote('');
      setClientRequestId(null);
      setSentRequest(null);
    }
    previousContextIdentity.current = contextIdentity;
  }, [contextIdentity, contextQuery.isError]);

  const departments = departmentsQuery.data?.items ?? [];
  const unitRecords = useMemo(() => {
    const records = new Map<UnitCode, GuestDepartmentUnit>();
    for (const department of departments) {
      for (const unit of department.units) records.set(unit.code, unit);
    }
    return records;
  }, [departments]);

  const navigate = useCallback((path: string) => {
    if (window.location.hash === path) {
      setRoute(parseRoute());
    } else {
      window.location.hash = path;
    }
    window.scrollTo({ behavior: 'smooth', top: 0 });
  }, []);

  const notify = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    setMenuPage(1);
  }, [activeMenuUnit]);

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

  const isUnitEnabled = useCallback(
    (unit: UnitCode) => {
      const record = unitRecords.get(unit);
      const includedByContext = contextQuery.data?.availableUnits.includes(unit) ?? false;
      return includedByContext && record?.enabled !== false;
    },
    [contextQuery.data?.availableUnits, unitRecords],
  );

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
    (item: GuestMenuItem) => {
      if (cartUnit !== null && cartUnit !== item.unit) {
        notify(copy.requestUnitConflict);
        return;
      }
      setCartUnit(item.unit);
      setCart((current) => {
        const existing = current.find((line) => line.item.id === item.id);
        if (existing === undefined) return [...current, { item, note: '', quantity: 1 }];
        return current.map((line) =>
          line.item.id === item.id
            ? {
                ...line,
                quantity: item.quantityAllowed ? line.quantity + 1 : line.quantity,
              }
            : line,
        );
      });
      notify(copy.addToRequest);
    },
    [cartUnit, copy.addToRequest, copy.requestUnitConflict, notify],
  );

  const updateCartLine = useCallback((itemId: string, change: number) => {
    setCart((current) =>
      current.flatMap((line) => {
        if (line.item.id !== itemId) return [line];
        const nextQuantity = line.quantity + change;
        return nextQuantity > 0 ? [{ ...line, quantity: nextQuantity }] : [];
      }),
    );
  }, []);

  const updateCartNote = useCallback((itemId: string, note: string) => {
    setCart((current) =>
      current.map((line) => (line.item.id === itemId ? { ...line, note } : line)),
    );
  }, []);

  useEffect(() => {
    if (cart.length === 0) setCartUnit(null);
  }, [cart.length]);

  const openRequest = useCallback(() => {
    if (cart.length === 0) return;
    setClientRequestId(createClientRequestId());
    setSentRequest(null);
    setRequestOpen(true);
  }, [cart.length]);

  const closeRequest = useCallback(() => {
    setRequestOpen(false);
    setSentRequest(null);
  }, []);

  const submitRequest = useCallback(async () => {
    if (cart.length === 0 || cartUnit === null || isSubmitting) return;
    setIsSubmitting(true);
    const idempotencyKey = clientRequestId ?? createClientRequestId();
    setClientRequestId(idempotencyKey);
    try {
      const request = await api.createRequest({
        clientRequestId: idempotencyKey,
        guestNote: requestNote.trim().length > 0 ? requestNote.trim() : null,
        items: cart.map((line) => ({
          menuItemId: line.item.id,
          note: line.note.trim().length > 0 ? line.note.trim() : null,
          quantity: line.quantity,
        })),
      });
      setSentRequest(request);
      setCart([]);
      setCartUnit(null);
      setRequestNote('');
      setClientRequestId(null);
      await queryClient.invalidateQueries({ queryKey: ['guest', 'requests'] });
    } catch (error) {
      notify(getErrorMessage(error, language));
    } finally {
      setIsSubmitting(false);
    }
  }, [
    api,
    cart,
    cartUnit,
    clientRequestId,
    isSubmitting,
    language,
    notify,
    queryClient,
    requestNote,
  ]);

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
                  onBack={() => navigate('#home')}
                  onOpenService={openService}
                  unitRecords={unitRecords}
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
                  onAdd={addToCart}
                  onBack={() => navigate(getBackRoute(route))}
                  onNext={() => setMenuPage((page) => page + 1)}
                  onPrevious={() => setMenuPage((page) => Math.max(1, page - 1))}
                  onRemove={updateCartLine}
                  onRequest={openRequest}
                  page={menuPage}
                  unit={activeMenuUnit}
                />
              )}
              {route.view === 'about' && (
                <AboutView language={language} onBack={() => navigate('#home')} />
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
        sentRequest={sentRequest}
      />
    </div>
  );
}

interface HeaderProps {
  context: { room: { number: string }; welcome: { guestName: string } } | undefined;
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
        {context !== undefined && (
          <span className="room-reference">
            <span className="room-reference-dot" />
            {copy.room} {context.room.number}
          </span>
        )}
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
  context: { room: { number: string }; welcome: { guestName: string } };
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
        <div className="stay-chip">
          <span className="stay-chip-icon">
            <Icon name="building" size={17} />
          </span>
          <span>
            {copy.room} {context.room.number}
          </span>
        </div>
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
  onBack,
  onOpenService,
  unitRecords,
}: {
  language: Language;
  onBack: () => void;
  onOpenService: (key: UnitCode | 'FOOD_AND_BEVERAGES') => void;
  unitRecords: Map<UnitCode, GuestDepartmentUnit>;
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
          const enabled = entry.unitCodes.some((unit) => unitRecords.get(unit)?.enabled !== false);
          return (
            <button
              className={enabled ? 'service-card' : 'service-card is-muted'}
              key={entry.key}
              type="button"
              onClick={() => onOpenService(entry.key)}
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
  language,
  menuQuery,
  onAdd,
  onBack,
  onNext,
  onPrevious,
  onRemove,
  onRequest,
  page,
  unit,
}: {
  cart: CartLine[];
  cartCount: number;
  language: Language;
  menuQuery: UseQueryResult<GuestMenuPage, Error>;
  onAdd: (item: GuestMenuItem) => void;
  onBack: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onRemove: (itemId: string, change: number) => void;
  onRequest: () => void;
  page: number;
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
      {menuQuery.isPending ? (
        <MenuLoading />
      ) : menuQuery.isError ? (
        <InlineError language={language} onRetry={() => void menuQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState icon="spark" title={copy.noMenuItems} />
      ) : (
        <>
          <section className="menu-grid" aria-label={`${copy.menu}: ${unitLabel(unit, language)}`}>
            {items.map((item) => (
              <MenuCard
                item={item}
                key={item.id}
                language={language}
                onAdd={onAdd}
                selectedQuantity={cart.find((line) => line.item.id === item.id)?.quantity ?? 0}
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
  onAdd: (item: GuestMenuItem) => void;
  onRemove: (itemId: string, change: number) => void;
  selectedQuantity: number;
}) {
  const copy = UI_COPY[language];
  const description = localize(item.localizedDescription, language);
  return (
    <article className={selectedQuantity > 0 ? 'menu-card is-selected' : 'menu-card'}>
      <div className="menu-card-topline">
        <span className="menu-kind">
          <Icon name={item.kind === 'PRODUCT' ? 'utensils' : 'spark'} size={14} />
          {item.kind === 'PRODUCT' ? copy.menu : copy.services}
        </span>
        {selectedQuantity > 0 && (
          <span className="selected-mark">
            <Icon name="check" size={13} />
          </span>
        )}
      </div>
      <h2>{localize(item.localizedName, language)}</h2>
      {description.length > 0 ? (
        <p>{description}</p>
      ) : (
        <p className="menu-card-placeholder">&nbsp;</p>
      )}
      <div className="menu-card-footer">
        <span className="menu-price">{formatPrice(item, language, copy.priceNotSet)}</span>
        {item.quantityAllowed && selectedQuantity > 0 ? (
          <span className="quantity-control" aria-label={copy.quantity}>
            <button type="button" onClick={() => onRemove(item.id, -1)} aria-label={copy.remove}>
              <Icon name="minus" size={15} />
            </button>
            <strong>{selectedQuantity}</strong>
            <button type="button" onClick={() => onAdd(item)} aria-label={copy.add}>
              <Icon name="plus" size={15} />
            </button>
          </span>
        ) : (
          <button
            className={selectedQuantity > 0 ? 'add-button is-added' : 'add-button'}
            type="button"
            onClick={() => onAdd(item)}
          >
            <span>{selectedQuantity > 0 ? selectedQuantity : copy.add}</span>
            <Icon name={selectedQuantity > 0 ? 'check' : 'plus'} size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

function AboutView({ language, onBack }: { language: Language; onBack: () => void }) {
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
          <article className="about-feature" key={feature.image}>
            <div className="about-feature-image">
              <img alt="" src={feature.image} />
            </div>
            <div className="about-feature-copy">
              <h2>{localize(feature.title, language)}</h2>
              <p>{localize(feature.body, language)}</p>
            </div>
          </article>
        ))}
      </section>
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
          {query.data.items.map((request) => (
            <RequestCard key={request.id} language={language} request={request} />
          ))}
        </section>
      )}
    </main>
  );
}

function RequestCard({ language, request }: { language: Language; request: GuestRequest }) {
  const copy = UI_COPY[language];
  const statusIndex = request.status === 'COMPLETED' ? 2 : request.status === 'IN_PROCESS' ? 1 : 0;
  const statusSteps: Array<{ status: RequestStatus; label: string }> = [
    { label: copy.statusNew, status: 'NEW' },
    { label: copy.statusInProcess, status: 'IN_PROCESS' },
    { label: copy.statusCompleted, status: 'COMPLETED' },
  ];
  return (
    <article className="request-card">
      <div className="request-card-heading">
        <div>
          <span className="eyebrow">{unitLabel(request.unit, language)}</span>
          <h2>{getRequestStatusLabel(request.status, language)}</h2>
        </div>
        <time dateTime={request.requestedAt}>{formatDate(request.requestedAt, language)}</time>
      </div>
      <div className="request-items">
        {request.items.map((item) => (
          <div className="request-item" key={item.menuItemId}>
            <span>{localize(item.localizedName, language)}</span>
            <strong>× {item.quantity}</strong>
          </div>
        ))}
      </div>
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
    </article>
  );
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
  sentRequest,
}: {
  cart: CartLine[];
  isSubmitting: boolean;
  language: Language;
  onClose: () => void;
  onNoteChange: (itemId: string, note: string) => void;
  onRequestNoteChange: (note: string) => void;
  onRemove: (itemId: string, change: number) => void;
  onSubmit: () => void;
  onViewRequests: () => void;
  open: boolean;
  requestNote: string;
  sentRequest: GuestRequest | null;
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
            <h2>{sentRequest === null ? copy.requestSummary : copy.requestSubmitted}</h2>
          </div>
          <button aria-label={copy.close} className="drawer-close" type="button" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>
        {sentRequest !== null ? (
          <div className="request-success">
            <span className="success-icon">
              <Icon name="check" size={25} />
            </span>
            <p>{copy.requestSentDescription}</p>
            <StatusPill status={sentRequest.status} language={language} />
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
                {cart.map((line) => (
                  <div className="drawer-line" key={line.item.id}>
                    <div className="drawer-line-top">
                      <div>
                        <strong>{localize(line.item.localizedName, language)}</strong>
                        <span>{formatPrice(line.item, language, copy.priceNotSet)}</span>
                      </div>
                      <button
                        className="remove-line"
                        type="button"
                        onClick={() => onRemove(line.item.id, -line.quantity)}
                      >
                        {copy.remove}
                      </button>
                    </div>
                    <div className="drawer-line-bottom">
                      <span className="drawer-quantity">
                        {line.item.quantityAllowed && (
                          <button
                            type="button"
                            onClick={() => onRemove(line.item.id, -1)}
                            aria-label={copy.remove}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        )}
                        <b>{line.quantity}</b>
                        {line.item.quantityAllowed && (
                          <button
                            type="button"
                            onClick={() => onRemove(line.item.id, 1)}
                            aria-label={copy.add}
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        )}
                      </span>
                      <input
                        aria-label={`${copy.itemNote}: ${localize(line.item.localizedName, language)}`}
                        maxLength={500}
                        placeholder={copy.itemNote}
                        value={line.note}
                        onChange={(event) => onNoteChange(line.item.id, event.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <label className="field-label" htmlFor="guest-request-note">
                {copy.requestNote}
              </label>
              <textarea
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
