import bcrypt from 'bcryptjs';
import db from './index.js';
import { initializeDatabase } from './init.js';

export function seedDatabase() {
  // Ensure schema is created
  initializeDatabase();

  console.log('Seeding initial data via raw SQL...');

  // Use a transaction for safe, atomic seeding
  const seedTransaction = db.transaction(() => {
    // Clear existing data cleanly (in reverse dependency order)
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM photos').run();
    db.prepare('DELETE FROM assessments').run();
    db.prepare('DELETE FROM children').run();
    db.prepare('DELETE FROM play_kits').run();
    db.prepare('DELETE FROM pop_up_classes').run();
    db.prepare('DELETE FROM users').run();

    // 1. Seed Users
    const adminPassword = bcrypt.hashSync('admin123', 10);
    const parentPassword = bcrypt.hashSync('parent123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, role, name)
      VALUES (?, ?, ?, ?)
    `);

    const adminUser = insertUser.run('admin@rumi.id', adminPassword, 'admin', 'RUMI Admin');
    const nadiaUser = insertUser.run('nadia@example.com', parentPassword, 'parent', 'Nadia Rahman');
    const omarUser = insertUser.run('omar@example.com', parentPassword, 'parent', 'Omar Karim');
    const saraUser = insertUser.run('sara@example.com', parentPassword, 'parent', 'Sara Ali');
    const hanaUser = insertUser.run('hana@example.com', parentPassword, 'parent', 'Hana Ahmed');

    const nadiaId = Number(nadiaUser.lastInsertRowid);
    const omarId = Number(omarUser.lastInsertRowid);
    const saraId = Number(saraUser.lastInsertRowid);
    const hanaId = Number(hanaUser.lastInsertRowid);

    // 2. Seed Children
    const insertChild = db.prepare(`
      INSERT INTO children (parent_id, name, date_of_birth, class_group)
      VALUES (?, ?, ?, ?)
    `);

    const amina = insertChild.run(nadiaId, 'Amina Rahman', '2020-04-15', 'Saffron');
    const yusuf = insertChild.run(omarId, 'Yusuf Karim', '2021-08-10', 'Saffron');
    const maryam = insertChild.run(saraId, 'Maryam Ali', '2019-11-22', 'Cedar');
    const zayn = insertChild.run(hanaId, 'Zayn Ahmed', '2022-02-14', 'Cedar');

    const aminaId = Number(amina.lastInsertRowid);
    const yusufId = Number(yusuf.lastInsertRowid);
    const maryamId = Number(maryam.lastInsertRowid);
    const zaynId = Number(zayn.lastInsertRowid);

    // 3. Seed Assessments
    const insertAssessment = db.prepare(`
      INSERT INTO assessments (child_id, date, domain, score, notes)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Amina's assessments
    insertAssessment.run(aminaId, '2025-09-20', 'practical_life', 8, 'Amina chose the pouring work three times today — her concentration is blooming.');
    insertAssessment.run(aminaId, '2025-09-18', 'sensorial', 7, 'Refining the senses with tactile fabrics and sound boxes.');
    insertAssessment.run(aminaId, '2025-09-15', 'language', 7, 'Finding confidence in stories and recognized Arabic letter ب.');
    insertAssessment.run(aminaId, '2025-09-12', 'math', 6, 'Building number sense, counting objects to 10 with bead stairs.');
    insertAssessment.run(aminaId, '2025-09-10', 'islamic_studies', 9, 'Growing a heart rooted in wonder and adab, greeting friends warmly.');

    // Yusuf's assessments
    insertAssessment.run(yusufId, '2025-09-19', 'practical_life', 7, 'Showed great care in sorting and cleaning up the workspace.');
    insertAssessment.run(yusufId, '2025-09-17', 'sensorial', 8, 'Enthusiastic engagement with the cylinder blocks.');

    // Maryam's assessments
    insertAssessment.run(maryamId, '2025-09-20', 'language', 9, 'Mastering phonetic sounds and writing simple three-letter words.');

    // Zayn's assessments
    insertAssessment.run(zaynId, '2025-09-18', 'practical_life', 6, 'Practicing pouring and spooning dry beans with determination.');

    // 4. Seed Photos
    const insertPhoto = db.prepare(`
      INSERT INTO photos (child_id, photo_url, caption, uploaded_at)
      VALUES (?, ?, ?, ?)
    `);

    const photos = [
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=900&q=80', caption: 'Quiet morning work', date: '2025-09-20 09:45:00' },
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80', caption: 'Making connections', date: '2025-09-20 10:15:00' },
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1560785496-3c9d27877182?auto=format&fit=crop&w=900&q=80', caption: 'Hands-on discovery', date: '2025-09-13 10:00:00' },
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&w=900&q=80', caption: 'A moment of calm', date: '2025-09-13 11:10:00' },
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=900&q=80', caption: 'Creating together', date: '2025-09-06 09:30:00' },
      { childId: aminaId, url: 'https://images.unsplash.com/photo-1599623560574-39d485900c95?auto=format&fit=crop&w=900&q=80', caption: 'Our little community', date: '2025-09-06 11:30:00' },
      // Yusuf photos
      { childId: yusufId, url: 'https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=900&q=80', caption: 'Focused exploration', date: '2025-09-20 10:30:00' },
    ];

    for (const p of photos) {
      insertPhoto.run(p.childId, p.url, p.caption, p.date);
    }

    // 5. Seed Play Kits
    const insertPlayKit = db.prepare(`
      INSERT INTO play_kits (title, description, price, stock, image_url, category, color, icon)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const kit1 = insertPlayKit.run(
      'Little Hands Tray',
      'A beautiful wooden invitation for pouring, sorting, and focused little work.',
      34.0,
      12,
      'https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?auto=format&fit=crop&w=600&q=80',
      'Practical Life',
      '#E7F4F0',
      '✦'
    );
    const kit2 = insertPlayKit.run(
      'Desert Moon Cards',
      'Gentle conversation cards to explore gratitude, kindness, and wonder.',
      22.0,
      8,
      'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
      'Islamic Studies',
      '#FFF1E6',
      '☾'
    );
    const kit3 = insertPlayKit.run(
      'Sound & Sand Set',
      'Tactile letter cards and sound games for curious early readers.',
      42.0,
      4,
      'https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=600&q=80',
      'Sensorial',
      '#FFF7CF',
      '◌'
    );
    const kit4 = insertPlayKit.run(
      'Counting Garden',
      'A playful garden of beads and numerals for hands-on number sense.',
      28.0,
      16,
      'https://images.unsplash.com/photo-1587654780291-39c9404d746b?auto=format&fit=crop&w=600&q=80',
      'Math',
      '#E7F4F0',
      '· · ·'
    );

    const kit1Id = Number(kit1.lastInsertRowid);
    const kit2Id = Number(kit2.lastInsertRowid);
    const kit3Id = Number(kit3.lastInsertRowid);
    const kit4Id = Number(kit4.lastInsertRowid);

    // 6. Seed Orders and Order Items
    const insertOrder = db.prepare(`
      INSERT INTO orders (parent_id, total_amount, payment_status, shipping_status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertOrderItem = db.prepare(`
      INSERT INTO order_items (order_id, kit_id, quantity, price)
      VALUES (?, ?, ?, ?)
    `);

    // Nadia's orders
    const order1 = insertOrder.run(nadiaId, 34.0, 'paid', 'Packed', '2025-08-18 14:20:00');
    insertOrderItem.run(Number(order1.lastInsertRowid), kit1Id, 1, 34.0);

    const order2 = insertOrder.run(nadiaId, 85.0, 'paid', 'Shipped', '2025-09-01 09:00:00');
    // tuition / special order

    const order3 = insertOrder.run(nadiaId, 85.0, 'pending', 'New', '2025-09-20 11:00:00');

    // Other parents' orders (for Admin order manager)
    const order4 = insertOrder.run(saraId, 62.0, 'paid', 'New', '2025-09-19 16:45:00');
    insertOrderItem.run(Number(order4.lastInsertRowid), kit2Id, 1, 22.0);
    insertOrderItem.run(Number(order4.lastInsertRowid), kit3Id, 1, 40.0);

    const order5 = insertOrder.run(hanaId, 42.0, 'paid', 'Packed', '2025-09-18 12:15:00');
    insertOrderItem.run(Number(order5.lastInsertRowid), kit3Id, 1, 42.0);

    // 7. Seed Pop-up Classes
    const insertClass = db.prepare(`
      INSERT INTO pop_up_classes (title, date_day, date_month, location, time, tag)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertClass.run('Moon & Movement', '21', 'SEP', 'The Grove, KL', '9:30 – 11:30 AM', '2 spots left');
    insertClass.run('Little Gardeners', '28', 'SEP', 'The Hive, PJ', '9:30 – 11:30 AM', 'New');
    insertClass.run('Our Kind World', '05', 'OCT', 'The Grove, KL', '2:00 – 4:00 PM', 'Ages 3–6');
  });

  seedTransaction();
  console.log('✓ Database seeded successfully with test users, children, assessments, photos, kits, orders, and classes.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase();
}
