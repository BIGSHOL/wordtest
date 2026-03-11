/**
 * Master-only error log query service.
 */
import api from './api';

export interface ErrorLogItem {
  id: string;
  level: string;
  source: string;
  message: string;
  detail: string | null;
  stack_trace: string | null;
  endpoint: string | null;
  method: string | null;
  status_code: number | null;
  user_id: string | null;
  username: string | null;
  user_agent: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ErrorLogListResponse {
  items: ErrorLogItem[];
  total: number;
  page: number;
  limit: number;
}

export interface ErrorLogFilters {
  level?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  status_code?: number;
  page?: number;
  limit?: number;
}

export const errorLogService = {
  list: (filters: ErrorLogFilters = {}) =>
    api
      .get<ErrorLogListResponse>('/api/v1/logs', { params: filters })
      .then((r) => r.data),

  cleanup: (days: number = 30) =>
    api
      .delete<{ deleted_count: number }>('/api/v1/logs/cleanup', {
        params: { days },
      })
      .then((r) => r.data),
};
