/**
 * Frontend error reporter - fire-and-forget to backend.
 * Uses separate axios instance to avoid auth interceptor infinite loops.
 */
import axios from 'axios';
import { useAuthStore } from '../stores/auth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ClientErrorPayload {
  level: 'error' | 'warning' | 'info';
  message: string;
  detail?: string;
  stack_trace?: string;
  endpoint?: string;
  user_id?: string;
  username?: string;
}

const errorApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 5000,
});

let lastReportedAt = 0;
const MIN_INTERVAL_MS = 1000;

export function reportClientError(payload: ClientErrorPayload): void {
  const now = Date.now();
  if (now - lastReportedAt < MIN_INTERVAL_MS) return;
  lastReportedAt = now;

  // Inject user info from auth store
  const user = useAuthStore.getState().user;
  const body = {
    level: payload.level,
    message: payload.message.slice(0, 500),
    detail: payload.detail?.slice(0, 5000),
    stack_trace: payload.stack_trace?.slice(0, 10000),
    endpoint: payload.endpoint || window.location.pathname,
    user_id: payload.user_id || user?.id || null,
    username: payload.username || user?.name || user?.username || null,
  };

  errorApi.post('/api/v1/logs/client-error', body).catch(() => {});
}
