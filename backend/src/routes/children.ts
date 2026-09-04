import { Router, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin, verifyChildAccess } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

// GET /api/children - List children accessible to current user
router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;

  if (user.role === 'admin') {
    // Admins see all children with parent details
    const allChildren = db.prepare(`
      SELECT c.*, u.name as parent_name, u.email as parent_email
      FROM children c
      JOIN users u ON c.parent_id = u.id
      ORDER BY c.name ASC
    `).all();
    res.json({ children: allChildren });
  } else {
    // Parents strictly see only their own children
    const parentChildren = db.prepare(`
      SELECT * FROM children
      WHERE parent_id = ?
      ORDER BY name ASC
    `).all(user.id);
    res.json({ children: parentChildren });
  }
});

// GET /api/children/:id - Retrieve specific child with RBAC check
router.get('/:id', authenticateToken, verifyChildAccess((req) => Number(req.params.id)), (req: AuthRequest, res: Response): void => {
  const child = db.prepare(`
    SELECT c.*, u.name as parent_name, u.email as parent_email
    FROM children c
    JOIN users u ON c.parent_id = u.id
    WHERE c.id = ?
  `).get(Number(req.params.id));

  if (!child) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  res.json({ child });
});

// POST /api/children - Admin creates a new child
router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { parent_id, name, date_of_birth, class_group } = req.body;

  if (!parent_id || !name || !date_of_birth || !class_group) {
    res.status(400).json({ error: 'parent_id, name, date_of_birth, and class_group are required' });
    return;
  }

  // Ensure parent exists and has 'parent' role
  const parent = db.prepare('SELECT id FROM users WHERE id = ? AND role = ?').get(parent_id, 'parent');
  if (!parent) {
    res.status(400).json({ error: 'Invalid parent_id: Parent user does not exist' });
    return;
  }

  const result = db.prepare(`
    INSERT INTO children (parent_id, name, date_of_birth, class_group)
    VALUES (?, ?, ?, ?)
  `).run(parent_id, name.trim(), date_of_birth, class_group);

  const newChild = db.prepare('SELECT * FROM children WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ child: newChild });
});

// PUT /api/children/:id - Admin updates a child
router.put('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const childId = Number(req.params.id);
  const { name, date_of_birth, class_group } = req.body;

  const result = db.prepare(`
    UPDATE children
    SET name = COALESCE(?, name),
        date_of_birth = COALESCE(?, date_of_birth),
        class_group = COALESCE(?, class_group)
    WHERE id = ?
  `).run(name?.trim() || null, date_of_birth || null, class_group || null, childId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  const updated = db.prepare('SELECT * FROM children WHERE id = ?').get(childId);
  res.json({ child: updated });
});

// DELETE /api/children/:id - Admin deletes a child
router.delete('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const childId = Number(req.params.id);
  const result = db.prepare('DELETE FROM children WHERE id = ?').run(childId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  res.json({ message: 'Child deleted successfully' });
});

export default router;
