const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'chicken_shop.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to the SQLite database.');
  }
});

// Helper to run queries with promises
const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
};

// Helper to get multiple rows
const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Helper to get a single row
const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

// Initialize schema
const initDB = async () => {
  await dbRun(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      desc TEXT,
      price INTEGER NOT NULL,
      img TEXT
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      customerName TEXT NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL,
      etaMins INTEGER NOT NULL,
      ts INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  await dbRun(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price INTEGER NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(id) ON DELETE CASCADE
    )
  `);

  // Prepopulate if products are empty
  const countRow = await dbGet('SELECT COUNT(*) AS count FROM products');
  if (countRow.count === 0) {
    const defaultProducts = [
      { name: 'Whole Chicken', emoji: '🐔', desc: 'Full bird, farm-raised, ~1.5 kg', price: 320, img: '' },
      { name: 'Breast Pieces', emoji: '🍗', desc: 'Boneless breast, skinless, per kg', price: 280, img: '' },
      { name: 'Chicken Legs', emoji: '🦵', desc: 'Drumstick & thigh, per kg', price: 220, img: '' },
      { name: 'Wings Pack', emoji: '🍖', desc: '1 kg wings, great for fry', price: 200, img: '' },
      { name: 'Keema (Minced)', emoji: '🥩', desc: 'Fresh minced chicken, per 500g', price: 175, img: '' },
      { name: 'Curry Cut', emoji: '🍲', desc: 'Mixed pieces for curry, per kg', price: 240, img: '' },
    ];

    for (const p of defaultProducts) {
      await dbRun(
        'INSERT INTO products (name, emoji, desc, price, img) VALUES (?, ?, ?, ?, ?)',
        [p.name, p.emoji, p.desc, p.price, p.img]
      );
    }
    console.log('Prepopulated database with default raw chicken cuts.');
  }
};

module.exports = {
  db,
  dbRun,
  dbAll,
  dbGet,
  initDB
};
