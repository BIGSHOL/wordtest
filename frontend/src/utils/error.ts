import { AxiosError } from 'axios';

/**
 * Extract a user-friendly error message from an unknown error.
 * Handles Axios errors with `response.data.detail` (FastAPI convention).
 */
export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    return error.response?.data?.detail || fallback;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
