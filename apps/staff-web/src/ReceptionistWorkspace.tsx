import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FormEvent } from 'react';

import {
  managementApi,
  StaffApiError,
  type IssuedGuestQr,
  type ReceptionistFolioHistoryResponse,
  type ReceptionistFolioResponse,
} from './management-api';
import {
  AdminBrandMark,
  AdminLanguageSwitcher,
  ArrowIcon,
  getInitials,
  OrdersIcon,
} from './CafeWorkspace';
import { BulkQrSheet, RoomOperations } from './ReceptionistRoomOperations';
import { OperationalDashboard } from './OperationalDashboard';
import {
  getReceptionistRoomsForView,
  getReceptionistTotalPages,
  emptyReceptionistFolioSummary,
  mapReceptionistRoom,
  paginateReceptionistRooms,
  readReceptionistRoomCache,
  readReceptionistFolioCache,
  RECEPTIONIST_FLOORS,
  RECEPTIONIST_ROOM_PAGE_SIZE,
  RECEPTIONIST_STAY_DAYS_MAX,
  RECEPTIONIST_STAY_DAYS_MIN,
  writeReceptionistRoomCache,
  writeReceptionistFolioCache,
  type ReceptionistFloor,
  type ReceptionistRoomPreview,
} from './ReceptionistWorkspace.helpers';
import type { AuthCopy, Language, ReceptionistCopy } from './i18n';
import { StaffRealtimeIndicator, useStaffRealtime } from './StaffRealtime';
import { ReceptionistFolioPanel } from './ReceptionistFolioPanel';

interface StaffUser {
  id: string;
  displayName: string;
  roles: string[];
  permissions: string[];
}

export interface ReceptionistWorkspaceProps {
  authCopy: AuthCopy;
  activePage: 'rooms' | 'housekeeping';
  language: Language;
  onLanguageChange: (language: Language) => void;
  onNavigateToRooms: () => void;
  onNavigateToHousekeeping: () => void;
  onSignOut: () => void;
  user: StaffUser;
}

type RoomMutation = 'assign' | 'update' | 'checkout' | null;

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <circle cx="8.7" cy="8.7" r="4.8" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.3 12.3 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function RoomsIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 20V5.5h14V20M8 8.5h2M14 8.5h2M8 12h2M14 12h2M8 15.5h8M11.5 20v-4.5h1V20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.65"
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

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="admin-icon" viewBox="0 0 20 20" fill="none">
      <path
        d="m4.5 10.2 3.5 3.4 7.5-7.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function StatusDot({ status }: { status: ReceptionistRoomPreview['status'] }) {
  return (
    <span aria-hidden="true" className={`receptionist-status-dot is-${status.toLowerCase()}`} />
  );
}

function RoomCard({
  copy,
  highlighted,
  onOpen,
  onSelect,
  room,
  selected,
}: {
  copy: ReceptionistCopy;
  highlighted: boolean;
  onOpen: (room: ReceptionistRoomPreview) => void;
  onSelect: (room: ReceptionistRoomPreview) => void;
  room: ReceptionistRoomPreview;
  selected: boolean;
}) {
  const occupied = room.status === 'OCCUPIED';
  const folioTotal = room.folioSummary.totalsByCurrency
    .map((amount) => `${amount.amount.toLocaleString()} ${amount.currency}`)
    .join(' · ');

  return (
    <article
      aria-label={`${copy.room} ${room.number}, ${occupied ? copy.occupied : copy.vacant}`}
      className={`receptionist-room-card ${occupied ? 'is-occupied' : 'is-vacant'} ${selected ? 'is-selected' : ''} ${highlighted ? 'is-realtime-highlighted' : ''}`}
    >
      <button
        aria-pressed={selected}
        className="receptionist-room-card__select"
        onClick={() => onSelect(room)}
        type="button"
      >
        <span className="receptionist-room-card__number">{room.number}</span>
        <span className="receptionist-room-card__status">
          <StatusDot status={room.status} />
          {occupied ? copy.occupied : copy.vacant}
        </span>
        <span className="receptionist-room-card__guest" title={room.guestName ?? undefined}>
          {room.guestName ?? '—'}
        </span>
        <span className="receptionist-room-card__folio">
          <b>{room.folioSummary.orderCount}</b> {copy.orders.toLocaleLowerCase()}
          {folioTotal.length > 0 && <small>{folioTotal}</small>}
        </span>
      </button>
      <button
        aria-haspopup="dialog"
        className="receptionist-room-card__action"
        onClick={() => onOpen(room)}
        type="button"
      >
        {occupied ? copy.openRoom : copy.assignGuest}
      </button>
    </article>
  );
}

function RoomPagination({
  copy,
  currentPage,
  onPageChange,
  totalPages,
}: {
  copy: ReceptionistCopy;
  currentPage: number;
  onPageChange: (page: number) => void;
  totalPages: number;
}) {
  return (
    <nav aria-label={copy.pagination} className="receptionist-pagination">
      <button
        aria-label={copy.previousPage}
        className="receptionist-pagination__control"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        type="button"
      >
        <ArrowIcon direction="left" />
        <span>{copy.previousPage}</span>
      </button>

      <div className="receptionist-pagination__pages">
        {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
          <button
            aria-current={page === currentPage ? 'page' : undefined}
            aria-label={copy.pageLabel(page)}
            className={
              page === currentPage
                ? 'receptionist-pagination__page is-active'
                : 'receptionist-pagination__page'
            }
            key={page}
            onClick={() => onPageChange(page)}
            type="button"
          >
            {page}
          </button>
        ))}
      </div>

      <span className="receptionist-pagination__summary">
        {copy.pageOf(currentPage, totalPages)}
      </span>

      <button
        aria-label={copy.nextPage}
        className="receptionist-pagination__control"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        type="button"
      >
        <span>{copy.nextPage}</span>
        <ArrowIcon direction="right" />
      </button>
    </nav>
  );
}

function roomMutationError(error: unknown, copy: ReceptionistCopy): string {
  if (error instanceof StaffApiError) {
    if (error.status === 401 || error.code === 'UNAUTHORIZED') return copy.sessionExpired;
    if (error.code === 'ROOM_ASSIGNMENT_CONFLICT') return copy.roomConflict;
    if (error.code === 'GUEST_ASSIGNMENT_CONFLICT') return copy.assignmentConflict;
    if (error.code === 'STAY_DAYS_INVALID') return copy.stayDaysInvalid;
  }
  return copy.apiError;
}

function folioRequestError(error: unknown, copy: ReceptionistCopy): string {
  if (error instanceof StaffApiError) {
    if (error.status === 401 || error.code === 'UNAUTHORIZED') return copy.sessionExpired;
    if (error.status === 403 || error.code === 'FORBIDDEN') return copy.apiError;
    if (error.message.length > 0 && error.message !== 'Request failed.') return error.message;
  }
  return copy.folioError;
}

function RoomDrawer({
  busy,
  copy,
  error,
  onAssign,
  onCheckout,
  onClose,
  onUpdate,
  canManageQr,
  canPairTv,
  room,
}: {
  busy: RoomMutation;
  canManageQr: boolean;
  canPairTv: boolean;
  copy: ReceptionistCopy;
  error: string;
  onAssign: (roomId: string, guestName: string, stayDays: number) => Promise<void>;
  onCheckout: (assignmentId: string) => Promise<void>;
  onClose: () => void;
  onUpdate: (assignmentId: string, guestName: string, stayDays: number) => Promise<void>;
  room: ReceptionistRoomPreview;
}) {
  const occupied = room.status === 'OCCUPIED' && room.assignmentId !== null;
  const [mode, setMode] = useState<'view' | 'edit'>(occupied ? 'view' : 'edit');
  const [guestName, setGuestName] = useState(room.guestName ?? '');
  const [stayDays, setStayDays] = useState(room.stayDays?.toString() ?? '');
  const [fieldError, setFieldError] = useState('');
  const [confirmCheckout, setConfirmCheckout] = useState(false);

  useEffect(() => {
    setMode(room.status === 'OCCUPIED' && room.assignmentId !== null ? 'view' : 'edit');
    setGuestName(room.guestName ?? '');
    setStayDays(room.stayDays?.toString() ?? '');
    setFieldError('');
    setConfirmCheckout(false);
  }, [room.assignmentId, room.guestName, room.id, room.stayDays, room.status]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      if (confirmCheckout) {
        setConfirmCheckout(false);
      } else if (busy === null) {
        onClose();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, confirmCheckout, onClose]);

  const isBusy = busy !== null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = guestName.trim().replace(/\s+/g, ' ');
    if (normalizedName.length === 0) {
      setFieldError(copy.guestNameRequired);
      return;
    }
    if (stayDays.trim().length === 0) {
      setFieldError(copy.stayDaysRequired);
      return;
    }
    const normalizedStayDays = Number(stayDays);
    if (
      !Number.isInteger(normalizedStayDays) ||
      normalizedStayDays < RECEPTIONIST_STAY_DAYS_MIN ||
      normalizedStayDays > RECEPTIONIST_STAY_DAYS_MAX
    ) {
      setFieldError(copy.stayDaysInvalid);
      return;
    }
    setFieldError('');
    try {
      if (occupied && room.assignmentId !== null) {
        await onUpdate(room.assignmentId, normalizedName, normalizedStayDays);
      } else {
        await onAssign(room.id, normalizedName, normalizedStayDays);
      }
    } catch {
      // The parent keeps the localized API error visible in the drawer.
    }
  }

  async function handleCheckout() {
    if (room.assignmentId === null) return;
    try {
      await onCheckout(room.assignmentId);
    } catch {
      // The parent keeps the localized API error visible in the drawer.
    }
  }

  const title = occupied
    ? mode === 'edit'
      ? copy.editGuestTitle
      : copy.guestDetails
    : copy.assignGuestTitle;

  const drawer = (
    <div
      className="admin-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isBusy) onClose();
      }}
    >
      <aside
        aria-labelledby="receptionist-room-drawer-title"
        aria-modal="true"
        className="admin-drawer receptionist-drawer"
        role="dialog"
      >
        <div className="admin-drawer__header">
          <div>
            <p className="admin-eyebrow">{copy.room}</p>
            <h2 id="receptionist-room-drawer-title">{room.number}</h2>
          </div>
          <button
            aria-label={copy.close}
            className="admin-icon-button"
            disabled={isBusy}
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="admin-drawer__body receptionist-drawer__body">
          <div className={`receptionist-drawer__status is-${room.status.toLowerCase()}`}>
            <span>
              <StatusDot status={room.status} />
              {room.status === 'OCCUPIED' ? copy.occupied : copy.vacant}
            </span>
          </div>

          {mode === 'view' && occupied ? (
            <div className="receptionist-room-detail">
              <div className="receptionist-room-detail__intro">
                <p className="admin-eyebrow">{title}</p>
                <h3>{room.guestName}</h3>
                <p>{copy.occupiedRoomDescription}</p>
              </div>

              <div className="receptionist-room-detail__stay">
                <p className="admin-eyebrow">{copy.stayDuration}</p>
                <strong>{room.stayDays === null ? '—' : copy.stayDaysValue(room.stayDays)}</strong>
              </div>

              {error.length > 0 && (
                <p className="admin-form-error" role="alert">
                  {error}
                </p>
              )}

              <div className="admin-form-actions receptionist-drawer__actions">
                <button
                  className="admin-button admin-button--quiet"
                  disabled={isBusy}
                  onClick={() => setMode('edit')}
                  type="button"
                >
                  {copy.editGuest}
                </button>
                <button
                  className="admin-button admin-button--danger"
                  disabled={isBusy}
                  onClick={() => setConfirmCheckout(true)}
                  type="button"
                >
                  {copy.checkoutGuest}
                </button>
              </div>
            </div>
          ) : (
            <form className="admin-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
              <div className="admin-form-intro admin-form-intro--plain">
                <p>{occupied ? copy.editGuestDescription : copy.assignGuestDescription}</p>
              </div>

              <div className="admin-field">
                <label htmlFor="receptionist-guest-name">
                  {copy.guestName} <span aria-hidden="true">*</span>
                </label>
                <input
                  autoFocus
                  autoComplete="name"
                  id="receptionist-guest-name"
                  maxLength={200}
                  onChange={(event) => {
                    setGuestName(event.target.value);
                    if (fieldError.length > 0) setFieldError('');
                  }}
                  placeholder={copy.guestNamePlaceholder}
                  required
                  value={guestName}
                />
                <p className="admin-field-hint">{copy.guestNameHint}</p>
              </div>

              <div className="admin-field">
                <label htmlFor="receptionist-stay-days">
                  {copy.stayDuration} <span aria-hidden="true">*</span>
                </label>
                <input
                  id="receptionist-stay-days"
                  inputMode="numeric"
                  max={RECEPTIONIST_STAY_DAYS_MAX}
                  min={RECEPTIONIST_STAY_DAYS_MIN}
                  onChange={(event) => {
                    setStayDays(event.target.value);
                    if (fieldError.length > 0) setFieldError('');
                  }}
                  placeholder={copy.stayDaysPlaceholder}
                  required
                  step="1"
                  type="number"
                  value={stayDays}
                />
                <p className="admin-field-hint">{copy.stayDaysHint}</p>
              </div>

              {(fieldError.length > 0 || error.length > 0) && (
                <p className="admin-form-error" role="alert">
                  {fieldError || error}
                </p>
              )}

              <div className="admin-form-actions receptionist-drawer__actions">
                <button
                  className="admin-button admin-button--quiet"
                  disabled={isBusy}
                  onClick={() => (occupied ? setMode('view') : onClose())}
                  type="button"
                >
                  {copy.cancel}
                </button>
                <button
                  className="admin-button admin-button--primary"
                  disabled={isBusy}
                  type="submit"
                >
                  {busy === 'assign'
                    ? copy.assigningGuest
                    : busy === 'update'
                      ? copy.updatingGuest
                      : occupied
                        ? copy.updateGuest
                        : copy.assignGuest}
                </button>
              </div>
            </form>
          )}

          <RoomOperations
            canManageQr={canManageQr}
            canPairTv={canPairTv}
            copy={copy}
            room={{ id: room.id, number: room.number }}
          />
        </div>
      </aside>
    </div>
  );

  return createPortal(
    <>
      {drawer}
      {confirmCheckout && (
        <div
          className="admin-overlay admin-overlay--center"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isBusy) setConfirmCheckout(false);
          }}
        >
          <div
            aria-labelledby="receptionist-checkout-title"
            aria-modal="true"
            className="admin-confirm-dialog"
            role="alertdialog"
          >
            <div className="admin-confirm-icon admin-confirm-icon--danger">!</div>
            <p className="admin-eyebrow">{copy.checkoutGuest}</p>
            <h2 id="receptionist-checkout-title">{copy.checkoutTitle}</h2>
            <p>{copy.checkoutDescription(room.number, room.guestName ?? '')}</p>
            <div className="admin-form-actions">
              <button
                className="admin-button admin-button--quiet"
                disabled={isBusy}
                onClick={() => setConfirmCheckout(false)}
                type="button"
              >
                {copy.cancel}
              </button>
              <button
                className="admin-button admin-button--danger"
                disabled={isBusy}
                onClick={() => void handleCheckout()}
                type="button"
              >
                {busy === 'checkout' ? copy.checkingOut : copy.confirmCheckout}
              </button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}

export function ReceptionistWorkspace({
  authCopy,
  activePage,
  language,
  onLanguageChange,
  onNavigateToRooms,
  onNavigateToHousekeeping,
  onSignOut,
  user,
}: ReceptionistWorkspaceProps) {
  const copy = authCopy.receptionist;
  const cachedRooms = useMemo(() => readReceptionistRoomCache(user.id), [user.id]);
  const hasInitialRoomCache = cachedRooms !== null;
  const [rooms, setRooms] = useState<ReceptionistRoomPreview[]>(() => cachedRooms ?? []);
  const [activeFloor, setActiveFloor] = useState<ReceptionistFloor>(1);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(() =>
    hasInitialRoomCache ? 'ready' : 'loading',
  );
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<ReceptionistRoomPreview | null>(null);
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [activeFolio, setActiveFolio] = useState<ReceptionistFolioResponse | null>(null);
  const [folioHistory, setFolioHistory] = useState<ReceptionistFolioHistoryResponse | null>(null);
  const [historicalFolio, setHistoricalFolio] = useState<ReceptionistFolioResponse | null>(null);
  const [folioTab, setFolioTab] = useState<'current' | 'history'>('current');
  const [activeFolioState, setActiveFolioState] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    'idle',
  );
  const [folioHistoryState, setFolioHistoryState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [historicalFolioState, setHistoricalFolioState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [activeFolioError, setActiveFolioError] = useState('');
  const [folioHistoryError, setFolioHistoryError] = useState('');
  const [historicalFolioError, setHistoricalFolioError] = useState('');
  const [selectedHistoryAssignmentId, setSelectedHistoryAssignmentId] = useState<string | null>(
    null,
  );
  const [mutation, setMutation] = useState<RoomMutation>(null);
  const [drawerError, setDrawerError] = useState('');
  const [toast, setToast] = useState('');
  const [bulkQrItems, setBulkQrItems] = useState<IssuedGuestQr[] | null>(null);
  const [bulkQrBusy, setBulkQrBusy] = useState(false);
  const [bulkQrError, setBulkQrError] = useState('');
  const roomsRef = useRef(rooms);
  const activeRoomLoadController = useRef<AbortController | null>(null);
  const activeFolioLoadController = useRef<AbortController | null>(null);
  const folioHistoryLoadController = useRef<AbortController | null>(null);
  const historicalFolioLoadController = useRef<AbortController | null>(null);
  const activeFolioLoadSequence = useRef(0);
  const folioHistoryLoadSequence = useRef(0);
  const historicalFolioLoadSequence = useRef(0);
  const roomLoadSequence = useRef(0);
  const realtimeRefreshTimer = useRef<number | null>(null);
  const realtimeHighlightTimeouts = useRef(new Map<string, number>());
  const [highlightedRoomIds, setHighlightedRoomIds] = useState<Set<string>>(() => new Set());
  const isSearchingAllFloors = search.trim().length > 0;
  const canPairTv = user.permissions.includes('receptionist:tv:pair');
  const canManageQr = user.permissions.includes('receptionist:guest:assign');
  const { status: realtimeStatus, subscribe } = useStaffRealtime();

  const focusedRoom = useMemo(
    () => rooms.find((room) => room.id === focusedRoomId) ?? null,
    [focusedRoomId, rooms],
  );

  const loadRooms = useCallback(
    async ({ silent = false, signal }: { silent?: boolean; signal?: AbortSignal } = {}) => {
      activeRoomLoadController.current?.abort();
      const controller = new AbortController();
      const requestSequence = ++roomLoadSequence.current;
      const isCurrentRequest = () =>
        requestSequence === roomLoadSequence.current && !controller.signal.aborted;
      if (signal !== undefined) {
        if (signal.aborted) controller.abort();
        else signal.addEventListener('abort', () => controller.abort(), { once: true });
      }
      activeRoomLoadController.current = controller;
      const keepVisibleData = silent || hasInitialRoomCache || roomsRef.current.length > 0;
      if (!keepVisibleData) setLoadState('loading');
      if (silent) setRefreshing(true);
      setLoadError('');
      try {
        const response = await managementApi.listAllReceptionistRooms(controller.signal);
        const mappedRooms = response
          .map(mapReceptionistRoom)
          .filter((room): room is ReceptionistRoomPreview => room !== null);
        if (!isCurrentRequest()) return;
        setRooms(mappedRooms);
        roomsRef.current = mappedRooms;
        writeReceptionistRoomCache(user.id, mappedRooms);
        setLoadState('ready');
      } catch (error) {
        if ((error instanceof Error && error.name === 'AbortError') || !isCurrentRequest()) return;
        setLoadState(keepVisibleData ? 'ready' : 'error');
        setLoadError(roomMutationError(error, copy));
      } finally {
        if (activeRoomLoadController.current === controller) {
          activeRoomLoadController.current = null;
          setRefreshing(false);
        }
      }
    },
    [copy, hasInitialRoomCache, user.id],
  );

  const loadActiveFolio = useCallback(
    async (room: ReceptionistRoomPreview | null, { silent = false } = {}) => {
      activeFolioLoadController.current?.abort();
      const controller = new AbortController();
      const sequence = ++activeFolioLoadSequence.current;
      const isCurrentRequest = () =>
        sequence === activeFolioLoadSequence.current && !controller.signal.aborted;
      activeFolioLoadController.current = controller;
      setActiveFolioError('');

      if (room === null || room.status === 'VACANT' || room.assignmentId === null) {
        setActiveFolio(null);
        setActiveFolioState('ready');
        if (activeFolioLoadController.current === controller) {
          activeFolioLoadController.current = null;
        }
        return;
      }

      const cached = readReceptionistFolioCache<ReceptionistFolioResponse>(
        user.id,
        room.id,
        room.assignmentId,
        'active',
      );
      if (cached !== null) {
        setActiveFolio(cached);
        setActiveFolioState('ready');
      } else if (!silent) {
        setActiveFolio(null);
        setActiveFolioState('loading');
      } else {
        setActiveFolioState('loading');
      }

      try {
        const response = await managementApi.getReceptionistActiveFolio(
          room.id,
          { page: 1, pageSize: 50 },
          controller.signal,
        );
        if (!isCurrentRequest()) return;
        setActiveFolio(response);
        setActiveFolioState('ready');
        writeReceptionistFolioCache(user.id, room.id, room.assignmentId, 'active', response);
      } catch (error) {
        if ((error instanceof Error && error.name === 'AbortError') || !isCurrentRequest()) return;
        setActiveFolioState(cached === null ? 'error' : 'ready');
        setActiveFolioError(folioRequestError(error, copy));
      } finally {
        if (activeFolioLoadController.current === controller) {
          activeFolioLoadController.current = null;
        }
      }
    },
    [copy, user.id],
  );

  const loadFolioHistory = useCallback(
    async (room: ReceptionistRoomPreview | null) => {
      folioHistoryLoadController.current?.abort();
      const controller = new AbortController();
      const sequence = ++folioHistoryLoadSequence.current;
      const isCurrentRequest = () =>
        sequence === folioHistoryLoadSequence.current && !controller.signal.aborted;
      folioHistoryLoadController.current = controller;
      setFolioHistoryError('');
      if (room === null) {
        setFolioHistory(null);
        setFolioHistoryState('ready');
        if (folioHistoryLoadController.current === controller) {
          folioHistoryLoadController.current = null;
        }
        return;
      }

      const cached = readReceptionistFolioCache<ReceptionistFolioHistoryResponse>(
        user.id,
        room.id,
        null,
        'history',
      );
      if (cached !== null) {
        setFolioHistory(cached);
        setFolioHistoryState('ready');
      } else {
        setFolioHistory(null);
        setFolioHistoryState('loading');
      }

      try {
        const response = await managementApi.listReceptionistFolioHistory(
          room.id,
          { page: 1, pageSize: 25 },
          controller.signal,
        );
        if (!isCurrentRequest()) return;
        setFolioHistory(response);
        setFolioHistoryState('ready');
        writeReceptionistFolioCache(user.id, room.id, null, 'history', response);
      } catch (error) {
        if ((error instanceof Error && error.name === 'AbortError') || !isCurrentRequest()) return;
        setFolioHistoryState(cached === null ? 'error' : 'ready');
        setFolioHistoryError(folioRequestError(error, copy));
      } finally {
        if (folioHistoryLoadController.current === controller) {
          folioHistoryLoadController.current = null;
        }
      }
    },
    [copy, user.id],
  );

  const loadHistoricalFolio = useCallback(
    async (room: ReceptionistRoomPreview | null, assignmentId: string) => {
      if (room === null) return;
      historicalFolioLoadController.current?.abort();
      const controller = new AbortController();
      const sequence = ++historicalFolioLoadSequence.current;
      const isCurrentRequest = () =>
        sequence === historicalFolioLoadSequence.current && !controller.signal.aborted;
      historicalFolioLoadController.current = controller;
      setHistoricalFolioError('');
      const cached = readReceptionistFolioCache<ReceptionistFolioResponse>(
        user.id,
        room.id,
        assignmentId,
        'history-detail',
      );
      if (cached !== null) {
        setHistoricalFolio(cached);
        setHistoricalFolioState('ready');
      } else {
        setHistoricalFolio(null);
        setHistoricalFolioState('loading');
      }

      try {
        const response = await managementApi.getReceptionistFolioHistoryDetail(
          room.id,
          assignmentId,
          { page: 1, pageSize: 50 },
          controller.signal,
        );
        if (!isCurrentRequest()) return;
        setHistoricalFolio(response);
        setHistoricalFolioState('ready');
        writeReceptionistFolioCache(user.id, room.id, assignmentId, 'history-detail', response);
      } catch (error) {
        if ((error instanceof Error && error.name === 'AbortError') || !isCurrentRequest()) return;
        setHistoricalFolioState(cached === null ? 'error' : 'ready');
        setHistoricalFolioError(folioRequestError(error, copy));
      } finally {
        if (historicalFolioLoadController.current === controller) {
          historicalFolioLoadController.current = null;
        }
      }
    },
    [copy, user.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadRooms({ silent: hasInitialRoomCache, signal: controller.signal });
    return () => {
      controller.abort();
      activeRoomLoadController.current?.abort();
    };
  }, [hasInitialRoomCache, loadRooms]);

  const queueRealtimeRefresh = useCallback(() => {
    if (realtimeRefreshTimer.current !== null) return;
    realtimeRefreshTimer.current = window.setTimeout(() => {
      realtimeRefreshTimer.current = null;
      void loadRooms({ silent: true });
    }, 160);
  }, [loadRooms]);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void loadRooms({ silent: true });
    };
    const interval = window.setInterval(
      refreshIfVisible,
      realtimeStatus === 'live' ? 60_000 : 15_000,
    );
    window.addEventListener('focus', refreshIfVisible);
    window.addEventListener('online', refreshIfVisible);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refreshIfVisible);
      window.removeEventListener('online', refreshIfVisible);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [loadRooms, realtimeStatus]);

  useEffect(() => {
    if (realtimeStatus !== 'live') return undefined;
    void loadRooms({ silent: true });
    return undefined;
  }, [loadRooms, realtimeStatus]);

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      const isRoomEvent = event.eventType === 'staff.room.updated';
      const isRequestEvent =
        event.eventType === 'staff.request.created' || event.eventType === 'staff.request.updated';
      if (!isRoomEvent && !isRequestEvent) return;

      const roomId = isRoomEvent ? event.entityId : event.roomId;

      setHighlightedRoomIds((current) => new Set(current).add(roomId));
      const previousTimeout = realtimeHighlightTimeouts.current.get(roomId);
      if (previousTimeout !== undefined) window.clearTimeout(previousTimeout);
      const timeout = window.setTimeout(() => {
        setHighlightedRoomIds((current) => {
          const next = new Set(current);
          next.delete(roomId);
          return next;
        });
        realtimeHighlightTimeouts.current.delete(roomId);
      }, 4_000);
      realtimeHighlightTimeouts.current.set(roomId, timeout);
      if (activePage === 'rooms') setToast(copy.realtimeUpdated);
      queueRealtimeRefresh();
      if (roomId === focusedRoomId && isRequestEvent) {
        void loadActiveFolio(focusedRoom, { silent: true });
      }
    });
    return unsubscribe;
  }, [
    activePage,
    copy.realtimeUpdated,
    focusedRoom,
    focusedRoomId,
    loadActiveFolio,
    queueRealtimeRefresh,
    subscribe,
  ]);

  useEffect(
    () => () => {
      if (realtimeRefreshTimer.current !== null) {
        window.clearTimeout(realtimeRefreshTimer.current);
        realtimeRefreshTimer.current = null;
      }
      for (const timeout of realtimeHighlightTimeouts.current.values()) {
        window.clearTimeout(timeout);
      }
      realtimeHighlightTimeouts.current.clear();
    },
    [],
  );

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    if (toast.length === 0) return undefined;
    const timeout = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const filteredRooms = useMemo(
    () => getReceptionistRoomsForView(rooms, activeFloor, search),
    [activeFloor, rooms, search],
  );
  const totalPages = getReceptionistTotalPages(filteredRooms.length);
  const currentPage = Math.min(page, totalPages);
  const visibleRooms = paginateReceptionistRooms(
    filteredRooms,
    currentPage,
    RECEPTIONIST_ROOM_PAGE_SIZE,
  );
  const firstVisible = visibleRooms[0];
  const lastVisible = visibleRooms[visibleRooms.length - 1];
  const floorDefinition = RECEPTIONIST_FLOORS.find(
    (definition) => definition.floor === activeFloor,
  );

  useEffect(() => {
    if (currentPage !== page) setPage(currentPage);
  }, [currentPage, page]);

  useEffect(() => {
    if (visibleRooms.length === 0) {
      if (focusedRoomId !== null) setFocusedRoomId(null);
      return;
    }
    if (!visibleRooms.some((room) => room.id === focusedRoomId)) {
      setFocusedRoomId(visibleRooms[0]?.id ?? null);
    }
  }, [focusedRoomId, visibleRooms]);

  useEffect(() => {
    setFolioTab('current');
    setActiveFolio(null);
    setActiveFolioState('idle');
    setActiveFolioError('');
    setFolioHistory(null);
    setFolioHistoryState('idle');
    setFolioHistoryError('');
    setHistoricalFolio(null);
    setHistoricalFolioState('idle');
    setHistoricalFolioError('');
    setSelectedHistoryAssignmentId(null);
    void loadActiveFolio(focusedRoom);
  }, [focusedRoom?.assignmentId, focusedRoom?.id, focusedRoom?.status, loadActiveFolio]);

  useEffect(() => {
    if (folioTab !== 'history') return undefined;
    void loadFolioHistory(focusedRoom);
    return undefined;
  }, [folioTab, focusedRoom?.id, loadFolioHistory]);

  useEffect(
    () => () => {
      activeFolioLoadController.current?.abort();
      folioHistoryLoadController.current?.abort();
      historicalFolioLoadController.current?.abort();
    },
    [],
  );

  function selectFloor(nextFloor: ReceptionistFloor) {
    setActiveFloor(nextFloor);
    setSearch('');
    setPage(1);
  }

  function openRoom(room: ReceptionistRoomPreview) {
    setSelectedRoom(room);
    setDrawerError('');
  }

  function selectRoom(room: ReceptionistRoomPreview) {
    setFocusedRoomId(room.id);
  }

  function replaceRoom(roomId: string, update: Partial<ReceptionistRoomPreview>) {
    setRooms((currentRooms) => {
      const nextRooms = currentRooms.map((room) =>
        room.id === roomId ? { ...room, ...update } : room,
      );
      roomsRef.current = nextRooms;
      writeReceptionistRoomCache(user.id, nextRooms);
      return nextRooms;
    });
  }

  function selectFolioTab(tab: 'current' | 'history') {
    setFolioTab(tab);
  }

  function showSuccess(message: string) {
    setToast(message);
    setDrawerError('');
    setSelectedRoom(null);
  }

  async function generateBulkQrSheet() {
    if (!canManageQr || rooms.length === 0 || !window.confirm(copy.qrSheetConfirm)) return;
    setBulkQrBusy(true);
    setBulkQrError('');
    try {
      const response = await managementApi.issueGuestQrBatch(rooms.map((room) => room.id));
      setBulkQrItems(response.items);
    } catch (error) {
      setBulkQrError(roomMutationError(error, copy));
    } finally {
      setBulkQrBusy(false);
    }
  }

  async function assignGuest(roomId: string, guestName: string, stayDays: number) {
    setMutation('assign');
    setDrawerError('');
    try {
      const assignment = await managementApi.assignGuestToRoom(roomId, guestName, stayDays);
      replaceRoom(roomId, {
        assignmentId: assignment.id,
        guestName: assignment.guestName,
        stayDays: assignment.stayDays,
        status: 'OCCUPIED',
        folioSummary: emptyReceptionistFolioSummary(),
      });
      showSuccess(copy.assignSuccess);
    } catch (error) {
      const message = roomMutationError(error, copy);
      setDrawerError(message);
      throw error;
    } finally {
      setMutation(null);
    }
  }

  async function updateGuest(assignmentId: string, guestName: string, stayDays: number) {
    setMutation('update');
    setDrawerError('');
    try {
      const assignment = await managementApi.updateGuestAssignment(
        assignmentId,
        guestName,
        stayDays,
      );
      replaceRoom(assignment.room.id, {
        guestName: assignment.guestName,
        stayDays: assignment.stayDays,
      });
      showSuccess(copy.updateSuccess);
    } catch (error) {
      const message = roomMutationError(error, copy);
      setDrawerError(message);
      throw error;
    } finally {
      setMutation(null);
    }
  }

  async function checkoutGuest(assignmentId: string) {
    setMutation('checkout');
    setDrawerError('');
    try {
      const assignment = await managementApi.checkoutGuestAssignment(assignmentId);
      replaceRoom(assignment.room.id, {
        assignmentId: null,
        guestName: null,
        stayDays: null,
        status: 'VACANT',
        folioSummary: emptyReceptionistFolioSummary(),
      });
      showSuccess(copy.checkoutSuccess);
    } catch (error) {
      const message = roomMutationError(error, copy);
      setDrawerError(message);
      throw error;
    } finally {
      setMutation(null);
    }
  }

  const rangeLabel =
    firstVisible === undefined || lastVisible === undefined
      ? copy.noRooms
      : copy.showingRange(firstVisible.number, lastVisible.number, filteredRooms.length);

  return (
    <div className="admin-shell receptionist-shell">
      <aside className="admin-sidebar receptionist-sidebar">
        <div className="admin-sidebar__brand">
          <AdminBrandMark />
          <div>
            <strong>Hadith Hotel</strong>
          </div>
        </div>

        <div className="admin-sidebar__rule" />
        <p className="admin-sidebar__label">{copy.mainNavigation}</p>
        <nav aria-label={copy.mainNavigation} className="admin-sidebar__nav">
          <button
            className={`admin-nav-item ${activePage === 'rooms' ? 'is-active' : ''}`}
            onClick={onNavigateToRooms}
            type="button"
          >
            <RoomsIcon />
            <span>{copy.rooms}</span>
            <ArrowIcon direction="right" />
          </button>
          <button
            className={`admin-nav-item ${activePage === 'housekeeping' ? 'is-active' : ''}`}
            onClick={onNavigateToHousekeeping}
            type="button"
          >
            <OrdersIcon />
            <span>{copy.housekeeping}</span>
            <ArrowIcon direction="right" />
          </button>
        </nav>

        <div className="receptionist-sidebar__footer">
          <div className="receptionist-sidebar__user">
            <span className="admin-avatar">{getInitials(user.displayName)}</span>
            <div>
              <strong>{user.displayName}</strong>
              <span>{authCopy.roleLabels.RECEPTIONIST}</span>
            </div>
          </div>
          <button className="receptionist-sidebar__logout" onClick={onSignOut} type="button">
            {authCopy.signOut}
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <strong>{activePage === 'rooms' ? copy.rooms : copy.housekeeping}</strong>
          </div>
          <div className="admin-topbar__actions">
            <StaffRealtimeIndicator language={language} />
            <AdminLanguageSwitcher
              authCopy={authCopy}
              language={language}
              onChange={onLanguageChange}
            />
          </div>
        </header>

        <div className="receptionist-view-stack">
          <div className="receptionist-view-panel" hidden={activePage !== 'rooms'}>
            <main className="admin-content receptionist-content">
              <section aria-label={copy.rooms} className="admin-page">
                <div className="receptionist-toolbar">
                  <label className="admin-search-field receptionist-search">
                    <span className="sr-only">{copy.searchRooms}</span>
                    <SearchIcon />
                    <input
                      aria-label={copy.searchRooms}
                      disabled={loadState === 'loading'}
                      onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                      }}
                      placeholder={copy.searchPlaceholder}
                      type="search"
                      value={search}
                    />
                  </label>
                  {canManageQr && (
                    <button
                      className="admin-button admin-button--quiet receptionist-bulk-qr-button"
                      disabled={loadState !== 'ready' || bulkQrBusy}
                      onClick={() => void generateBulkQrSheet()}
                      type="button"
                    >
                      {bulkQrBusy ? copy.qrSheetGenerating : copy.qrSheet}
                    </button>
                  )}
                  {loadState === 'ready' && loadError.length > 0 && (
                    <div className="receptionist-refresh-notice" role="status">
                      <span>{loadError}</span>
                      <button onClick={() => void loadRooms({ silent: true })} type="button">
                        {copy.retry}
                      </button>
                    </div>
                  )}
                  {bulkQrError.length > 0 && (
                    <p className="admin-form-error receptionist-bulk-qr-error" role="alert">
                      {bulkQrError}
                    </p>
                  )}
                </div>

                <div
                  className="receptionist-floor-tabs"
                  role="tablist"
                  aria-label={copy.floorNavigation}
                >
                  {RECEPTIONIST_FLOORS.map((definition) => (
                    <button
                      aria-controls="receptionist-room-board"
                      aria-selected={activeFloor === definition.floor}
                      className={
                        activeFloor === definition.floor
                          ? 'receptionist-floor-tab is-active'
                          : 'receptionist-floor-tab'
                      }
                      key={definition.floor}
                      onClick={() => selectFloor(definition.floor)}
                      role="tab"
                      type="button"
                    >
                      {copy.floorLabel(definition.floor)}
                    </button>
                  ))}
                </div>

                <div className="receptionist-board-heading">
                  <div>
                    <p className="admin-eyebrow">{copy.roomBoard}</p>
                    <h2>
                      {isSearchingAllFloors
                        ? copy.searchResults
                        : floorDefinition === undefined
                          ? copy.rooms
                          : copy.floorRange(floorDefinition.firstRoom, floorDefinition.lastRoom)}
                    </h2>
                  </div>
                  <div className="receptionist-board-heading__actions">
                    <button
                      className="admin-button admin-button--quiet"
                      disabled={refreshing || loadState === 'loading'}
                      onClick={() => void loadRooms({ silent: true })}
                      type="button"
                    >
                      {refreshing ? copy.loading : copy.refresh}
                    </button>
                    <div className="receptionist-status-legend" aria-label={copy.statusLegend}>
                      <span>
                        <StatusDot status="VACANT" />
                        {copy.vacant}
                      </span>
                      <span>
                        <StatusDot status="OCCUPIED" />
                        {copy.occupied}
                      </span>
                    </div>
                  </div>
                </div>

                <section
                  aria-labelledby="receptionist-room-board-title"
                  className="receptionist-room-board"
                  id="receptionist-room-board"
                  role="tabpanel"
                >
                  <h3 className="sr-only" id="receptionist-room-board-title">
                    {copy.roomBoard}
                  </h3>
                  {loadState === 'loading' ? (
                    <div
                      className="admin-loading-state receptionist-loading-state"
                      aria-live="polite"
                    >
                      <span className="admin-loading-line admin-loading-line--wide" />
                      <span className="admin-loading-line" />
                      <span className="admin-loading-line admin-loading-line--short" />
                      <p>{copy.loading}</p>
                    </div>
                  ) : loadState === 'error' ? (
                    <div className="admin-empty-state receptionist-empty-state">
                      <div className="admin-empty-state__mark">!</div>
                      <h3>{copy.errorLoading}</h3>
                      <p>{loadError}</p>
                      <button
                        className="admin-button admin-button--quiet"
                        onClick={() => void loadRooms()}
                        type="button"
                      >
                        {copy.retry}
                      </button>
                    </div>
                  ) : visibleRooms.length > 0 ? (
                    <div className="receptionist-master-detail">
                      <div className="receptionist-room-list" aria-label={copy.rooms}>
                        <div className="receptionist-room-list__header">
                          <div>
                            <p className="admin-eyebrow">{copy.rooms}</p>
                            <span>
                              {copy.showingRange(
                                firstVisible?.number ?? '—',
                                lastVisible?.number ?? '—',
                                filteredRooms.length,
                              )}
                            </span>
                          </div>
                          <span className="receptionist-room-list__count">
                            {filteredRooms.length}
                          </span>
                        </div>
                        <div className="receptionist-room-grid">
                          {visibleRooms.map((room) => (
                            <RoomCard
                              copy={copy}
                              highlighted={highlightedRoomIds.has(room.id)}
                              key={room.id}
                              onOpen={openRoom}
                              onSelect={selectRoom}
                              room={room}
                              selected={focusedRoomId === room.id}
                            />
                          ))}
                        </div>
                      </div>
                      <ReceptionistFolioPanel
                        activeFolio={activeFolio}
                        activeError={activeFolioError}
                        activeState={activeFolioState}
                        copy={copy}
                        historicalFolio={historicalFolio}
                        historicalError={historicalFolioError}
                        historicalState={historicalFolioState}
                        history={folioHistory}
                        historyError={folioHistoryError}
                        historyState={folioHistoryState}
                        language={language}
                        onOpenRoomAccess={() => {
                          if (focusedRoom !== null) openRoom(focusedRoom);
                        }}
                        onRetryActive={() => void loadActiveFolio(focusedRoom)}
                        onRetryHistory={() => void loadFolioHistory(focusedRoom)}
                        onRetryHistorical={() => {
                          if (selectedHistoryAssignmentId !== null) {
                            void loadHistoricalFolio(focusedRoom, selectedHistoryAssignmentId);
                          }
                        }}
                        onSelectHistory={(assignmentId) => {
                          setSelectedHistoryAssignmentId(assignmentId);
                          void loadHistoricalFolio(focusedRoom, assignmentId);
                        }}
                        onTabChange={selectFolioTab}
                        room={focusedRoom}
                        folioTab={folioTab}
                        selectedHistoryAssignmentId={selectedHistoryAssignmentId}
                      />
                    </div>
                  ) : (
                    <div className="receptionist-empty-state">
                      <div className="admin-empty-state__mark">—</div>
                      <h3>{copy.noRooms}</h3>
                      <p>{copy.noRoomsDescription}</p>
                    </div>
                  )}
                </section>

                <div className="receptionist-board-footer">
                  <p className="receptionist-range-label">{rangeLabel}</p>
                  {filteredRooms.length > 0 && (
                    <RoomPagination
                      copy={copy}
                      currentPage={currentPage}
                      onPageChange={setPage}
                      totalPages={totalPages}
                    />
                  )}
                </div>
              </section>
            </main>
          </div>
          <div className="receptionist-view-panel" hidden={activePage !== 'housekeeping'}>
            <OperationalDashboard
              authCopy={authCopy}
              embedded
              language={language}
              onLanguageChange={onLanguageChange}
              onNavigate={undefined}
              onSignOut={onSignOut}
              role="HOUSEKEEPING"
              user={user}
            />
          </div>
        </div>
      </div>

      {selectedRoom !== null && (
        <RoomDrawer
          busy={mutation}
          canManageQr={canManageQr}
          canPairTv={canPairTv}
          copy={copy}
          error={drawerError}
          onAssign={assignGuest}
          onCheckout={checkoutGuest}
          onClose={() => {
            if (mutation === null) setSelectedRoom(null);
          }}
          onUpdate={updateGuest}
          room={selectedRoom}
        />
      )}

      {toast.length > 0 && (
        <div className="admin-toast" role="status">
          <CheckIcon />
          <span>{toast}</span>
        </div>
      )}

      {bulkQrItems !== null && (
        <BulkQrSheet copy={copy} items={bulkQrItems} onClose={() => setBulkQrItems(null)} />
      )}
    </div>
  );
}
