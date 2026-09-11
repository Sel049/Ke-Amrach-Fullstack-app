import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";

// Initialize Firebase Admin once
import "./config/firebase.js";

// Main router with all routes
import apiRouter from "./routes/index.js";
// Initialize database connection
import { testConnection, pool } from "./config/database.js";
// Error handling
import { globalErrorHandler, notFoundHandler } from "./utils/errorHandler.js";
import { getSettingValue } from "./services/settingsService.js";

// App
const app = express();

// CORS configuration (must run BEFORE other middleware)
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'];
    if (!origin) return callback(null, true); // allow tools without origin (Postman, curl)
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));
// Explicitly handle preflight for all routes
app.options('*', cors(corsOptions));

// Security middleware (after CORS so preflight always gets headers)
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// In development, make the limiter very lenient (effectively off)
if (process.env.NODE_ENV === 'development') {
  app.use(rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour window
    max: 100000, // very high cap during local dev
    standardHeaders: true,
    legacyHeaders: false,
  }));
} else {
app.use(limiter);
}

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  if (req.path.includes('/images')) {
    console.log('Image request details:', {
      method: req.method,
      path: req.path,
      headers: {
        contentType: req.headers['content-type'],
        authorization: req.headers.authorization ? 'present' : 'missing'
      }
    });
  }
  next();
});

// (CORS is configured above)

// JSON parsing with better error handling
app.use(express.json({
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  verify: (req, res, buf, encoding) => {
    if (buf && buf.length > 0) {
      try {
        JSON.parse(buf);
      } catch (e) {
        console.error('JSON Parse Error:', e.message);
        console.error('Raw buffer (first 100 chars):', buf.toString().substring(0, 100));
        console.error('Buffer length:', buf.length);
        // Don't throw error here, let express handle it
      }
    }
  }
}));

app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Debug middleware to log requests (only in development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log('Request body:', JSON.stringify(req.body, null, 2));
    }
    next();
  });
}

// Serve uploaded files
app.use('/uploads', express.static('uploads'));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV
  });
});

// Maintenance mode (driven by system_settings.general.maintenanceMode).
// Fails open on DB errors and lets health/settings/uploads through so an admin
// can always disable maintenance.
app.use(async (req, res, next) => {
  try {
    if (req.path === '/health' || req.path.startsWith('/api/settings') || req.path.startsWith('/api/auth') || req.path.startsWith('/uploads')) {
      return next();
    }
    const maintenanceMode = await getSettingValue('general', 'maintenanceMode', false);
    if (maintenanceMode === true) {
      // Allow admins through so they can manage the site / turn maintenance off.
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (token && token.startsWith('dev-token-')) {
        const userId = Number(token.split('-')[2]) || null;
        if (userId) {
          const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [userId]);
          if (rows.length && rows[0].role === 'admin') return next();
        }
      }
      return res.status(503).json({
        success: false,
        error: 'Service temporarily unavailable',
        message: 'We are performing maintenance. Please check back shortly.',
      });
    }
    next();
  } catch {
    next();
  }
});

// Public buyer listings endpoint (no authentication required)
app.get("/public/listings", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as category,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.region as location,
        pl.status,
        u.id as farmerUserId,
        u.full_name as farmerName,
        li.url as image,
        ua.url as farmerAvatar,
        pl.created_at as createdAt
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
      LEFT JOIN user_avatars ua ON ua.user_id = u.id
      WHERE pl.status = 'active' AND pl.quantity > 0
      ORDER BY pl.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      count: rows.length,
      listings: rows
    });
  } catch (error) {
    console.error('Public listings error:', error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch listings", 
      details: error.message 
    });
  }
});

// Global error handler for JSON parsing errors
app.use((error, req, res, next) => {
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    console.error('JSON Parse Error:', error.message);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
      message: 'The request body contains invalid JSON'
    });
  }
  next(error);
});

// Mount API routes
app.use('/api', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(globalErrorHandler);

// Start server
const port = Number(process.env.PORT || 5000);
app.listen(port, async () => {
  console.log(`🚀 API listening on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

  // Test database connection (non-blocking)
  try {
    const connected = await testConnection();
    if (connected) {
      console.log('✅ Database connection successful');
      try {
        // Ensure required tables exist (idempotent)
        await pool.query(`CREATE TABLE IF NOT EXISTS listing_images (
          id INT PRIMARY KEY AUTO_INCREMENT,
          listing_id INT NOT NULL,
          url TEXT NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_images_listing (listing_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS favorites (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          buyer_user_id BIGINT NOT NULL,
          listing_id INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_fav_buyer_listing (buyer_user_id, listing_id),
          INDEX idx_fav_buyer (buyer_user_id),
          INDEX idx_fav_listing (listing_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS orders (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          buyer_user_id BIGINT NOT NULL,
          farmer_user_id BIGINT NOT NULL,
          status ENUM('pending','confirmed','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
          subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
          delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
          total NUMERIC(12,2) GENERATED ALWAYS AS (subtotal + delivery_fee) STORED,
          currency CHAR(3) NOT NULL DEFAULT 'ETB',
          notes TEXT NULL,
          delivery_address TEXT NULL,
          delivery_notes TEXT NULL,
          payment_method VARCHAR(64) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_orders_buyer (buyer_user_id),
          INDEX idx_orders_farmer (farmer_user_id),
          INDEX idx_orders_status (status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS order_items (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          order_id BIGINT NOT NULL,
          listing_id INT NOT NULL,
          crop VARCHAR(128) NOT NULL,
          unit ENUM('kg','ton','crate','bag','unit') NOT NULL,
          price_per_unit NUMERIC(12,2) NOT NULL,
          quantity NUMERIC(12,2) NOT NULL,
          line_total NUMERIC(12,2) GENERATED ALWAYS AS (price_per_unit * quantity) STORED,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_items_order (order_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS notifications (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          type VARCHAR(64) NOT NULL,
          payload JSON NULL,
          is_read TINYINT(1) NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_notif_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS user_avatars (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          url TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_avatar (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

await pool.query(`CREATE TABLE IF NOT EXISTS system_settings (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          category VARCHAR(64) NOT NULL,
          setting_key VARCHAR(64) NOT NULL,
          setting_value JSON NOT NULL,
          updated_by BIGINT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_system_settings_key (category, setting_key),
          INDEX idx_system_settings_category (category)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

        await pool.query(`CREATE TABLE IF NOT EXISTS activity_logs (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NULL,
          actor_name VARCHAR(255) NULL,
          actor_role VARCHAR(32) NULL,
          action VARCHAR(64) NOT NULL,
          entity_type VARCHAR(64) NULL,
          entity_id VARCHAR(64) NULL,
          message VARCHAR(512) NULL,
          meta JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_activity_user (user_id),
          INDEX idx_activity_action (action),
          INDEX idx_activity_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
        console.log('🧱 Ensured required tables exist');

        // Ensure new columns on existing orders table (idempotent)
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address TEXT NULL`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_notes TEXT NULL`);
        await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(64) NULL`);
        
        // Ensure verification_status column on users table (idempotent)
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_status ENUM('pending', 'verified', 'rejected') DEFAULT 'pending'`);

        // Ensure payouts table exists for farmer withdrawals
        await pool.query(`CREATE TABLE IF NOT EXISTS payouts (
          id BIGINT PRIMARY KEY AUTO_INCREMENT,
          user_id BIGINT NOT NULL,
          payment_method_id BIGINT NOT NULL,
          amount NUMERIC(12,2) NOT NULL,
          currency CHAR(3) NOT NULL DEFAULT 'ETB',
          status ENUM('pending','approved','processing','completed','rejected') NOT NULL DEFAULT 'pending',
          notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_payouts_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
      } catch (bootErr) {
        console.warn('⚠️  Failed ensuring tables:', bootErr.message);
      }
    } else {
      console.warn('⚠️  Database connection failed, but server is running');
      console.warn('   Make sure MySQL is running and the database exists');
    }
  } catch (error) {
    console.warn('⚠️  Database connection failed, but server is running');
    console.warn('   Make sure MySQL is running and the database exists');
  }
});