import { Router, Request, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /api/classes - Public listing of upcoming weekend pop-up classes
router.get('/', (_req: Request, res: Response): void => {
  const classes = db.prepare('SELECT * FROM pop_up_classes ORDER BY id ASC').all();
  res.json({ classes });
});

// POST /api/classes - Admin adds a new class
router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { title, date_day, date_month, location, time, tag } = req.body;

  if (!title || !date_day || !date_month || !location || !time) {
    res.status(400).json({ error: 'title, date_day, date_month, location, and time are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO pop_up_classes (title, date_day, date_month, location, time, tag)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title.trim(), date_day, date_month, location.trim(), time.trim(), tag || null);

  const created = db.prepare('SELECT * FROM pop_up_classes WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ class: created });
});

export default router;
