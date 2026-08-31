import { createPortal } from 'react-dom';
import { useCallback, useEffect, useState } from 'react';

import type { FormEvent } from 'react';
import QRCode from 'qrcode';

import {
  managementApi,
  StaffApiError,
  type GuestQrRoomStatus,
  type IssuedGuestQr,
  type ManagedTvDevice,
} from './management-api';
import type { ReceptionistCopy } from './i18n';

interface RoomReference {
  id: string;
  number: string;
}

interface RoomOperationsProps {
  canManageQr: boolean;
  canPairTv: boolean;
  copy: ReceptionistCopy;
  room: RoomReference;
}

type TvAction = 'pair' | 'reset' | 'revoke' | null;
type QrAction = 'issue' | 'revoke' | null;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function operationError(error: unknown, copy: ReceptionistCopy): string {
  if (error instanceof StaffApiError) {
    if (error.status === 401 || error.code === 'UNAUTHORIZED') return copy.sessionExpired;
    if (error.code === 'TV_ROOM_ALREADY_PAIRED') return copy.tvRoomAlreadyPaired;
    if (error.code === 'PAIRING_CODE_EXPIRED') return copy.tvPairingExpired;
    if (error.code === 'ROOM_NUMBER_MISMATCH') return copy.apiError;
  }
  return copy.apiError;
}

function tvStatusLabel(status: ManagedTvDevice['status'], copy: ReceptionistCopy): string {
  switch (status) {
    case 'PENDING':
      return copy.tvStatusPending;
    case 'PAIRED':
      return copy.tvStatusPaired;
    case 'CLAIMED':
      return copy.tvStatusClaimed;
    case 'REVOKED':
      return copy.tvStatusRevoked;
  }
}

function activeTvDevice(items: ManagedTvDevice[]): ManagedTvDevice | null {
  return (
    items.find((item) => item.status === 'CLAIMED') ??
    items.find((item) => item.status === 'PAIRED') ??
    items.find((item) => item.status === 'PENDING') ??
    items[0] ??
    null
  );
}

export function QrCodeImage({
  alt,
  className,
  value,
  width = 220,
}: {
  alt: string;
  className?: string;
  value: string;
  width?: number;
}) {
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSource(null);
    void QRCode.toDataURL(value, {
      color: { dark: '#18222d', light: '#ffffff' },
      errorCorrectionLevel: 'M',
      margin: 1,
      width,
    })
      .then((nextSource) => {
        if (active) setSource(nextSource);
      })
      .catch(() => {
        if (active) setSource(null);
      });
    return () => {
      active = false;
    };
  }, [value, width]);

  if (source === null) {
    return <span aria-label={alt} className={`receptionist-qr-placeholder ${className ?? ''}`} />;
  }

  return <img alt={alt} className={className} src={source} />;
}

function startPrint(): void {
  document.body.classList.add('receptionist-printing');
  const cleanup = () => document.body.classList.remove('receptionist-printing');
  window.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => window.print(), 50);
}

export function RoomOperations({ canManageQr, canPairTv, copy, room }: RoomOperationsProps) {
  const [tvDevice, setTvDevice] = useState<ManagedTvDevice | null>(null);
  const [qrStatus, setQrStatus] = useState<GuestQrRoomStatus | null>(null);
  const [issuedQr, setIssuedQr] = useState<IssuedGuestQr | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [actionError, setActionError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [tvAction, setTvAction] = useState<TvAction>(null);
  const [qrAction, setQrAction] = useState<QrAction>(null);

  const loadTv = useCallback(async () => {
    if (!canPairTv) return;
    const response = await managementApi.listTvDevices({ roomId: room.id, page: 1, pageSize: 100 });
    setTvDevice(activeTvDevice(response.items));
  }, [canPairTv, room.id]);

  const loadData = useCallback(async () => {
    setLoadState('loading');
    setActionError('');
    try {
      const [tvResponse, nextQrStatus] = await Promise.all([
        canPairTv
          ? managementApi.listTvDevices({ roomId: room.id, page: 1, pageSize: 100 })
          : Promise.resolve(null),
        canManageQr ? managementApi.getGuestQrStatus(room.id) : Promise.resolve(null),
      ]);
      setTvDevice(tvResponse === null ? null : activeTvDevice(tvResponse.items));
      setQrStatus(nextQrStatus);
      setLoadState('ready');
    } catch (error) {
      setLoadState('error');
      setActionError(operationError(error, copy));
    }
  }, [canManageQr, canPairTv, copy, room.id]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function pollUntilTvClaims(): Promise<void> {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await wait(2500);
      const response = await managementApi.listTvDevices({
        roomId: room.id,
        page: 1,
        pageSize: 100,
      });
      const nextDevice = activeTvDevice(response.items);
      setTvDevice(nextDevice);
      if (nextDevice?.status === 'CLAIMED') return;
    }
  }

  async function handlePair(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = pairingCode.replace(/\D/g, '').slice(0, 6);
    if (normalizedCode.length !== 6) {
      setActionError(copy.tvPairingCodeInvalid);
      return;
    }
    setTvAction('pair');
    setActionError('');
    setFeedback('');
    try {
      await managementApi.pairTvDevice(normalizedCode, room.id, room.number);
      setPairingCode('');
      await loadTv();
      await pollUntilTvClaims();
      setFeedback(copy.tvPairSuccess);
    } catch (error) {
      setActionError(operationError(error, copy));
    } finally {
      setTvAction(null);
    }
  }

  async function handleReset() {
    if (tvDevice === null || !window.confirm(copy.tvResetConfirm)) return;
    setTvAction('reset');
    setActionError('');
    setFeedback('');
    try {
      await managementApi.resetTvDevice(tvDevice.id);
      setTvDevice(null);
      setFeedback(copy.tvResetSuccess);
    } catch (error) {
      setActionError(operationError(error, copy));
    } finally {
      setTvAction(null);
    }
  }

  async function handleRevoke() {
    if (tvDevice === null || !window.confirm(copy.tvRevokeConfirm)) return;
    setTvAction('revoke');
    setActionError('');
    setFeedback('');
    try {
      await managementApi.revokeTvDevice(tvDevice.id);
      setTvDevice(null);
      setFeedback(copy.tvRevokeSuccess);
    } catch (error) {
      setActionError(operationError(error, copy));
    } finally {
      setTvAction(null);
    }
  }

  async function handleIssueQr() {
    if (qrStatus?.active && !window.confirm(copy.qrReissueConfirm)) return;
    setQrAction('issue');
    setActionError('');
    setFeedback('');
    try {
      const issued = await managementApi.issueGuestQr(room.id);
      setIssuedQr(issued);
      setQrStatus({ room: issued.room, active: true, issuedAt: issued.issuedAt, revokedAt: null });
      setFeedback(copy.qrIssueSuccess);
    } catch (error) {
      setActionError(operationError(error, copy));
    } finally {
      setQrAction(null);
    }
  }

  async function handleRevokeQr() {
    if (!window.confirm(copy.qrRevokeConfirm)) return;
    setQrAction('revoke');
    setActionError('');
    setFeedback('');
    try {
      await managementApi.revokeGuestQr(room.id);
      setQrStatus((current) =>
        current === null
          ? null
          : { ...current, active: false, revokedAt: new Date().toISOString() },
      );
      setIssuedQr(null);
      setFeedback(copy.qrRevokeSuccess);
    } catch (error) {
      setActionError(operationError(error, copy));
    } finally {
      setQrAction(null);
    }
  }

  if (!canManageQr && !canPairTv) return null;

  const isBusy = tvAction !== null || qrAction !== null;
  const tvIsActive = tvDevice?.status === 'PAIRED' || tvDevice?.status === 'CLAIMED';

  return (
    <section className="receptionist-room-operations" aria-label={copy.tvSection}>
      {canPairTv && (
        <section className="receptionist-operation-card">
          <div className="receptionist-operation-card__heading">
            <div>
              <p className="admin-eyebrow">{copy.tvSection}</p>
              <h3>{copy.tvStatus}</h3>
            </div>
            {tvDevice !== null && (
              <span className={`receptionist-operation-status is-${tvDevice.status.toLowerCase()}`}>
                {tvStatusLabel(tvDevice.status, copy)}
              </span>
            )}
          </div>
          <p className="receptionist-operation-card__description">{copy.tvDescription}</p>

          {loadState === 'loading' ? (
            <p className="admin-field-hint">{copy.loading}</p>
          ) : tvIsActive && tvDevice !== null ? (
            <>
              <dl className="receptionist-operation-meta">
                <div>
                  <dt>{copy.tvDeviceModel}</dt>
                  <dd>{tvDevice.deviceModel}</dd>
                </div>
                <div>
                  <dt>{copy.tvAppVersion}</dt>
                  <dd>{tvDevice.appVersion}</dd>
                </div>
              </dl>
              {tvDevice.status === 'PAIRED' && (
                <p className="admin-field-hint">{copy.tvWaitingForTv}</p>
              )}
              <div className="admin-form-actions receptionist-operation-actions">
                <button
                  className="admin-button admin-button--quiet"
                  disabled={isBusy}
                  onClick={() => void handleReset()}
                  type="button"
                >
                  {tvAction === 'reset' ? copy.tvPairing : copy.tvReset}
                </button>
                <button
                  className="admin-button admin-button--danger-quiet"
                  disabled={isBusy}
                  onClick={() => void handleRevoke()}
                  type="button"
                >
                  {tvAction === 'revoke' ? copy.revokingQr : copy.tvRevoke}
                </button>
              </div>
            </>
          ) : (
            <form className="receptionist-pair-form" onSubmit={(event) => void handlePair(event)}>
              <label className="admin-field">
                <span>{copy.tvPairingCode}</span>
                <input
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  maxLength={6}
                  onChange={(event) => {
                    setPairingCode(event.target.value.replace(/\D/g, '').slice(0, 6));
                    if (actionError.length > 0) setActionError('');
                  }}
                  placeholder={copy.tvPairingCodePlaceholder}
                  value={pairingCode}
                />
              </label>
              <button
                className="admin-button admin-button--primary"
                disabled={isBusy}
                type="submit"
              >
                {tvAction === 'pair' ? copy.tvPairing : copy.tvPair}
              </button>
            </form>
          )}
        </section>
      )}

      {canManageQr && (
        <section className="receptionist-operation-card">
          <div className="receptionist-operation-card__heading">
            <div>
              <p className="admin-eyebrow">{copy.qrSection}</p>
              <h3>{qrStatus?.active === true ? copy.qrActive : copy.qrNotIssued}</h3>
            </div>
          </div>
          <p className="receptionist-operation-card__description">{copy.qrDescription}</p>
          {issuedQr !== null && (
            <div className="receptionist-room-qr-preview">
              <QrCodeImage alt={copy.qrCodeAlt(room.number)} value={issuedQr.qrUrl} />
              <div>
                <p className="admin-field-hint">{copy.qrIssueSuccess}</p>
                <button
                  className="admin-button admin-button--quiet"
                  disabled={isBusy}
                  onClick={startPrint}
                  type="button"
                >
                  {copy.printQr}
                </button>
              </div>
            </div>
          )}
          <div className="admin-form-actions receptionist-operation-actions">
            <button
              className="admin-button admin-button--primary"
              disabled={isBusy || loadState === 'loading'}
              onClick={() => void handleIssueQr()}
              type="button"
            >
              {qrAction === 'issue'
                ? copy.issuingQr
                : qrStatus?.active === true
                  ? copy.reissueQr
                  : copy.issueQr}
            </button>
            {qrStatus?.active === true && (
              <button
                className="admin-button admin-button--danger-quiet"
                disabled={isBusy}
                onClick={() => void handleRevokeQr()}
                type="button"
              >
                {qrAction === 'revoke' ? copy.revokingQr : copy.revokeQr}
              </button>
            )}
          </div>
        </section>
      )}

      {(actionError.length > 0 || feedback.length > 0) && (
        <p
          className={actionError.length > 0 ? 'admin-form-error' : 'admin-field-hint'}
          role="status"
        >
          {actionError || feedback}
        </p>
      )}

      {issuedQr !== null &&
        createPortal(
          <div className="receptionist-print-sheet">
            <p className="admin-eyebrow">{copy.qrSection}</p>
            <h1>{room.number}</h1>
            <QrCodeImage alt={copy.qrCodeAlt(room.number)} value={issuedQr.qrUrl} width={480} />
            <p>{copy.qrDescription}</p>
          </div>,
          document.body,
        )}
    </section>
  );
}

export function BulkQrSheet({
  copy,
  items,
  onClose,
}: {
  copy: ReceptionistCopy;
  items: IssuedGuestQr[];
  onClose: () => void;
}) {
  const sortedItems = [...items].sort(
    (left, right) => Number(left.room.number) - Number(right.room.number),
  );

  return createPortal(
    <>
      <div className="admin-overlay receptionist-bulk-overlay">
        <section aria-labelledby="receptionist-bulk-qr-title" className="receptionist-bulk-dialog">
          <header className="receptionist-bulk-dialog__header">
            <div>
              <p className="admin-eyebrow">{copy.qrSection}</p>
              <h2 id="receptionist-bulk-qr-title">{copy.qrSheet}</h2>
              <p>{copy.qrSheetDescription}</p>
            </div>
            <div className="admin-form-actions receptionist-bulk-dialog__actions">
              <button
                className="admin-button admin-button--quiet"
                onClick={startPrint}
                type="button"
              >
                {copy.qrSheetPrint}
              </button>
              <button className="admin-button admin-button--quiet" onClick={onClose} type="button">
                {copy.qrSheetClose}
              </button>
            </div>
          </header>
          <div className="receptionist-bulk-qr-grid">
            {sortedItems.map((item) => (
              <article className="receptionist-bulk-qr-card" key={item.room.id}>
                <QrCodeImage
                  alt={copy.qrCodeAlt(item.room.number)}
                  value={item.qrUrl}
                  width={150}
                />
                <strong>{item.room.number}</strong>
              </article>
            ))}
          </div>
        </section>
      </div>
      <section className="receptionist-print-sheet receptionist-bulk-print-sheet">
        <header>
          <p className="admin-eyebrow">{copy.qrSection}</p>
          <h1>{copy.qrSheet}</h1>
        </header>
        <div className="receptionist-bulk-qr-grid">
          {sortedItems.map((item) => (
            <article className="receptionist-bulk-qr-card" key={`print-${item.room.id}`}>
              <QrCodeImage alt={copy.qrCodeAlt(item.room.number)} value={item.qrUrl} width={210} />
              <strong>{item.room.number}</strong>
            </article>
          ))}
        </div>
      </section>
    </>,
    document.body,
  );
}
