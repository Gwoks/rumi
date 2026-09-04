import { Router, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /api/photos - Fetch photos filtered by child_id with parent data isolation
router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;
  const childIdParam = req.query.child_id ? Number(req.query.child_id) : undefined;

  if (childIdParam) {
    if (user.role === 'parent') {
      const owned = db.prepare('SELECT 1 FROM children WHERE id = ? AND parent_id = ?').get(childIdParam, user.id);
      if (!owned) {
        res.status(403).json({ error: 'Access denied: Photos belong to another student' });
        return;
      }
    }

    const photos = db.prepare(`
      SELECT * FROM photos
      WHERE child_id = ?
      ORDER BY uploaded_at DESC, id DESC
    `).all(childIdParam);

    res.json({ photos });
  } else {
    if (user.role === 'admin') {
      const allPhotos = db.prepare(`
        SELECT p.*, c.name as child_name
        FROM photos p
        JOIN children c ON p.child_id = c.id
        ORDER BY p.uploaded_at DESC, p.id DESC
      `).all();
      res.json({ photos: allPhotos });
    } else {
      const parentPhotos = db.prepare(`
        SELECT p.*, c.name as child_name
        FROM photos p
        JOIN children c ON p.child_id = c.id
        WHERE c.parent_id = ?
        ORDER BY p.uploaded_at DESC, p.id DESC
      `).all(user.id);
      res.json({ photos: parentPhotos });
    }
  }
});

// POST /api/photos - Admin batch uploads photos tagged with one or multiple children
router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { child_ids, photo_url, photo_urls, caption } = req.body;

  const targets: number[] = Array.isArray(child_ids) ? child_ids : child_ids ? [Number(child_ids)] : [];
  const urls: string[] = Array.isArray(photo_urls) ? photo_urls : photo_url ? [photo_url] : [];

  if (targets.length === 0 || urls.length === 0) {
    res.status(400).json({ error: 'At least one child_id and photo_url are required' });
    return;
  }

  const insertPhoto = db.prepare(`
    INSERT INTO photos (child_id, photo_url, caption)
    VALUES (?, ?, ?)
  `);

  const createdIds: number[] = [];

  const batchTransaction = db.transaction(() => {
    for (const cid of targets) {
      for (const url of urls) {
        const result = insertPhoto.run(cid, url, caption?.trim() || null);
        createdIds.push(Number(result.lastInsertRowid));
      }
    }
  });

  batchTransaction();

  const createdPhotos = db.prepare(`
    SELECT * FROM photos WHERE id IN (${createdIds.map(() => '?').join(',')})
  `).all(...createdIds);

  res.status(201).json({ photos: createdPhotos, count: createdIds.length });
});

// DELETE /api/photos/:id - Admin deletes a photo
router.delete('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM photos WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Photo not found' });
    return;
  }

  res.json({ message: 'Photo deleted successfully' });
});

export default router;
