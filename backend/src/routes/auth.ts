import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db/index.js';
import { authenticateToken, JWT_SECRET } from '../middleware/auth.js';
import { AuthRequest, User } from '../types/index.js';

const router = Router();

// POST /api/auth/login
router.post('/login', (req, res): void => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  // Strict parameterized raw SQL query
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim()) as (User & { password_hash: string }) | undefined;

  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const tokenPayload = { id: user.id, email: user.email, role: user.role, name: user.name };
  const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

  // Store in HTTP-only cookie
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    }
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req: AuthRequest, res: Response): void => {
  res.json({ user: req.user });
});

// POST /api/auth/logout
router.post('/logout', (req, res): void => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/register (helper for testing and parent signup)
router.post('/register', (req, res): void => {
  const { email, password, name, role = 'parent' } = req.body;

  if (!email || !password || !name) {
    res.status(400).json({ error: 'Email, password, and name are required' });
    return;
  }

  if (role !== 'admin' && role !== 'parent') {
    res.status(400).json({ error: 'Role must be either admin or parent' });
    return;
  }

  try {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase().trim());
    if (existing) {
      res.status(409).json({ error: 'Email already in use' });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, role, name)
      VALUES (?, ?, ?, ?)
    `).run(email.toLowerCase().trim(), hash, role, name.trim());

    const newUserId = Number(result.lastInsertRowid);
    const tokenPayload = { id: newUserId, email, role, name };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: newUserId, email, role, name }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
