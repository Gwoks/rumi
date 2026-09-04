import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { AuthRequest, User } from '../types/index.js';

export const JWT_SECRET = process.env.JWT_SECRET || 'rumi-super-secret-key-2025';

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  // Check cookie or Authorization header
  let token = req.cookies?.token;

  if (!token && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0] === 'Bearer') {
      token = parts[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: number; role: string; email: string };
    
    // Strict raw SQL query to fetch active user
    const user = db.prepare('SELECT id, email, role, name FROM users WHERE id = ?').get(decoded.id) as User | undefined;

    if (!user) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin privileges required' });
    return;
  }
  next();
}

export function requireParent(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'parent') {
    res.status(403).json({ error: 'Parent access required' });
    return;
  }
  next();
}

/**
 * Strict data isolation middleware: ensures that if a parent makes a request
 * concerning a child, the child explicitly belongs to the requesting parent.
 */
export function verifyChildAccess(childIdExtractor: (req: AuthRequest) => number | undefined) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Admins have global access
    if (req.user.role === 'admin') {
      next();
      return;
    }

    const childId = childIdExtractor(req);
    if (!childId) {
      res.status(400).json({ error: 'Child ID is required for verification' });
      return;
    }

    // Strict raw SQL query for parent data isolation
    const match = db.prepare('SELECT 1 FROM children WHERE id = ? AND parent_id = ?').get(childId, req.user.id);

    if (!match) {
      res.status(403).json({ error: 'Forbidden: You do not have access to this child profile' });
      return;
    }

    next();
  };
}
