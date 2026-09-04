-- RUMI Database Schema
-- Raw SQL Migration
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT CHECK(role IN ('admin', 'parent')) NOT NULL,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  date_of_birth TEXT NOT NULL,
  class_group TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  domain TEXT CHECK(domain IN ('practical_life', 'sensorial', 'language', 'math', 'islamic_studies')) NOT NULL,
  score INTEGER CHECK(score >= 1 AND score <= 10) NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL,
  photo_url TEXT NOT NULL,
  caption TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (child_id) REFERENCES children(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS play_kits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  category TEXT DEFAULT 'General',
  color TEXT DEFAULT '#E7F4F0',
  icon TEXT DEFAULT '✦',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER NOT NULL,
  total_amount REAL NOT NULL,
  payment_status TEXT CHECK(payment_status IN ('pending', 'paid', 'failed')) DEFAULT 'paid',
  shipping_status TEXT CHECK(shipping_status IN ('New', 'Packed', 'Shipped')) DEFAULT 'New',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  kit_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (kit_id) REFERENCES play_kits(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS pop_up_classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date_day TEXT NOT NULL,
  date_month TEXT NOT NULL,
  location TEXT NOT NULL,
  time TEXT NOT NULL,
  tag TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
