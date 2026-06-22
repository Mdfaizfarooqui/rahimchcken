const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { initDB, dbRun, dbAll, dbGet } = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;
const OWNER_PIN = '1234';
const AUTH_TOKEN = 'fc_owner_secure_token_5819';
const MINS_PER_ORDER = 8;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Config Multer storage for CMS image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'product-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage });

app.use(cors());
app.use(express.json());
// Serve uploaded images statically
app.use('/uploads', express.static(uploadDir));

// SSE Client list
let sseClients = [];

// Helper middleware for owner authentication
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.split(' ')[1] === AUTH_TOKEN) {
    next();
  } else {
    res.status(401).json({ error: 'Unauthorized. Owner session expired.' });
  }
};

// Helper middleware for user authentication
const requireUserAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer fc_user_token_')) {
    const userId = parseInt(authHeader.split('_')[3]);
    if (!isNaN(userId)) {
      try {
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
        if (user) {
          req.userId = user.id;
          req.username = user.username;
          return next();
        }
      } catch (err) {}
    }
  }
  res.status(401).json({ error: 'Unauthorized user.' });
};

// Real-time Event broadcast helper
const broadcastSSE = (event, data) => {
  sseClients.forEach(client => {
    client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  });
};

// SSE Endpoint
app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  res.write(':\n\n'); // SSE ping

  const client = { id: Date.now(), res };
  sseClients.push(client);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== client.id);
  });
});

// ─── AUTH ENDPOINT ───────────────────────────────────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body;
  if (pin === OWNER_PIN) {
    res.json({ success: true, token: AUTH_TOKEN });
  } else {
    res.status(400).json({ error: 'Incorrect PIN. Try again.' });
  }
});

// User Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required.' });
  try {
    const existing = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: 'Username already taken.' });
    const result = await dbRun('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
    const token = `fc_user_token_${result.lastID}`;
    res.json({ success: true, token, username, userId: result.lastID });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User Login
app.post('/api/auth/login-user', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    if (user) {
      const token = `fc_user_token_${user.id}`;
      res.json({ success: true, token, username: user.username, userId: user.id });
    } else {
      res.status(400).json({ error: 'Invalid username or password.' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PRODUCTS ENDPOINTS ──────────────────────────────────────────────────────
app.get('/api/products', async (req, res) => {
  try {
    const products = await dbAll('SELECT * FROM products');
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create product
app.post('/api/products', requireAuth, async (req, res) => {
  const { name, emoji, desc, price } = req.body;
  try {
    const result = await dbRun(
      'INSERT INTO products (name, emoji, desc, price, img) VALUES (?, ?, ?, ?, "")',
      [name, emoji || '🐔', desc || '', price || 0]
    );
    const newProduct = await dbGet('SELECT * FROM products WHERE id = ?', [result.lastID]);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update product text details
app.post('/api/products/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { name, desc, price, emoji } = req.body;
  try {
    await dbRun(
      'UPDATE products SET name = ?, desc = ?, price = ?, emoji = ? WHERE id = ?',
      [name, desc, price, emoji, id]
    );
    const updated = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload product image
app.post('/api/products/:id/upload', requireAuth, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded' });
  }
  const imgUrl = `/uploads/${req.file.filename}`;
  try {
    await dbRun('UPDATE products SET img = ? WHERE id = ?', [imgUrl, id]);
    const updated = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ORDERS ENDPOINTS ────────────────────────────────────────────────────────
// Helper to recalculate queue positions and ETAs
const recalculateQueue = async () => {
  const activeOrders = await dbAll(
    "SELECT * FROM orders WHERE status = 'waiting' OR status = 'preparing' ORDER BY ts ASC"
  );
  for (let i = 0; i < activeOrders.length; i++) {
    const pos = i + 1;
    const eta = pos * MINS_PER_ORDER;
    await dbRun('UPDATE orders SET etaMins = ? WHERE id = ?', [eta, activeOrders[i].id]);
  }
};

// Create Order
app.post('/api/orders', requireUserAuth, async (req, res) => {
  const { items } = req.body;
  const customerName = req.username;
  const userId = req.userId;
  if (!items || !items.length) {
    return res.status(400).json({ error: 'Items are required.' });
  }

  try {
    // Calculate current queue count
    const activeCountRow = await dbGet(
      "SELECT COUNT(*) AS count FROM orders WHERE status = 'waiting' OR status = 'preparing'"
    );
    const pos = activeCountRow.count + 1;
    const etaMins = pos * MINS_PER_ORDER;
    const orderId = 'FC' + Date.now().toString().slice(-5);
    const ts = Date.now();

    let total = 0;
    // Verify items and calculate total
    const itemRecords = [];
    for (const item of items) {
      const product = await dbGet('SELECT * FROM products WHERE id = ?', [item.productId]);
      if (product) {
        const itemPrice = product.price * item.qty;
        total += itemPrice;
        itemRecords.push({
          name: product.name,
          emoji: product.emoji,
          qty: item.qty,
          price: itemPrice
        });
      }
    }

    if (itemRecords.length === 0) {
      return res.status(400).json({ error: 'No valid products found in cart.' });
    }

    // Insert order
    await dbRun(
      'INSERT INTO orders (id, userId, customerName, total, status, etaMins, ts) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [orderId, userId, customerName, total, 'waiting', etaMins, ts]
    );

    // Insert order items
    for (const item of itemRecords) {
      await dbRun(
        'INSERT INTO order_items (orderId, name, emoji, qty, price) VALUES (?, ?, ?, ?, ?)',
        [orderId, item.name, item.emoji, item.qty, item.price]
      );
    }

    const orderData = await dbGet('SELECT * FROM orders WHERE id = ?', [orderId]);
    orderData.items = itemRecords;

    // Trigger SSE event
    broadcastSSE('order_update', { action: 'placed', orderId });
    res.status(201).json(orderData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders (All for owner dashboard)
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders ORDER BY ts DESC');
    for (const order of orders) {
      order.items = await dbAll('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get orders for logged in user
app.get('/api/orders/user/all', requireUserAuth, async (req, res) => {
  try {
    const orders = await dbAll('SELECT * FROM orders WHERE userId = ? ORDER BY ts DESC', [req.userId]);
    for (const order of orders) {
      order.items = await dbAll('SELECT * FROM order_items WHERE orderId = ?', [order.id]);
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single order with its items (for customer tracking)
app.get('/api/orders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    order.items = await dbAll('SELECT * FROM order_items WHERE orderId = ?', [id]);
    
    // Add real-time position in queue
    if (order.status === 'waiting' || order.status === 'preparing') {
      const preceding = await dbGet(
        "SELECT COUNT(*) AS count FROM orders WHERE (status = 'waiting' OR status = 'preparing') AND ts <= ?",
        [order.ts]
      );
      order.currentPosition = preceding.count;
      order.currentEta = preceding.count * MINS_PER_ORDER;
    } else {
      order.currentPosition = 0;
      order.currentEta = 0;
    }
    
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update order status (Owner only)
app.patch('/api/orders/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // waiting, preparing, done, cancelled
  
  if (!['waiting', 'preparing', 'done', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const order = await dbGet('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    await dbRun('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    
    // If done/cancelled, remove from ETA scheduling queue and recalculate positions
    if (status === 'done' || status === 'cancelled') {
      await dbRun('UPDATE orders SET etaMins = 0 WHERE id = ?', [id]);
    }
    await recalculateQueue();

    // Trigger SSE event
    broadcastSSE('order_update', { action: 'status_changed', orderId: id, status });
    res.json({ success: true, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Live Queue Statistics
app.get('/api/queue/stats', async (req, res) => {
  try {
    const waiting = await dbGet("SELECT COUNT(*) AS count FROM orders WHERE status = 'waiting' OR status = 'preparing'");
    const done = await dbGet("SELECT COUNT(*) AS count FROM orders WHERE status = 'done'");
    const cancelled = await dbGet("SELECT COUNT(*) AS count FROM orders WHERE status = 'cancelled'");
    res.json({
      waiting: waiting.count,
      done: done.count,
      cancelled: cancelled.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Startup Server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Fresh Cut Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
});
