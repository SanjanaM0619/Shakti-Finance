import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { connectDatabase, getDatabaseStatus } from '../database/connection.js';
import { seedSchemes } from '../database/seeds/seedSchemes.js';
import { seedDemoAccount } from '../database/seeds/seedDemo.js';
import authRoutes from './routes/authRoutes.js';
import financeRoutes from './routes/financeRoutes.js';
import intelligenceRoutes from './routes/intelligenceRoutes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

export const app = express();
app.use(cors());
app.use(express.json({ limit: '4mb' }));

const uploadDir = path.join(rootDir, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Shakti Finance MERN API',
    database: getDatabaseStatus(),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/intel', intelligenceRoutes);

// Serve built frontend in production if frontend/dist exists
const distDir = path.join(rootDir, 'frontend', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

export async function initApp() {
  await connectDatabase();
  await seedSchemes();
  await seedDemoAccount();
  return app;
}

const PORT = Number(process.env.PORT) || 4000;
if (process.env.NODE_ENV !== 'test') {
  initApp()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Shakti Finance MERN server running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to initialize Shakti Finance MERN server:', err);
      process.exit(1);
    });
}

export default app;
