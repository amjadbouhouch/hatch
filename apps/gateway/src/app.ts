import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/error-handler.js';
import { resolveAuth, printAuthInfo, type ResolvedAuth } from './auth/resolve.js';
import { healthRoutes } from './routes/health.js';
import { threadRoutes } from './routes/threads.js';
import { messageRoutes } from './routes/messages.js';
import { controlRoutes } from './routes/control.js';
import { eventRoutes } from './routes/events.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { skillRoutes } from './routes/skills.js';
import { scheduleRoutes } from './routes/schedules.js';
import { knowledgeRoutes } from './routes/knowledge.js';

// Resolve auth once at module load
const auth = resolveAuth();

const app = new Hono()
  .use('*', corsMiddleware)
  .use('*', createAuthMiddleware(auth))
  .onError(errorHandler)
  .route('/', healthRoutes)
  .route('/', threadRoutes)
  .route('/', messageRoutes)
  .route('/', controlRoutes)
  .route('/', eventRoutes)
  .route('/', workspaceRoutes)
  .route('/', skillRoutes)
  .route('/', scheduleRoutes)
  .route('/', knowledgeRoutes);

export type AppType = typeof app;

export { app, auth };
