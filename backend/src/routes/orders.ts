import { Router, Response } from 'express';
import db from '../db/index.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';
import { AuthRequest, Order, OrderItem } from '../types/index.js';

const router = Router();

// GET /api/orders - Get orders (parent isolated vs admin global)
router.get('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;

  let orders: any[];
  if (user.role === 'admin') {
    orders = db.prepare(`
      SELECT o.*, u.name as parent_name, u.email as parent_email
      FROM orders o
      JOIN users u ON o.parent_id = u.id
      ORDER BY o.created_at DESC, o.id DESC
    `).all();
  } else {
    orders = db.prepare(`
      SELECT o.*, u.name as parent_name
      FROM orders o
      JOIN users u ON o.parent_id = u.id
      WHERE o.parent_id = ?
      ORDER BY o.created_at DESC, o.id DESC
    `).all(user.id);
  }

  // Hydrate items for each order using parameterized raw SQL
  const itemStmt = db.prepare(`
    SELECT oi.*, pk.title as kit_title, pk.color as kit_color, pk.icon as kit_icon
    FROM order_items oi
    LEFT JOIN play_kits pk ON oi.kit_id = pk.id
    WHERE oi.order_id = ?
  `);

  const hydratedOrders = orders.map(ord => ({
    ...ord,
    items: itemStmt.all(ord.id)
  }));

  res.json({ orders: hydratedOrders });
});

// POST /api/orders - Place a new order (parent cart checkout)
router.post('/', authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;
  const { items, total_amount, payment_status = 'paid' } = req.body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Order must contain at least one item' });
    return;
  }

  const numericTotal = Number(total_amount);
  if (isNaN(numericTotal) || numericTotal < 0) {
    res.status(400).json({ error: 'Valid total_amount is required' });
    return;
  }

  const insertOrderStmt = db.prepare(`
    INSERT INTO orders (parent_id, total_amount, payment_status, shipping_status)
    VALUES (?, ?, ?, 'New')
  `);

  const insertItemStmt = db.prepare(`
    INSERT INTO order_items (order_id, kit_id, quantity, price)
    VALUES (?, ?, ?, ?)
  `);

  const updateStockStmt = db.prepare(`
    UPDATE play_kits
    SET stock = MAX(0, stock - ?)
    WHERE id = ?
  `);

  const kitPriceStmt = db.prepare('SELECT price, stock, title FROM play_kits WHERE id = ?');

  let orderId: number = 0;

  // Execute in raw SQL transaction
  const executeOrder = db.transaction(() => {
    const orderResult = insertOrderStmt.run(user.id, numericTotal, payment_status);
    orderId = Number(orderResult.lastInsertRowid);

    for (const item of items) {
      const kit = kitPriceStmt.get(item.kit_id) as { price: number; stock: number; title: string } | undefined;
      const price = item.price !== undefined ? Number(item.price) : (kit?.price || 0);
      const qty = Number(item.quantity) || 1;

      insertItemStmt.run(orderId, item.kit_id, qty, price);
      updateStockStmt.run(qty, item.kit_id);
    }
  });

  try {
    executeOrder();

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare(`
      SELECT oi.*, pk.title as kit_title
      FROM order_items oi
      LEFT JOIN play_kits pk ON oi.kit_id = pk.id
      WHERE oi.order_id = ?
    `).all(orderId);

    res.status(201).json({
      order: {
        ...(createdOrder as Record<string, any>),
        items: orderItems
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to process order: ' + err.message });
  }
});

// PATCH /api/orders/:id/status - Admin updates order shipping or payment status
router.patch('/:id/status', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const orderId = Number(req.params.id);
  const { shipping_status, payment_status } = req.body;

  if (!shipping_status && !payment_status) {
    res.status(400).json({ error: 'shipping_status or payment_status required' });
    return;
  }

  const result = db.prepare(`
    UPDATE orders
    SET shipping_status = COALESCE(?, shipping_status),
        payment_status = COALESCE(?, payment_status)
    WHERE id = ?
  `).run(shipping_status || null, payment_status || null, orderId);

  if (result.changes === 0) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  res.json({ order: updated });
});

export default router;
