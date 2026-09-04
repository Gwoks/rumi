import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import authRouter from './routes/auth.js';
import childrenRouter from './routes/children.js';
import assessmentsRouter from './routes/assessments.js';
import photosRouter from './routes/photos.js';
import playKitsRouter from './routes/playKits.js';
import ordersRouter from './routes/orders.js';
import classesRouter from './routes/classes.js';
import metricsRouter from './routes/metrics.js';
import { initializeDatabase } from './db/init.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize SQLite tables on startup
initializeDatabase();

// Middleware
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, tests)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(null, true); // Permissive in local dev
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Mount API routes
app.use('/api/auth', authRouter);
app.use('/api/children', childrenRouter);
app.use('/api/assessments', assessmentsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/play-kits', playKitsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/classes', classesRouter);
app.use('/api/admin/metrics', metricsRouter);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'rumi-backend', timestamp: new Date().toISOString() });
});

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 RUMI API server running on http://localhost:${PORT}`);
  });
}

export default app;
