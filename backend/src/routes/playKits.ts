import { Router, Request, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /api/play-kits - Public listing of play kits
router.get('/', (_req: Request, res: Response): void => {
  const kits = db.prepare('SELECT * FROM play_kits ORDER BY id ASC').all();
  res.json({ play_kits: kits });
});

// GET /api/play-kits/:id - Public view of individual kit
router.get('/:id', (req: Request, res: Response): void => {
  const kit = db.prepare('SELECT * FROM play_kits WHERE id = ?').get(Number(req.params.id));
  if (!kit) {
    res.status(404).json({ error: 'Play kit not found' });
    return;
  }
  res.json({ play_kit: kit });
});

// POST /api/play-kits - Admin creates a play kit
router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { title, description, price, stock = 0, image_url, category = 'General', color = '#E7F4F0', icon = '✦' } = req.body;

  if (!title || price === undefined) {
    res.status(400).json({ error: 'title and price are required' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO play_kits (title, description, price, stock, image_url, category, color, icon)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(title.trim(), description || null, Number(price), Number(stock), image_url || null, category, color, icon);

  const newKit = db.prepare('SELECT * FROM play_kits WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ play_kit: newKit });
});

// PATCH /api/play-kits/:id/stock - Admin updates stock level
router.patch('/:id/stock', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const kitId = Number(req.params.id);
  const { stock } = req.body;

  if (stock === undefined || isNaN(Number(stock))) {
    res.status(400).json({ error: 'Valid stock number is required' });
    return;
  }

  const result = db.prepare('UPDATE play_kits SET stock = ? WHERE id = ?').run(Number(stock), kitId);
  if (result.changes === 0) {
    res.status(404).json({ error: 'Play kit not found' });
    return;
  }

  const updatedKit = db.prepare('SELECT * FROM play_kits WHERE id = ?').get(kitId);
  res.json({ play_kit: updatedKit });
});

// DELETE /api/play-kits/:id - Admin deletes a kit
router.delete('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const kitId = Number(req.params.id);
  const result = db.prepare('DELETE FROM play_kits WHERE id = ?').run(kitId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Play kit not found' });
    return;
  }

  res.json({ message: 'Play kit deleted successfully' });
});

export default router;
