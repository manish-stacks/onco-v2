import { useEffect, useRef, useState, useCallback } from 'react';
import { tokenStore } from '@/lib/api';

const BASE = import.meta.env.VITE_API_BASE || '';

/**
 * Backend ke SSE stream se live events.
 *
 * EventSource cannot send custom headers, so the token goes in a query param
 * — the backend verifies it at `/admin/events?token=`.
 *
 * We handle reconnection ourselves (EventSource's default reconnect creates an
 * infinite loop when the token expires), with backoff.
 */
export function useLiveEvents({ onEvent, enabled = true } = {}) {
  const [connected, setConnected] = useState(false);
  const sourceRef = useRef(null);
  const retryRef = useRef(0);
  const timerRef = useRef(null);
  const handlerRef = useRef(onEvent);

  handlerRef.current = onEvent;

  const connect = useCallback(() => {
    const token = tokenStore.get();
    if (!token || !enabled) return;

    // close the old connection
    if (sourceRef.current) {
      sourceRef.current.close();
      sourceRef.current = null;
    }

    const es = new EventSource(`${BASE}/api/admin/events?token=${encodeURIComponent(token)}`);
    sourceRef.current = es;

    es.addEventListener('connected', () => {
      setConnected(true);
      retryRef.current = 0;
    });

    // saare business events ek hi jagah handle
    ['order.created', 'order.paid', 'order.status', 'prescription.created', 'stock.out', 'stock.changed']
      .forEach((type) => {
        es.addEventListener(type, (e) => {
          try {
            handlerRef.current?.({ type, ...JSON.parse(e.data) });
          } catch { /* malformed payload — ignore */ }
        });
      });

    es.onerror = () => {
      setConnected(false);
      es.close();
      sourceRef.current = null;

      // backoff — 2s, 4s, 8s… max 30s
      retryRef.current += 1;
      const delay = Math.min(2000 * 2 ** (retryRef.current - 1), 30000);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(connect, delay);
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    connect();

    // reconnect immediately when the tab becomes visible again and the connection had dropped
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !sourceRef.current) {
        retryRef.current = 0;
        connect();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(timerRef.current);
      sourceRef.current?.close();
      sourceRef.current = null;
      setConnected(false);
    };
  }, [connect, enabled]);

  return { connected };
}
