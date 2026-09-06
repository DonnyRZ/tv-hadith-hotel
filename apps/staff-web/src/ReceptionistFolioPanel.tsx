import { useMemo, useState } from 'react';

import type { ReceptionistRoomPreview } from './ReceptionistWorkspace.helpers';
import type {
  ReceptionistFolioHistoryResponse,
  ReceptionistFolioOrder,
  ReceptionistFolioResponse,
  ReceptionistFolioSummary,
} from './management-api';
import type { Language, ReceptionistCopy } from './i18n';

export interface ReceptionistFolioPanelProps {
  copy: ReceptionistCopy;
  language: Language;
  room: ReceptionistRoomPreview | null;
  activeFolio: ReceptionistFolioResponse | null;
  history: ReceptionistFolioHistoryResponse | null;
  historicalFolio: ReceptionistFolioResponse | null;
  activeState: 'idle' | 'loading' | 'ready' | 'error';
  historyState: 'idle' | 'loading' | 'ready' | 'error';
  historicalState: 'idle' | 'loading' | 'ready' | 'error';
  activeError: string;
  historyError: string;
  historicalError: string;
  folioTab: 'current' | 'history';
  onTabChange: (tab: 'current' | 'history') => void;
  onRetryActive: () => void;
  onRetryHistory: () => void;
  onRetryHistorical: () => void;
  onSelectHistory: (assignmentId: string) => void;
  onOpenRoomAccess: () => void;
  selectedHistoryAssignmentId: string | null;
}

type Status = ReceptionistFolioOrder['status'];

const UNIT_LABELS: Record<Language, Record<string, string>> = {
  uz: {
    RESTAURANT: 'Restoran',
    CAFE: 'Kafe',
    HOUSEKEEPING: 'Housekeeping',
    SPA: 'SPA',
    LOUNGE: 'Lounge',
    BEAUTY_AND_SALON: 'Beauty & Salon',
    BUTIK_INDONESIA: 'Butik Indonesia',
  },
  ru: {
    RESTAURANT: 'Ресторан',
    CAFE: 'Кафе',
    HOUSEKEEPING: 'Хаускипинг',
    SPA: 'SPA',
    LOUNGE: 'Лаунж',
    BEAUTY_AND_SALON: 'Красота и салон',
    BUTIK_INDONESIA: 'Butik Indonesia',
  },
  en: {
    RESTAURANT: 'Restaurant',
    CAFE: 'Cafe',
    HOUSEKEEPING: 'Housekeeping',
    SPA: 'SPA',
    LOUNGE: 'Lounge',
    BEAUTY_AND_SALON: 'Beauty & Salon',
    BUTIK_INDONESIA: 'Butik Indonesia',
  },
};

function localeFor(language: Language): string {
  return language === 'uz' ? 'uz-UZ' : language === 'ru' ? 'ru-RU' : 'en-GB';
}

function formatDate(value: string | null, language: Language): string {
  if (value === null) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(localeFor(language), {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatMoney(value: number, currency: string, language: Language): string {
  try {
    return new Intl.NumberFormat(localeFor(language), {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString(localeFor(language))} ${currency}`;
  }
}

function summaryTotal(summary: ReceptionistFolioSummary, language: Language): string {
  if (summary.totalsByCurrency.length === 0) return '—';
  return summary.totalsByCurrency
    .map((amount) => formatMoney(amount.amount, amount.currency, language))
    .join(' · ');
}

function orderTotalText(
  copy: ReceptionistCopy,
  language: Language,
  order: ReceptionistFolioOrder,
): string {
  const totals = new Map<string, number>();
  let hasUnavailablePrice = false;

  for (const item of order.items) {
    if (item.lineTotal === null || item.currency === null) {
      hasUnavailablePrice = true;
      continue;
    }
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.lineTotal);
  }

  const formattedTotals = [...totals.entries()].map(([currency, amount]) =>
    formatMoney(amount, currency, language),
  );
  if (hasUnavailablePrice) formattedTotals.push(copy.priceUnavailable);
  return formattedTotals.length > 0 ? formattedTotals.join(' · ') : copy.priceUnavailable;
}

function itemOptionText(
  item: ReceptionistFolioOrder['items'][number],
  language: Language,
): string[] {
  return (item.variantOptions ?? []).flatMap((option) => {
    if (option === null || typeof option !== 'object') return [];
    const candidate = option as {
      label?: { uz?: string; ru?: string; en?: string };
      value?: { uz?: string; ru?: string; en?: string };
    };
    const value = candidate.value?.[language] ?? candidate.value?.en ?? candidate.value?.uz;
    const label = candidate.label?.[language] ?? candidate.label?.en ?? candidate.label?.uz;
    if (typeof value !== 'string' || value.trim().length === 0) return [];
    return [typeof label === 'string' && label.trim().length > 0 ? `${label}: ${value}` : value];
  });
}

function StatusBadge({ copy, status }: { copy: ReceptionistCopy; status: Status }) {
  const label =
    status === 'NEW'
      ? copy.statusNew
      : status === 'IN_PROCESS'
        ? copy.statusInProcess
        : status === 'COMPLETED'
          ? copy.statusCompleted
          : copy.statusCancelled;
  return <span className={`receptionist-folio-status is-${status.toLowerCase()}`}>{label}</span>;
}

function SummaryStrip({
  copy,
  language,
  summary,
}: {
  copy: ReceptionistCopy;
  language: Language;
  summary: ReceptionistFolioSummary;
}) {
  return (
    <div className="receptionist-folio-summary" aria-label={copy.folioTotal}>
      <div className="receptionist-folio-summary__item">
        <span>{copy.orders}</span>
        <strong>{summary.orderCount}</strong>
        <small>
          {copy.openOrders}: {summary.openOrderCount}
        </small>
      </div>
      <div className="receptionist-folio-summary__item">
        <span>{copy.items}</span>
        <strong>{summary.itemCount}</strong>
        <small>{copy.totalItems(summary.itemCount)}</small>
      </div>
      <div className="receptionist-folio-summary__item receptionist-folio-summary__item--total">
        <span>{copy.folioTotal}</span>
        <strong>{summaryTotal(summary, language)}</strong>
        {!summary.isTotalComplete && <small className="is-warning">{copy.totalIncomplete}</small>}
      </div>
    </div>
  );
}

function OrderRow({
  copy,
  language,
  order,
}: {
  copy: ReceptionistCopy;
  language: Language;
  order: ReceptionistFolioOrder;
}) {
  const [expanded, setExpanded] = useState(false);
  const unitLabel = UNIT_LABELS[language][order.unit] ?? order.unit;
  return (
    <article
      className={`receptionist-folio-order ${order.status === 'CANCELLED' ? 'is-cancelled' : ''}`}
    >
      <button
        aria-expanded={expanded}
        className="receptionist-folio-order__header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="receptionist-folio-order__marker" aria-hidden="true">
          {expanded ? '−' : '+'}
        </span>
        <span className="receptionist-folio-order__main">
          <strong>{unitLabel}</strong>
          <small>
            {formatDate(order.requestedAt, language)} · {copy.totalItems(order.items.length)}
          </small>
        </span>
        <StatusBadge copy={copy} status={order.status} />
        <span className="receptionist-folio-order__amount">
          {orderTotalText(copy, language, order)}
        </span>
      </button>
      {expanded && (
        <div className="receptionist-folio-order__body">
          <div className="receptionist-folio-order__meta">
            <span>
              <b>{copy.orderId}</b> {order.id}
            </span>
            <span>
              <b>{copy.requestedAt}</b> {formatDate(order.requestedAt, language)}
            </span>
          </div>
          <div className="receptionist-folio-items">
            {order.items.map((item, index) => {
              const options = itemOptionText(item, language);
              return (
                <div
                  className="receptionist-folio-line"
                  key={`${order.id}-${item.menuItemId}-${index}`}
                >
                  <div className="receptionist-folio-line__copy">
                    <strong>{item.name}</strong>
                    <span>
                      {copy.quantity}: {item.quantity}
                      {item.sku ? ` · ${item.sku}` : ''}
                    </span>
                    {options.length > 0 && <small>{options.join(' · ')}</small>}
                    {item.note && <small>{item.note}</small>}
                  </div>
                  <strong className={item.lineTotal === null ? 'is-muted' : undefined}>
                    {item.lineTotal === null || item.currency === null
                      ? copy.priceUnavailable
                      : formatMoney(item.lineTotal, item.currency, language)}
                  </strong>
                </div>
              );
            })}
          </div>
          {order.guestNote && (
            <p className="receptionist-folio-order__note">
              <b>{copy.guestNote}</b> {order.guestNote}
            </p>
          )}
          {order.status === 'CANCELLED' && order.cancellationReason && (
            <p className="receptionist-folio-order__note">
              <b>{copy.statusCancelled}</b> {order.cancellationReason}
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function OrderGroups({
  copy,
  language,
  orders,
}: {
  copy: ReceptionistCopy;
  language: Language;
  orders: ReceptionistFolioOrder[];
}) {
  const groups = useMemo(() => {
    const result = new Map<string, ReceptionistFolioOrder[]>();
    for (const order of orders) {
      const list = result.get(order.unit) ?? [];
      list.push(order);
      result.set(order.unit, list);
    }
    return [...result.entries()];
  }, [orders]);

  return (
    <div className="receptionist-folio-groups">
      {groups.map(([unit, unitOrders]) => (
        <section className="receptionist-folio-group" key={unit}>
          <div className="receptionist-folio-group__heading">
            <h3>{UNIT_LABELS[language][unit] ?? unit}</h3>
            <span>{copy.totalOrders(unitOrders.length)}</span>
          </div>
          <div className="receptionist-folio-group__orders">
            {unitOrders.map((order) => (
              <OrderRow copy={copy} language={language} key={order.id} order={order} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ErrorState({
  copy,
  message,
  onRetry,
}: {
  copy: ReceptionistCopy;
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="receptionist-folio-state is-error" role="alert">
      <span className="receptionist-folio-state__mark">!</span>
      <div>
        <strong>{copy.folioError}</strong>
        <p>{message}</p>
      </div>
      <button className="admin-button admin-button--quiet" onClick={onRetry} type="button">
        {copy.retry}
      </button>
    </div>
  );
}

function LoadingState({ copy }: { copy: ReceptionistCopy }) {
  return (
    <div className="receptionist-folio-state" aria-live="polite">
      <span className="admin-loading-line admin-loading-line--wide" />
      <span className="admin-loading-line" />
      <p>{copy.loadingFolio}</p>
    </div>
  );
}

function CurrentStay({
  copy,
  language,
  room,
  folio,
  state,
  error,
  onRetry,
}: {
  copy: ReceptionistCopy;
  language: Language;
  room: ReceptionistRoomPreview | null;
  folio: ReceptionistFolioResponse | null;
  state: ReceptionistFolioPanelProps['activeState'];
  error: string;
  onRetry: () => void;
}) {
  if (room === null) {
    return (
      <div className="receptionist-folio-empty">
        <span>⌁</span>
        <h3>{copy.noRooms}</h3>
        <p>{copy.noRoomsDescription}</p>
      </div>
    );
  }
  if (room.status === 'VACANT' || room.assignmentId === null) {
    return (
      <div className="receptionist-folio-empty">
        <span>—</span>
        <h3>{copy.vacant}</h3>
        <p>{copy.roomAccessDescription}</p>
      </div>
    );
  }
  if (state === 'loading' && folio === null) return <LoadingState copy={copy} />;
  if (state === 'error' && folio === null)
    return <ErrorState copy={copy} message={error || copy.folioError} onRetry={onRetry} />;
  if (folio === null) return <LoadingState copy={copy} />;

  return (
    <div className="receptionist-folio-content" aria-busy={state === 'loading'}>
      <SummaryStrip copy={copy} language={language} summary={folio.summary} />
      {folio.summary.orderCount === 0 ? (
        <div className="receptionist-folio-empty receptionist-folio-empty--compact">
          <span>✦</span>
          <h3>{copy.noOrders}</h3>
          <p>{copy.noOrdersDescription}</p>
        </div>
      ) : (
        <OrderGroups copy={copy} language={language} orders={folio.orders} />
      )}
    </div>
  );
}

function HistoryStay({
  copy,
  language,
  folio,
}: {
  copy: ReceptionistCopy;
  language: Language;
  folio: ReceptionistFolioResponse | null;
}) {
  if (folio === null) return null;
  const assignment = folio.assignment;
  if (assignment === null) return null;
  return (
    <div className="receptionist-history-detail">
      <div className="receptionist-history-detail__header">
        <div>
          <span className="admin-eyebrow">{copy.guest}</span>
          <h3>{assignment.guestName}</h3>
        </div>
        <span className="receptionist-history-detail__dates">
          {formatDate(assignment.assignedAt, language)} —{' '}
          {formatDate(assignment.checkedOutAt, language)}
        </span>
      </div>
      <SummaryStrip copy={copy} language={language} summary={folio.summary} />
      {folio.orders.length === 0 ? (
        <div className="receptionist-folio-empty receptionist-folio-empty--compact">
          <span>—</span>
          <h3>{copy.noOrders}</h3>
          <p>{copy.noOrdersDescription}</p>
        </div>
      ) : (
        <OrderGroups copy={copy} language={language} orders={folio.orders} />
      )}
    </div>
  );
}

export function ReceptionistFolioPanel({
  copy,
  language,
  room,
  activeFolio,
  history,
  historicalFolio,
  activeState,
  historyState,
  historicalState,
  activeError,
  historyError,
  historicalError,
  folioTab,
  onTabChange,
  onRetryActive,
  onRetryHistory,
  onRetryHistorical,
  onSelectHistory,
  onOpenRoomAccess,
  selectedHistoryAssignmentId,
}: ReceptionistFolioPanelProps) {
  return (
    <section aria-labelledby="receptionist-folio-title" className="receptionist-folio-panel">
      <header className="receptionist-folio-panel__header">
        <div>
          <p className="admin-eyebrow">{copy.folio}</p>
          <h2 id="receptionist-folio-title">
            {room === null ? copy.room : `${copy.room} ${room.number}`}
          </h2>
          <p>
            {room?.guestName ?? copy.vacant} · {copy.folioSubtitle}
          </p>
        </div>
        {room !== null && (
          <button
            className="admin-button admin-button--quiet receptionist-folio-panel__access"
            onClick={onOpenRoomAccess}
            type="button"
          >
            {copy.openRoomAccess}
          </button>
        )}
      </header>

      <div className="receptionist-folio-tabs" role="tablist" aria-label={copy.folio}>
        <button
          aria-selected={folioTab === 'current'}
          className={folioTab === 'current' ? 'is-active' : ''}
          onClick={() => onTabChange('current')}
          role="tab"
          type="button"
        >
          {copy.currentStay}
        </button>
        <button
          aria-selected={folioTab === 'history'}
          className={folioTab === 'history' ? 'is-active' : ''}
          onClick={() => onTabChange('history')}
          role="tab"
          type="button"
        >
          {copy.pastStays}
        </button>
      </div>

      {folioTab === 'current' ? (
        <CurrentStay
          copy={copy}
          error={activeError}
          language={language}
          room={room}
          folio={activeFolio}
          state={activeState}
          onRetry={onRetryActive}
        />
      ) : (
        <div className="receptionist-folio-history">
          {historyState === 'loading' && history === null ? (
            <LoadingState copy={copy} />
          ) : historyState === 'error' && history === null ? (
            <ErrorState
              copy={copy}
              message={historyError || copy.folioError}
              onRetry={onRetryHistory}
            />
          ) : history === null || history.items.length === 0 ? (
            <div className="receptionist-folio-empty">
              <span>—</span>
              <h3>{copy.historyEmpty}</h3>
              <p>{copy.historyEmptyDescription}</p>
            </div>
          ) : (
            <div className="receptionist-folio-history__layout">
              <div className="receptionist-folio-history__list" aria-label={copy.pastStays}>
                {history.items.map((item) => (
                  <button
                    className={
                      (selectedHistoryAssignmentId ?? historicalFolio?.assignment?.id) ===
                      item.assignment.id
                        ? 'is-active'
                        : ''
                    }
                    key={item.assignment.id}
                    onClick={() => onSelectHistory(item.assignment.id)}
                    type="button"
                  >
                    <span>
                      <strong>{item.assignment.guestName}</strong>
                      <small>
                        {formatDate(item.assignment.assignedAt, language)} —{' '}
                        {formatDate(item.assignment.checkedOutAt, language)}
                      </small>
                    </span>
                    <b>{summaryTotal(item.summary, language)}</b>
                  </button>
                ))}
              </div>
              <div className="receptionist-folio-history__detail">
                {historicalState === 'loading' && historicalFolio === null ? (
                  <LoadingState copy={copy} />
                ) : historicalState === 'error' && historicalFolio === null ? (
                  <ErrorState
                    copy={copy}
                    message={historicalError || copy.folioError}
                    onRetry={onRetryHistorical}
                  />
                ) : historicalFolio === null ? (
                  <div className="receptionist-folio-empty receptionist-folio-empty--compact">
                    <span>⌁</span>
                    <h3>{copy.viewStay}</h3>
                    <p>{copy.historyEmptyDescription}</p>
                  </div>
                ) : (
                  <HistoryStay copy={copy} language={language} folio={historicalFolio} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
