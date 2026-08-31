import { createPortal } from 'react-dom';
import { useCallback, useEffect, useMemo, useState } from 'react';

import type { FormEvent } from 'react';

import { managementApi, StaffApiError } from './management-api';
import { AdminBrandMark, AdminLanguageSwitcher, ArrowIcon, getInitials } from './CafeWorkspace';
import {
  getReceptionistRoomsForView,
  getReceptionistTotalPages,
  mapReceptionistRoom,
  paginateReceptionistRooms,
  RECEPTIONIST_FLOORS,
  RECEPTIONIST_ROOM_PAGE_SIZE,
  RECEPTIONIST_STAY_DAYS_MAX,
  RECEPTIONIST_STAY_DAYS_MIN,
  type ReceptionistFloor,
  type ReceptionistRoomPreview,
} from './ReceptionistWorkspace.helpers';
import type { AuthCopy, Language, ReceptionistCopy } from './i18n';

interface StaffUser {
  displayName: string;
  roles: string[];
}

export interface ReceptionistWorkspaceProps {
  authCopy: AuthCopy;
  language: Language;
  onLanguageChange: (language: Language) => void;
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
  onOpen,
  room,
}: {
  copy: ReceptionistCopy;
  onOpen: (room: ReceptionistRoomPreview) => void;
  room: ReceptionistRoomPreview;
}) {
  const occupied = room.status === 'OCCUPIED';

  return (
    <article
      aria-label={`${copy.room} ${room.number}, ${occupied ? copy.occupied : copy.vacant}`}
      className={`receptionist-room-card ${occupied ? 'is-occupied' : 'is-vacant'}`}
    >
      <div className="receptionist-room-card__number">{room.number}</div>
      <div className="receptionist-room-card__status">
        <StatusDot status={room.status} />
        <span>{occupied ? copy.occupied : copy.vacant}</span>
      </div>
      {occupied && room.guestName !== null && (
        <p className="receptionist-room-card__guest" title={room.guestName}>
          {room.guestName}
        </p>
      )}
      {occupied && room.stayDays !== null && (
        <p className="receptionist-room-card__stay">{copy.stayDaysValue(room.stayDays)}</p>
      )}
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

function RoomDrawer({
  busy,
  copy,
  error,
  onAssign,
  onCheckout,
  onClose,
  onUpdate,
  room,
}: {
  busy: RoomMutation;
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
  language,
  onLanguageChange,
  onSignOut,
  user,
}: ReceptionistWorkspaceProps) {
  const copy = authCopy.receptionist;
  const [rooms, setRooms] = useState<ReceptionistRoomPreview[]>([]);
  const [activeFloor, setActiveFloor] = useState<ReceptionistFloor>(1);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<ReceptionistRoomPreview | null>(null);
  const [mutation, setMutation] = useState<RoomMutation>(null);
  const [drawerError, setDrawerError] = useState('');
  const [toast, setToast] = useState('');
  const isSearchingAllFloors = search.trim().length > 0;

  const loadRooms = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const response = await managementApi.listAllReceptionistRooms();
      const mappedRooms = response
        .map(mapReceptionistRoom)
        .filter((room): room is ReceptionistRoomPreview => room !== null);
      setRooms(mappedRooms);
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setLoadError(roomMutationError(error, copy));
    }
  }, [copy]);

  useEffect(() => {
    void loadRooms();
  }, [loadRooms]);

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

  function selectFloor(nextFloor: ReceptionistFloor) {
    setActiveFloor(nextFloor);
    setSearch('');
    setPage(1);
  }

  function openRoom(room: ReceptionistRoomPreview) {
    setSelectedRoom(room);
    setDrawerError('');
  }

  function replaceRoom(roomId: string, update: Partial<ReceptionistRoomPreview>) {
    setRooms((currentRooms) =>
      currentRooms.map((room) => (room.id === roomId ? { ...room, ...update } : room)),
    );
  }

  function showSuccess(message: string) {
    setToast(message);
    setDrawerError('');
    setSelectedRoom(null);
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
          <button className="admin-nav-item is-active" type="button">
            <RoomsIcon />
            <span>{copy.rooms}</span>
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
            <strong>{copy.rooms}</strong>
          </div>
          <div className="admin-topbar__actions">
            <AdminLanguageSwitcher
              authCopy={authCopy}
              language={language}
              onChange={onLanguageChange}
            />
          </div>
        </header>

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
                <div className="admin-loading-state receptionist-loading-state" aria-live="polite">
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
                <div className="receptionist-room-grid">
                  {visibleRooms.map((room) => (
                    <RoomCard copy={copy} key={room.id} onOpen={openRoom} room={room} />
                  ))}
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

      {selectedRoom !== null && (
        <RoomDrawer
          busy={mutation}
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
    </div>
  );
}
