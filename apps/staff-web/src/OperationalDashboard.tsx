import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FormEvent, ReactNode } from 'react';

import {
  managementApi,
  StaffApiError,
  type MenuUnit,
  type RequestStatus,
  type RoomManagerUnit,
  type StaffRequest,
} from './management-api';
import { AdminSelect } from './AdminSelect';
import {
  AdminBrandMark,
  AdminLanguageSwitcher,
  ArrowIcon,
  getInitials,
  MenuIcon,
  OrdersIcon,
} from './CafeWorkspace';
import {
  activeRequestTotal,
  filterActiveRequests,
  paginateRequests,
  sortRequests,
  type ActiveRequestFilter,
} from './CafeDashboard.helpers';
import type { AuthCopy, Language, OperationalCopy, OperationalRole } from './i18n';
import { operationalCopy } from './i18n';

interface StaffUser {
  displayName: string;
  roles: string[];
}

interface OperationalDashboardProps {
  authCopy: AuthCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigate: ((page: 'requests' | 'menu') => void) | undefined;
  onSignOut: () => void;
  role: OperationalRole;
  user: StaffUser;
}

type DashboardTab = 'active' | 'history';
type PaginationItem = number | 'ellipsis';
type UnitFilter = RoomManagerUnit | 'ALL';

const REQUEST_PAGE_SIZE = 10;
const ACTIVE_FETCH_PAGE_SIZE = 100;
const REFRESH_INTERVAL_MS = 30_000;

const DEPARTMENT_UNITS: Record<Exclude<OperationalRole, 'ROOM_MANAGER'>, MenuUnit> = {
  SPA: 'SPA',
  RESTAURANT: 'RESTAURANT',
  LOUNGE: 'LOUNGE',
  BEAUTY_AND_SALON: 'BEAUTY_AND_SALON',
  HOUSEKEEPING: 'HOUSEKEEPING',
};

function formatDateTime(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const locale = language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function requestErrorMessage(error: unknown, copy: OperationalCopy): string {
  if (error instanceof StaffApiError) {
    if (error.code === 'SESSION_EXPIRED' || error.status === 401) return copy.sessionExpired;
    if (error.code === 'REQUEST_STATUS_CONFLICT') return copy.transitionConflict;
  }
  return copy.apiError;
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

  const pages = [...pageSet].sort((left, right) => left - right);
  return pages.reduce<PaginationItem[]>((result, page, index) => {
    const previousPage = pages[index - 1];
    if (previousPage !== undefined && page - previousPage > 1) result.push('ellipsis');
    result.push(page);
    return result;
  }, []);
}

function StatusPill({ status, copy }: { status: RequestStatus; copy: OperationalCopy }) {
  const statusCopy = {
    NEW: { label: copy.newStatus, className: 'is-new' },
    IN_PROCESS: { label: copy.inProcessStatus, className: 'is-in-process' },
    COMPLETED: { label: copy.completedStatus, className: 'is-completed' },
  }[status];

  return <span className={`cafe-request-status ${statusCopy.className}`}>{statusCopy.label}</span>;
}

function LoadingState({ copy }: { copy: OperationalCopy }) {
  return (
    <div className="admin-loading-state" aria-live="polite">
      <span className="admin-loading-line admin-loading-line--wide" />
      <span className="admin-loading-line" />
      <span className="admin-loading-line admin-loading-line--short" />
      <p>{copy.loading}</p>
    </div>
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
    <div className="admin-empty-state cafe-dashboard-empty">
      <div className="admin-empty-state__mark">—</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

function RequestPagination({
  copy,
  currentPage,
  onPageChange,
  totalItems,
  totalPages,
}: {
  copy: OperationalCopy;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalItems: number;
  totalPages: number;
}) {
  const firstItem = (currentPage - 1) * REQUEST_PAGE_SIZE + 1;
  const lastItem = Math.min(currentPage * REQUEST_PAGE_SIZE, totalItems);

  return (
    <nav aria-label={copy.pagination} className="cafe-pagination">
      <p className="cafe-pagination__summary">
        {totalItems === 0 ? copy.showing(0) : copy.showingRange(firstItem, lastItem, totalItems)}
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
              <span className="cafe-pagination__ellipsis" key={`ellipsis-${index}`}>
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

function RequestDrawer({
  copy,
  language,
  onClose,
  onTransition,
  readOnly,
  request,
  unitName,
  busy,
}: {
  copy: OperationalCopy;
  language: Language;
  onClose: () => void;
  onTransition?: ((request: StaffRequest) => void) | undefined;
  readOnly: boolean;
  request: StaffRequest;
  unitName?: string | undefined;
  busy: boolean;
}) {
  const totalQuantity = request.items.reduce((total, item) => total + item.quantity, 0);

  return createPortal(
    <div
      className="admin-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        aria-labelledby="operational-request-drawer-title"
        aria-modal="true"
        className="admin-drawer cafe-request-drawer operational-request-drawer"
        role="dialog"
      >
        <div className="admin-drawer__header">
          <div>
            <p className="admin-eyebrow">{copy.requestDetails}</p>
            <h2 id="operational-request-drawer-title">
              {unitName === undefined
                ? request.room.number
                : `${unitName} · ${request.room.number}`}
            </h2>
          </div>
          <button
            aria-label={copy.requestDetails}
            className="admin-icon-button"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="admin-drawer__body cafe-request-drawer__body">
          {readOnly && <p className="operational-read-only-note">{copy.readOnlyDescription}</p>}
          <div className="cafe-request-drawer__summary">
            <div>
              <span>{copy.room}</span>
              <strong>{request.room.number}</strong>
            </div>
            {unitName !== undefined && (
              <div>
                <span>{copy.unit}</span>
                <strong>{unitName}</strong>
              </div>
            )}
            <div>
              <span>{copy.requestId}</span>
              <strong title={request.id}>{request.id.slice(0, 8)}</strong>
            </div>
            <StatusPill copy={copy} status={request.status} />
          </div>

          <section
            className="cafe-request-drawer__section"
            aria-labelledby="operational-items-title"
          >
            <div className="cafe-request-drawer__section-heading">
              <h3 id="operational-items-title">{copy.items}</h3>
              <span>{copy.quantity(totalQuantity)}</span>
            </div>
            <ul className="cafe-request-items">
              {request.items.map((item) => (
                <li key={`${item.menuItemId}-${item.name}`}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.note !== null && <small>{item.note}</small>}
                  </div>
                  <span>{copy.quantity(item.quantity)}</span>
                </li>
              ))}
            </ul>
          </section>

          <section
            className="cafe-request-drawer__section"
            aria-labelledby="operational-timeline-title"
          >
            <h3 id="operational-timeline-title">{copy.statusHistory}</h3>
            <dl className="cafe-request-timeline">
              <div>
                <dt>{copy.requestedAt}</dt>
                <dd>{formatDateTime(request.requestedAt, language)}</dd>
              </div>
              {request.confirmedAt !== null && (
                <div>
                  <dt>{copy.confirmedAt}</dt>
                  <dd>{formatDateTime(request.confirmedAt, language)}</dd>
                </div>
              )}
              {request.completedAt !== null && (
                <div>
                  <dt>{copy.completedAt}</dt>
                  <dd>{formatDateTime(request.completedAt, language)}</dd>
                </div>
              )}
            </dl>
          </section>

          <section
            className="cafe-request-drawer__section"
            aria-labelledby="operational-note-title"
          >
            <h3 id="operational-note-title">{copy.guestNote}</h3>
            <p className="cafe-request-note">
              {request.guestNote === null || request.guestNote.length === 0
                ? copy.noNote
                : request.guestNote}
            </p>
          </section>

          {!readOnly && request.status !== 'COMPLETED' && onTransition !== undefined && (
            <div className="admin-form-actions cafe-request-drawer__actions">
              <button
                className="admin-button admin-button--primary"
                disabled={busy}
                onClick={() => onTransition(request)}
                type="button"
              >
                {request.status === 'NEW' ? copy.confirmRequest : copy.markDone}
                <ArrowIcon direction="right" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function RequestSummary({ request, copy }: { request: StaffRequest; copy: OperationalCopy }) {
  const firstItem = request.items[0];
  const remainingItems = request.items.length - 1;

  if (firstItem === undefined) return <span>—</span>;

  return (
    <div className="cafe-request-summary">
      <strong>{firstItem.name}</strong>
      <small>{copy.quantity(firstItem.quantity)}</small>
      {remainingItems > 0 && (
        <small>
          +{remainingItems} {copy.moreItems}
        </small>
      )}
    </div>
  );
}

export function OperationalDashboard({
  authCopy,
  language,
  onLanguageChange,
  onNavigate,
  onSignOut,
  role,
  user,
}: OperationalDashboardProps) {
  const copy = operationalCopy[language];
  const roleCopy = copy.roles[role];
  const isRoomManager = role === 'ROOM_MANAGER';
  const hasCatalog =
    role === 'SPA' || role === 'RESTAURANT' || role === 'LOUNGE' || role === 'BEAUTY_AND_SALON';
  const departmentUnit = isRoomManager ? undefined : DEPARTMENT_UNITS[role];
  const [tab, setTab] = useState<DashboardTab>('active');
  const [activeFilter, setActiveFilter] = useState<ActiveRequestFilter>('ALL');
  const [unitFilter, setUnitFilter] = useState<UnitFilter>('ALL');
  const [roomInput, setRoomInput] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [activeRequests, setActiveRequests] = useState<StaffRequest[]>([]);
  const [historyRequests, setHistoryRequests] = useState<StaffRequest[]>([]);
  const [counts, setCounts] = useState({ newCount: 0, inProcessCount: 0, completedCount: 0 });
  const [historyTotal, setHistoryTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<StaffRequest | null>(null);
  const [busyRequestId, setBusyRequestId] = useState('');
  const [toast, setToast] = useState('');

  const loadDashboard = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (silent) setRefreshing(true);
      else setLoading(true);
      setError('');

      const listForStatus = (status: RequestStatus, page: number, pageSize: number) => {
        const commonFilters = {
          status,
          page,
          pageSize,
          ...(roomFilter.length === 0 ? {} : { room: roomFilter }),
        };

        if (isRoomManager) {
          return managementApi.listRoomManagerRequests({
            ...commonFilters,
            ...(unitFilter === 'ALL' ? {} : { unit: unitFilter }),
          });
        }

        return managementApi.listDepartmentRequests({
          ...commonFilters,
          unit: departmentUnit as MenuUnit,
        });
      };

      try {
        const [newResponse, inProcessResponse, historyResponse] = await Promise.all([
          listForStatus('NEW', 1, ACTIVE_FETCH_PAGE_SIZE),
          listForStatus('IN_PROCESS', 1, ACTIVE_FETCH_PAGE_SIZE),
          listForStatus('COMPLETED', historyPage, REQUEST_PAGE_SIZE),
        ]);

        setActiveRequests(sortRequests([...newResponse.items, ...inProcessResponse.items]));
        setHistoryRequests(historyResponse.items);
        setCounts({
          newCount: newResponse.total,
          inProcessCount: inProcessResponse.total,
          completedCount: historyResponse.total,
        });
        setHistoryTotal(historyResponse.total);
        setLastUpdated(new Date().toISOString());
      } catch (requestError) {
        setError(requestErrorMessage(requestError, copy));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [copy, departmentUnit, historyPage, isRoomManager, roomFilter, unitFilter],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard({ silent: true });
    }, REFRESH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [loadDashboard]);

  useEffect(() => {
    if (toast.length === 0) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 4200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (selectedRequest === null) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedRequest(null);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedRequest]);

  const filteredActiveRequests = useMemo(
    () => filterActiveRequests(activeRequests, activeFilter),
    [activeFilter, activeRequests],
  );
  const activeTotal = activeRequestTotal(counts, activeFilter);
  const activeTotalPages = Math.max(1, Math.ceil(activeTotal / REQUEST_PAGE_SIZE));
  const currentActivePage = Math.min(activePage, activeTotalPages);
  const visibleActiveRequests = paginateRequests(
    filteredActiveRequests,
    currentActivePage,
    REQUEST_PAGE_SIZE,
  );
  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / REQUEST_PAGE_SIZE));
  const currentHistoryPage = Math.min(historyPage, historyTotalPages);

  useEffect(() => {
    if (currentActivePage !== activePage) setActivePage(currentActivePage);
  }, [activePage, currentActivePage]);

  useEffect(() => {
    if (currentHistoryPage !== historyPage) setHistoryPage(currentHistoryPage);
  }, [currentHistoryPage, historyPage]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRoomFilter(roomInput.trim());
    setActivePage(1);
    setHistoryPage(1);
  }

  function handleTabChange(nextTab: DashboardTab) {
    setTab(nextTab);
    setActivePage(1);
    setHistoryPage(1);
  }

  async function transitionRequest(request: StaffRequest) {
    if (isRoomManager) return;
    setBusyRequestId(request.id);
    try {
      const saved =
        request.status === 'NEW'
          ? await managementApi.confirmDepartmentRequest(request.id)
          : await managementApi.completeDepartmentRequest(request.id);
      setSelectedRequest(saved);
      setToast(copy.requestUpdated);
      await loadDashboard({ silent: true });
    } catch (requestError) {
      setError(requestErrorMessage(requestError, copy));
    } finally {
      setBusyRequestId('');
    }
  }

  const visibleRequests = tab === 'active' ? visibleActiveRequests : historyRequests;
  const totalForView = tab === 'active' ? activeTotal : historyTotal;
  const totalPagesForView = tab === 'active' ? activeTotalPages : historyTotalPages;
  const currentPageForView = tab === 'active' ? currentActivePage : currentHistoryPage;
  const unitOptions: { label: string; value: string }[] = [
    { label: copy.allUnits, value: 'ALL' },
    ...(['SPA', 'RESTAURANT', 'LOUNGE', 'HOUSEKEEPING'] as const).map((unit) => ({
      label: copy.unitNames[unit],
      value: unit,
    })),
  ];

  return (
    <div className="admin-shell operational-dashboard">
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
          <button
            className="admin-nav-item is-active"
            onClick={() => onNavigate?.('requests')}
            type="button"
          >
            <OrdersIcon />
            <span>{roleCopy.navLabel}</span>
            <ArrowIcon direction="right" />
          </button>
          {hasCatalog && (
            <button className="admin-nav-item" onClick={() => onNavigate?.('menu')} type="button">
              <MenuIcon />
              <span>{copy.menu}</span>
              <ArrowIcon direction="right" />
            </button>
          )}
        </nav>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>{copy.administration}</span>
            <ArrowIcon direction="right" />
            <strong>{roleCopy.title}</strong>
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
                <small>{authCopy.roleLabels[role]}</small>
              </span>
            </div>
            <button className="admin-signout" onClick={onSignOut} type="button">
              {authCopy.signOut}
            </button>
          </div>
        </header>

        <main className="admin-content admin-content--cafe cafe-dashboard-content operational-dashboard-content">
          {error.length > 0 && (
            <div className="admin-global-error" role="alert">
              <span>{error}</span>
              <button onClick={() => void loadDashboard()} type="button">
                {copy.retry}
              </button>
            </div>
          )}

          <section className="admin-page" aria-labelledby="operational-dashboard-title">
            <div className="admin-page-heading">
              <div>
                <p className="admin-eyebrow">{roleCopy.navLabel}</p>
                <h1 id="operational-dashboard-title">{roleCopy.title}</h1>
                <p>{roleCopy.subtitle}</p>
              </div>
              <div className="operational-page-heading-actions">
                {isRoomManager && (
                  <span className="operational-read-only-badge">{copy.readOnly}</span>
                )}
                <button
                  className="admin-button admin-button--quiet cafe-refresh-button"
                  disabled={refreshing}
                  onClick={() => void loadDashboard({ silent: true })}
                  type="button"
                >
                  <RefreshIcon />
                  {refreshing ? copy.refreshing : copy.refresh}
                </button>
              </div>
            </div>

            <div className="admin-stat-strip cafe-dashboard-stat-strip" aria-label={roleCopy.title}>
              <div>
                <span>{copy.newRequests}</span>
                <strong>{counts.newCount}</strong>
              </div>
              <div>
                <span>{copy.inProcess}</span>
                <strong>{counts.inProcessCount}</strong>
              </div>
              <div>
                <span>{copy.completed}</span>
                <strong>{counts.completedCount}</strong>
              </div>
            </div>

            <div className="cafe-dashboard-tabs" role="tablist" aria-label={roleCopy.title}>
              <button
                aria-selected={tab === 'active'}
                className={tab === 'active' ? 'is-active' : ''}
                onClick={() => handleTabChange('active')}
                role="tab"
                type="button"
              >
                {copy.activeQueue}
                <span>{counts.newCount + counts.inProcessCount}</span>
              </button>
              <button
                aria-selected={tab === 'history'}
                className={tab === 'history' ? 'is-active' : ''}
                onClick={() => handleTabChange('history')}
                role="tab"
                type="button"
              >
                {copy.history}
                <span>{counts.completedCount}</span>
              </button>
            </div>

            <form className="admin-toolbar cafe-request-toolbar" onSubmit={handleSearch}>
              <label className="admin-search-field cafe-room-search">
                <span className="sr-only">{copy.room}</span>
                <SearchIcon />
                <input
                  inputMode="text"
                  onChange={(event) => setRoomInput(event.target.value)}
                  placeholder={copy.roomPlaceholder}
                  value={roomInput}
                />
              </label>
              <button className="admin-button admin-button--quiet" type="submit">
                {copy.applyFilters}
              </button>
              {isRoomManager && (
                <AdminSelect
                  ariaLabel={copy.unit}
                  className="admin-filter-field operational-unit-filter"
                  onChange={(value) => {
                    setUnitFilter(value as UnitFilter);
                    setActivePage(1);
                    setHistoryPage(1);
                  }}
                  options={unitOptions}
                  value={unitFilter}
                />
              )}
              {tab === 'active' && (
                <AdminSelect
                  ariaLabel={copy.filterStatus}
                  className="admin-filter-field cafe-request-status-filter"
                  onChange={(value) => {
                    setActiveFilter(value as ActiveRequestFilter);
                    setActivePage(1);
                  }}
                  options={[
                    { label: copy.allActive, value: 'ALL' },
                    { label: copy.newStatus, value: 'NEW' },
                    { label: copy.inProcessStatus, value: 'IN_PROCESS' },
                  ]}
                  value={activeFilter}
                />
              )}
              <span className="admin-toolbar-count">
                {copy.showing(totalForView)}
                {lastUpdated !== null && (
                  <small>{copy.lastUpdated(formatDateTime(lastUpdated, language))}</small>
                )}
              </span>
            </form>

            {loading ? (
              <LoadingState copy={copy} />
            ) : visibleRequests.length === 0 ? (
              <EmptyState
                description={
                  tab === 'active' ? copy.noActiveRequestsDescription : copy.noHistoryDescription
                }
                title={tab === 'active' ? copy.noActiveRequests : copy.noHistory}
                action={
                  roomFilter.length > 0 || (isRoomManager && unitFilter !== 'ALL') ? (
                    <button
                      className="admin-text-button"
                      onClick={() => {
                        setRoomInput('');
                        setRoomFilter('');
                        setUnitFilter('ALL');
                        setActivePage(1);
                        setHistoryPage(1);
                      }}
                      type="button"
                    >
                      {copy.clearFilters}
                      <ArrowIcon direction="right" />
                    </button>
                  ) : undefined
                }
              />
            ) : (
              <section className="cafe-dashboard-panel" aria-label={roleCopy.title}>
                <div className="cafe-dashboard-panel__header">
                  <div>
                    <p className="admin-eyebrow">
                      {tab === 'active' ? copy.activeQueue : copy.history}
                    </p>
                    <h2>{tab === 'active' ? copy.activeQueue : copy.history}</h2>
                  </div>
                  <span>{copy.showing(totalForView)}</span>
                </div>
                <div className="admin-table-wrap">
                  <table
                    className={
                      isRoomManager
                        ? 'admin-table cafe-request-table operational-request-table is-room-manager'
                        : 'admin-table cafe-request-table operational-request-table'
                    }
                  >
                    <thead>
                      <tr>
                        {isRoomManager && <th>{copy.unit}</th>}
                        <th>{copy.room}</th>
                        <th>{copy.request}</th>
                        <th>{copy.requested}</th>
                        <th>{copy.filterStatus}</th>
                        <th>{copy.actions}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRequests.map((request) => (
                        <tr key={request.id}>
                          {isRoomManager && (
                            <td data-label={copy.unit}>
                              <span className="operational-unit-name">
                                {copy.unitNames[request.unit as keyof typeof copy.unitNames]}
                              </span>
                            </td>
                          )}
                          <td data-label={copy.room}>
                            <strong className="cafe-room-number">{request.room.number}</strong>
                          </td>
                          <td data-label={copy.request}>
                            <RequestSummary copy={copy} request={request} />
                          </td>
                          <td className="admin-date" data-label={copy.requested}>
                            {formatDateTime(request.requestedAt, language)}
                          </td>
                          <td data-label={copy.filterStatus}>
                            <StatusPill copy={copy} status={request.status} />
                          </td>
                          <td className="cafe-request-table__actions" data-label={copy.actions}>
                            <button
                              className="admin-text-button"
                              onClick={() => setSelectedRequest(request)}
                              type="button"
                            >
                              {copy.viewDetails}
                            </button>
                            {!isRoomManager && request.status !== 'COMPLETED' && (
                              <button
                                className="admin-button admin-button--primary cafe-request-action"
                                disabled={busyRequestId === request.id}
                                onClick={() => void transitionRequest(request)}
                                type="button"
                              >
                                {request.status === 'NEW' ? copy.confirmRequest : copy.markDone}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPagesForView > 1 && (
                  <RequestPagination
                    copy={copy}
                    currentPage={currentPageForView}
                    onPageChange={tab === 'active' ? setActivePage : setHistoryPage}
                    totalItems={totalForView}
                    totalPages={totalPagesForView}
                  />
                )}
              </section>
            )}
          </section>
        </main>
      </div>

      {toast.length > 0 && (
        <div className="admin-toast" role="status">
          <span className="admin-toast__dot" aria-hidden="true" />
          <span>{toast}</span>
        </div>
      )}

      {selectedRequest !== null && (
        <RequestDrawer
          busy={busyRequestId === selectedRequest.id}
          copy={copy}
          language={language}
          onClose={() => setSelectedRequest(null)}
          onTransition={isRoomManager ? undefined : (request) => void transitionRequest(request)}
          readOnly={isRoomManager}
          request={selectedRequest}
          unitName={
            isRoomManager
              ? copy.unitNames[selectedRequest.unit as keyof typeof copy.unitNames]
              : undefined
          }
        />
      )}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="8.7" cy="8.7" r="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.3 12.3 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="M15.7 7.5A6 6 0 0 0 5.1 5.4L3.8 6.8M3.8 6.8V3.9M3.8 6.8h2.9M4.3 12.5A6 6 0 0 0 14.9 14.6l1.3-1.4M16.2 13.2v2.9M16.2 13.2h-2.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m5 5 10 10M15 5 5 15"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}
