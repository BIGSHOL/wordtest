import { setupServer } from 'msw/node';
import { authHandlers } from './handlers/auth';
import { studentHandlers } from './handlers/student';
import { testHandlers } from './handlers/test';

export const server = setupServer(
  ...authHandlers,
  ...studentHandlers,
  ...testHandlers,
);
