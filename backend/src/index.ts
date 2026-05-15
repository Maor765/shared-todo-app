import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { createServer } from 'http';
import { query } from './db.js';
import { initSocket } from './sockets/socket.handler.js';
import { initNotificationsService } from './services/notifications.service.js';
import { authMiddleware, optionalAuth } from './middleware/auth.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import listsRoutes from './routes/lists.routes.js';
import sublistsRoutes from './routes/sublists.routes.js';
import tasksRoutes from './routes/tasks.routes.js';
import membersRoutes from './routes/members.routes.js';
import { initListsIO } from './controllers/lists.controller.js';
import { initTasksIO } from './controllers/tasks.controller.js';
import { initSublistsIO } from './controllers/sublists.controller.js';
import notificationsRoutes from './routes/notifications.routes.js';

const app = express();
const server = createServer(app);
const port = parseInt(process.env.PORT || '4000', 10);

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:4001' }));
app.use(express.json());

const io = initSocket(server);
initNotificationsService(io);
initListsIO(io);
initTasksIO(io);
initSublistsIO(io);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api', authMiddleware);
app.use('/api/workspace', workspaceRoutes);
app.use('/api/lists', listsRoutes);
app.use('/api/lists', sublistsRoutes);
app.use('/api/lists', tasksRoutes);
app.use('/api/workspace/members', membersRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(errorHandler);

async function main() {
  try {
    await query('SELECT 1');
    console.log('Database connected');

    server.listen(port, () => {
      console.log(`Server running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
