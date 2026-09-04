import { Router, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AuthRequest } from '../types/index.js';

const router = Router();

const VALID_DOMAINS = ['practical_life', 'sensorial', 'language', 'math', 'islamic_studies'];

// GET /api/assessments - Fetch assessments filtered by child_id with parent data isolation
router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;
  const childIdParam = req.query.child_id ? Number(req.query.child_id) : undefined;

  if (childIdParam) {
    if (user.role === 'parent') {
      // Strict data isolation check: ensure this child belongs to requesting parent
      const owned = db.prepare('SELECT 1 FROM children WHERE id = ? AND parent_id = ?').get(childIdParam, user.id);
      if (!owned) {
        res.status(403).json({ error: 'Access denied: Child does not belong to this parent account' });
        return;
      }
    }

    const assessments = db.prepare(`
      SELECT * FROM assessments
      WHERE child_id = ?
      ORDER BY date DESC, id DESC
    `).all(childIdParam);

    res.json({ assessments });
  } else {
    // If no specific child_id provided
    if (user.role === 'admin') {
      const allAssessments = db.prepare(`
        SELECT a.*, c.name as child_name, c.class_group
        FROM assessments a
        JOIN children c ON a.child_id = c.id
        ORDER BY a.date DESC, a.id DESC
      `).all();
      res.json({ assessments: allAssessments });
    } else {
      // For parent without child_id, return assessments for ALL of their children only
      const parentAssessments = db.prepare(`
        SELECT a.*, c.name as child_name
        FROM assessments a
        JOIN children c ON a.child_id = c.id
        WHERE c.parent_id = ?
        ORDER BY a.date DESC, a.id DESC
      `).all(user.id);
      res.json({ assessments: parentAssessments });
    }
  }
});

// POST /api/assessments - Admin creates a weekly assessment
router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { child_id, date, domain, score, notes } = req.body;

  if (!child_id || !domain || score === undefined) {
    res.status(400).json({ error: 'child_id, domain, and score are required' });
    return;
  }

  if (!VALID_DOMAINS.includes(domain)) {
    res.status(400).json({ error: `Invalid domain. Must be one of: ${VALID_DOMAINS.join(', ')}` });
    return;
  }

  const numericScore = Number(score);
  if (isNaN(numericScore) || numericScore < 1 || numericScore > 10) {
    res.status(400).json({ error: 'Score must be an integer between 1 and 10' });
    return;
  }

  // Ensure child exists
  const child = db.prepare('SELECT id FROM children WHERE id = ?').get(child_id);
  if (!child) {
    res.status(404).json({ error: 'Child not found' });
    return;
  }

  const assessmentDate = date || new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO assessments (child_id, date, domain, score, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(child_id, assessmentDate, domain, numericScore, notes?.trim() || null);

  const newAssessment = db.prepare('SELECT * FROM assessments WHERE id = ?').get(Number(result.lastInsertRowid));
  res.status(201).json({ assessment: newAssessment });
});

// DELETE /api/assessments/:id - Admin deletes an assessment
router.delete('/:id', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM assessments WHERE id = ?').run(id);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Assessment not found' });
    return;
  }

  res.json({ message: 'Assessment deleted successfully' });
});

export default router;
