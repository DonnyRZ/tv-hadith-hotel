import { io, type Socket } from 'socket.io-client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import {
  isStaffRealtimeEvent,
  type StaffRealtimeEvent,
} from '@room-service/contracts/realtime-events';

import type { Language } from './i18n';

export type StaffRealtimeStatus = 'disabled' | 'connecting' | 'live' | 'reconnecting' | 'offline';

export type StaffRealtimeListener = (event: StaffRealtimeEvent) => void;

interface StaffRealtimeContextValue {
  status: StaffRealtimeStatus;
  lastConnectedAt: string | null;
  subscribe: (listener: StaffRealtimeListener) => () => void;
}

interface StaffRealtimeUser {
  id: string;
  roles: string[];
  permissions: string[];
}

const EMPTY_CONTEXT: StaffRealtimeContextValue = {
  status: 'disabled',
  lastConnectedAt: null,
  subscribe: () => () => undefined,
};

const StaffRealtimeContext = createContext<StaffRealtimeContextValue>(EMPTY_CONTEXT);

const STATUS_COPY: Record<
  Language,
  Record<StaffRealtimeStatus, { label: string; title: string }>
> = {
  uz: {
    disabled: { label: 'Sinxronlash', title: 'Jonli yangilanish hozircha o‘chirilgan' },
    connecting: { label: 'Ulanmoqda', title: 'Jonli yangilanishga ulanmoqda' },
    live: { label: 'Jonli', title: 'Dashboard jonli yangilanmoqda' },
    reconnecting: { label: 'Qayta ulanmoqda', title: 'Jonli ulanish qayta tiklanmoqda' },
    offline: {
      label: 'Avtomatik sinxronlash',
      title: 'Ulanish yo‘q, ma’lumot avtomatik sinxronlanadi',
    },
  },
  ru: {
    disabled: { label: 'Синхронизация', title: 'Живые обновления пока отключены' },
    connecting: { label: 'Подключение', title: 'Подключение к живым обновлениям' },
    live: { label: 'Онлайн', title: 'Панель обновляется в реальном времени' },
    reconnecting: { label: 'Повторное подключение', title: 'Восстановление живого соединения' },
    offline: {
      label: 'Автосинхронизация',
      title: 'Соединение потеряно, данные синхронизируются автоматически',
    },
  },
  en: {
    disabled: { label: 'Syncing', title: 'Live updates are disabled' },
    connecting: { label: 'Connecting', title: 'Connecting to live updates' },
    live: { label: 'Live', title: 'Dashboard is updating in real time' },
    reconnecting: { label: 'Reconnecting', title: 'Restoring the live connection' },
    offline: {
      label: 'Auto-syncing',
      title: 'Connection is unavailable; data will sync automatically',
    },
  },
};

function readBoolean(value: string | undefined): boolean {
  return value === '1' || value?.toLowerCase() === 'true' || value?.toLowerCase() === 'yes';
}

function realtimeClientEnabled(): boolean {
  const configured = import.meta.env.VITE_STAFF_REALTIME_ENABLED?.trim();
  return configured === undefined || configured.length === 0 || readBoolean(configured);
}

function realtimeUrl(): string {
  const configured = import.meta.env.VITE_STAFF_REALTIME_URL?.trim();
  if (configured === undefined || configured.length === 0) return '/staff-realtime';
  return `${configured.replace(/\/+$/u, '')}/staff-realtime`;
}

function rememberEvent(seen: Set<string>, eventId: string): boolean {
  if (seen.has(eventId)) return false;
  seen.add(eventId);
  if (seen.size > 600) {
    const oldest = seen.values().next().value;
    if (typeof oldest === 'string') seen.delete(oldest);
  }
  return true;
}

export function StaffRealtimeProvider({
  children,
  user,
}: PropsWithChildren<{ user: StaffRealtimeUser }>) {
  const listeners = useRef(new Set<StaffRealtimeListener>());
  const seenEvents = useRef(new Set<string>());
  const [status, setStatus] = useState<StaffRealtimeStatus>(
    realtimeClientEnabled() ? 'connecting' : 'disabled',
  );
  const [lastConnectedAt, setLastConnectedAt] = useState<string | null>(null);

  const subscribe = useCallback((listener: StaffRealtimeListener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  useEffect(() => {
    if (!realtimeClientEnabled()) {
      setStatus('disabled');
      return undefined;
    }

    let socket: Socket | null = null;
    const onOffline = () => setStatus('offline');
    const onOnline = () => {
      setStatus('reconnecting');
      socket?.connect();
    };

    socket = io(realtimeUrl(), {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
      timeout: 8_000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      path: '/socket.io',
    });

    const onConnect = () => {
      setStatus('live');
      setLastConnectedAt(new Date().toISOString());
    };
    const onDisconnect = () => {
      setStatus(navigator.onLine ? 'reconnecting' : 'offline');
    };
    const onConnectError = () => setStatus(navigator.onLine ? 'reconnecting' : 'offline');
    const onEvent = (eventName: string, payload: unknown) => {
      if (!isStaffRealtimeEvent(payload) || payload.eventType !== eventName) return;
      if (!rememberEvent(seenEvents.current, payload.eventId)) return;
      for (const listener of listeners.current) {
        try {
          listener(payload);
        } catch {
          // A dashboard listener must not interrupt delivery to other dashboards.
        }
      }
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.onAny(onEvent);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    setStatus('connecting');
    socket.connect();

    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('connect_error', onConnectError);
      socket?.offAny(onEvent);
      socket?.disconnect();
      socket = null;
      setStatus('disabled');
    };
  }, [user.id]);

  const value = useMemo(
    () => ({ status, lastConnectedAt, subscribe }),
    [lastConnectedAt, status, subscribe],
  );

  return <StaffRealtimeContext.Provider value={value}>{children}</StaffRealtimeContext.Provider>;
}

export function useStaffRealtime(): StaffRealtimeContextValue {
  return useContext(StaffRealtimeContext);
}

export function StaffRealtimeIndicator({ language }: { language: Language }) {
  const { status } = useStaffRealtime();
  const copy = STATUS_COPY[language][status];
  return (
    <span
      aria-label={copy.title}
      className={`staff-realtime-indicator is-${status}`}
      role="status"
      title={copy.title}
    >
      <span aria-hidden="true" className="staff-realtime-indicator__dot" />
      {copy.label}
    </span>
  );
}
