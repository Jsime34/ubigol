import 'dotenv/config';
import http from 'http';
import express, { Request, Response } from 'express';
import { requireAuth, ADMIN_EMAILS } from './middleware';
import gamesRouter from './routes/games';
import complexesRouter from './routes/complexes';
import notificationsRouter from './routes/notifications';
import adminRouter from './routes/admin';
import attendanceRouter from './routes/attendance';
import chatRouter from './routes/chat';
import { setupSocket } from './socket';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

setupSocket(server);

app.use(express.json());

// Health check
app.get('/', (_req: Request, res: Response) => {
  res.send('Ubigol Backend API - Online');
});

// Get current user
app.get('/me', requireAuth, (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({ email: user.email, name: `${user.given_name} ${user.family_name}`, isAdmin: ADMIN_EMAILS.includes(user.email) });
});

// Route modules
app.use('/games', gamesRouter);
app.use('/complexes', complexesRouter);
app.use('/notifications', notificationsRouter);
app.use('/admin', adminRouter);
app.use('/attendance', attendanceRouter);
app.use('/chat', chatRouter);

server.listen(PORT, () => {
  console.log(`Servidor de Ubigol corriendo en http://localhost:${PORT}`);
});
