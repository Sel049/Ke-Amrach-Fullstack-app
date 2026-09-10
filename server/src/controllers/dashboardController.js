import { pool } from '../config/database.js';

// Get buyer dashboard data
export const getBuyerDashboard = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get user ID and role
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ?",
      [uid]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRows[0].id;
    const userRole = userRows[0].role;

    // Enforce role-based access
    if (userRole !== 'buyer') {
      return res.status(403).json({ error: "Access denied. Buyer role required." });
    }

    // Get recent orders
    const [recentOrders] = await pool.query(
      `SELECT
        o.*,
        u.full_name as farmer_name,
        u.region as farmer_region,
        COUNT(oi.id) as item_count
       FROM orders o
       JOIN users u ON o.farmer_user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.buyer_user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Get order statistics
    const [orderStats] = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        SUM(total) as total_spent,
        AVG(total) as avg_order_value
       FROM orders
       WHERE buyer_user_id = ?`,
      [userId]
    );

    // Get favorite listings count
    const [favoriteStats] = await pool.query(
      `SELECT COUNT(*) as total_favorites
       FROM favorites f
       JOIN produce_listings l ON f.listing_id = l.id
       WHERE f.buyer_user_id = ? AND l.status = 'active'`,
      [userId]
    );

    // Get recent market trends (top crops by price change)
    const [marketTrends] = await pool.query(
      `SELECT
        l.crop,
        l.region,
        AVG(l.price_per_unit) as current_price,
        COUNT(l.id) as listing_count
       FROM produce_listings l
       WHERE l.status = 'active'
       AND l.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY l.crop, l.region
       ORDER BY listing_count DESC
       LIMIT 5`
    );

    // Get recommended listings based on user's order history
    const [recommendations] = await pool.query(
      `SELECT DISTINCT
        l.*,
        u.full_name as farmer_name,
        u.region as farmer_region,
        u.avg_rating as farmer_rating,
        u.review_count as farmer_review_count
       FROM produce_listings l
       JOIN users u ON l.farmer_user_id = u.id
       WHERE l.status = 'active'
       AND l.crop IN (
         SELECT DISTINCT oi.crop
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.id
         WHERE o.buyer_user_id = ? AND o.status = 'completed'
       )
       AND l.id NOT IN (
         SELECT listing_id FROM favorites WHERE buyer_user_id = ?
       )
       ORDER BY l.created_at DESC
       LIMIT 6`,
      [userId, userId]
    );

    // Get spending trends (monthly)
    const [spendingTrends] = await pool.query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total) as total_spent
       FROM orders
       WHERE buyer_user_id = ?
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`
    , [userId]);

    res.json({
      recentOrders,
      orderStats: orderStats[0] || {
        total_orders: 0,
        pending_orders: 0,
        confirmed_orders: 0,
        shipped_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_spent: 0,
        avg_order_value: 0
      },
      favoriteStats: favoriteStats[0] || { total_favorites: 0 },
      marketTrends,
      recommendations,
      spendingTrends
    });
  } catch (error) {
    console.error('Error fetching buyer dashboard:', error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

// Get farmer dashboard data
export const getFarmerDashboard = async (req, res) => {
  try {
    const uid = req.user.uid;

    // Get user ID and role
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ?",
      [uid]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRows[0].id;
    const userRole = userRows[0].role;

    // Enforce role-based access
    if (userRole !== 'farmer') {
      return res.status(403).json({ error: "Access denied. Farmer role required." });
    }

    // Get recent orders
    const [recentOrders] = await pool.query(
      `SELECT
        o.*,
        u.full_name as buyer_name,
        u.region as buyer_region,
        COUNT(oi.id) as item_count
       FROM orders o
       JOIN users u ON o.buyer_user_id = u.id
       LEFT JOIN order_items oi ON o.id = oi.order_id
       WHERE o.farmer_user_id = ?
       GROUP BY o.id
       ORDER BY o.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Get order statistics
    const [orderStats] = await pool.query(
      `SELECT
        COUNT(*) as total_orders,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_orders,
        COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
        SUM(total) as total_earnings,
        AVG(total) as avg_order_value
       FROM orders
       WHERE farmer_user_id = ?`,
      [userId]
    );

    // Get listing statistics
    const [listingStats] = await pool.query(
      `SELECT
        COUNT(*) as total_listings,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_listings,
        COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_listings,
        SUM(quantity) as total_available,
        AVG(price_per_unit) as avg_price,
        SUM(CASE WHEN status = 'active' THEN quantity * price_per_unit ELSE 0 END) as potential_value
       FROM produce_listings
       WHERE farmer_user_id = ?`,
      [userId]
    );

    // Get earnings trends (monthly)
    const [earningsTrends] = await pool.query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total) as total_earnings
       FROM orders
       WHERE farmer_user_id = ?
       AND status = 'completed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`
    , [userId]);

    // Get top performing crops
    const [topCrops] = await pool.query(
      `SELECT
        l.crop,
        COUNT(l.id) as listing_count,
        AVG(l.price_per_unit) as avg_price,
        SUM(l.quantity) as total_quantity,
        COUNT(o.id) as order_count,
        SUM(oi.quantity) as sold_quantity
       FROM produce_listings l
       LEFT JOIN order_items oi ON l.id = oi.listing_id
       LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
       WHERE l.farmer_user_id = ?
       GROUP BY l.crop
       ORDER BY order_count DESC, sold_quantity DESC
       LIMIT 5`,
      [userId]
    );

    // Get recent reviews
    const [recentReviews] = await pool.query(
      `SELECT
        r.*,
        l.title as listing_title,
        l.crop as listing_crop,
        u.full_name as reviewer_name
       FROM reviews r
       JOIN produce_listings l ON r.listing_id = l.id
       JOIN users u ON r.user_id = u.id
       WHERE l.farmer_user_id = ?
       ORDER BY r.created_at DESC
       LIMIT 5`,
      [userId]
    );

    // Get farmer profile stats
    const [profileStats] = await pool.query(
      `SELECT
        fp.farm_name,
        fp.experience_years,
        fp.certifications,
        u.avg_rating,
        u.review_count,
        COUNT(DISTINCT l.id) as total_listings_created,
        COUNT(DISTINCT o.id) as total_orders_received
       FROM users u
       LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
       LEFT JOIN produce_listings l ON u.id = l.farmer_user_id
       LEFT JOIN orders o ON u.id = o.farmer_user_id
       WHERE u.id = ?
       GROUP BY fp.farm_name, fp.experience_years, fp.certifications, u.avg_rating, u.review_count`,
      [userId]
    );

    res.json({
      recentOrders,
      orderStats: orderStats[0] || {
        total_orders: 0,
        pending_orders: 0,
        confirmed_orders: 0,
        shipped_orders: 0,
        completed_orders: 0,
        cancelled_orders: 0,
        total_earnings: 0,
        avg_order_value: 0
      },
      listingStats: listingStats[0] || {
        total_listings: 0,
        active_listings: 0,
        expired_listings: 0,
        total_available: 0,
        avg_price: 0,
        potential_value: 0
      },
      earningsTrends,
      topCrops,
      recentReviews,
      profileStats: profileStats[0] || {
        farm_name: null,
        experience_years: 0,
        certifications: null,
        avg_rating: 0,
        review_count: 0,
        total_listings_created: 0,
        total_orders_received: 0
      }
    });
  } catch (error) {
    console.error('Error fetching farmer dashboard:', error);
    res.status(500).json({ error: "Failed to fetch dashboard data" });
  }
};

// Get admin dashboard data
export const getAdminDashboard = async (req, res) => {
  try {
    // Get overall platform statistics
    const [platformStats] = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'farmer') as total_farmers,
        (SELECT COUNT(*) FROM users WHERE role = 'buyer') as total_buyers,
        (SELECT COUNT(*) FROM produce_listings WHERE status = 'active') as active_listings,
        (SELECT COUNT(*) FROM orders) as total_orders,
        (SELECT COUNT(*) FROM orders WHERE status = 'completed') as completed_orders,
        (SELECT SUM(total) FROM orders WHERE status = 'completed') as total_transactions,
        (SELECT AVG(rating) FROM reviews) as avg_rating,
        (SELECT COUNT(*) FROM reviews) as total_reviews`
    );

    // Get user growth trends
    const [userGrowth] = await pool.query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(CASE WHEN role = 'farmer' THEN 1 END) as farmers,
        COUNT(CASE WHEN role = 'buyer' THEN 1 END) as buyers
       FROM users
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`
    );

    // Get top performing regions
    const [topRegions] = await pool.query(
      `SELECT
        l.region,
        COUNT(DISTINCT l.id) as listing_count,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.total) as total_value,
        AVG(l.price_per_unit) as avg_price
       FROM produce_listings l
       LEFT JOIN order_items oi ON l.id = oi.listing_id
       LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
       WHERE l.status = 'active'
       GROUP BY l.region
       ORDER BY order_count DESC
       LIMIT 10`
    );

    // Get popular crops
    const [popularCrops] = await pool.query(
      `SELECT
        l.crop,
        COUNT(DISTINCT l.id) as listing_count,
        COUNT(DISTINCT o.id) as order_count,
        SUM(oi.quantity) as total_quantity_sold,
        AVG(l.price_per_unit) as avg_price
       FROM produce_listings l
       LEFT JOIN order_items oi ON l.id = oi.listing_id
       LEFT JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
       WHERE l.status = 'active'
       GROUP BY l.crop
       ORDER BY order_count DESC
       LIMIT 10`
    );

    // Get recent activity
    const [recentActivity] = await pool.query(
      `(SELECT
        'new_user' as type,
        u.full_name as name,
        u.role as role,
        u.created_at as timestamp
       FROM users u
       WHERE u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY u.created_at DESC
       LIMIT 5)
       UNION ALL
       (SELECT
        'new_listing' as type,
        l.title as name,
        'farmer' as role,
        l.created_at as timestamp
       FROM produce_listings l
       WHERE l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY l.created_at DESC
       LIMIT 5)
       UNION ALL
       (SELECT
        'new_order' as type,
        CONCAT('Order #', o.id) as name,
        'buyer' as role,
        o.created_at as timestamp
       FROM orders o
       WHERE o.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       ORDER BY o.created_at DESC
       LIMIT 5)
       ORDER BY timestamp DESC
       LIMIT 15`
    );

    // Get revenue trends
    const [revenueTrends] = await pool.query(
      `SELECT
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as order_count,
        SUM(total) as total_revenue,
        AVG(total) as avg_order_value
       FROM orders
       WHERE status = 'completed'
       AND created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(created_at, '%Y-%m')
       ORDER BY month DESC`
    );

    res.json({
      platformStats: platformStats[0] || {
        total_farmers: 0,
        total_buyers: 0,
        active_listings: 0,
        total_orders: 0,
        completed_orders: 0,
        total_transactions: 0,
        avg_rating: 0,
        total_reviews: 0
      },
      userGrowth,
      topRegions,
      popularCrops,
      recentActivity,
      revenueTrends
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    res.status(500).json({ error: "Failed to fetch admin dashboard data" });
  }
};

// Get analytics data for charts
export const getAnalyticsData = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { type, period = 'month' } = req.query;

    // Get user ID and role
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ?",
      [uid]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRows[0].id;
    const userRole = userRows[0].role;

    let dateFilter = '';
    if (period === 'week') {
      dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
    } else if (period === 'month') {
      dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)";
    } else if (period === 'quarter') {
      dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 3 MONTH)";
    } else if (period === 'year') {
      dateFilter = "AND created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)";
    }

    let analyticsData = {};

    if (type === 'orders' || type === 'all') {
      if (userRole === 'buyer') {
        const [orderData] = await pool.query(
          `SELECT
            DATE(created_at) as date,
            COUNT(*) as order_count,
            SUM(total) as total_spent
           FROM orders
           WHERE buyer_user_id = ? ${dateFilter}
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        );
        analyticsData.orders = orderData;
      } else {
        const [orderData] = await pool.query(
          `SELECT
            DATE(created_at) as date,
            COUNT(*) as order_count,
            SUM(total) as total_earnings
           FROM orders
           WHERE farmer_user_id = ? ${dateFilter}
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        );
        analyticsData.orders = orderData;
      }
    }

    if (type === 'listings' || type === 'all') {
      if (userRole === 'farmer') {
        const [listingData] = await pool.query(
          `SELECT
            DATE(created_at) as date,
            COUNT(*) as listing_count,
            SUM(quantity * price_per_unit) as potential_value
           FROM produce_listings
           WHERE farmer_user_id = ? ${dateFilter}
           GROUP BY DATE(created_at)
           ORDER BY date`,
          [userId]
        );
        analyticsData.listings = listingData;
      }
    }

    if (type === 'reviews' || type === 'all') {
      if (userRole === 'farmer') {
        const [reviewData] = await pool.query(
          `SELECT
            DATE(r.created_at) as date,
            COUNT(r.id) as review_count,
            AVG(r.rating) as avg_rating
           FROM reviews r
           JOIN produce_listings l ON r.listing_id = l.id
           WHERE l.farmer_user_id = ? ${dateFilter}
           GROUP BY DATE(r.created_at)
           ORDER BY date`,
          [userId]
        );
        analyticsData.reviews = reviewData;
      }
    }

    res.json({
      type,
      period,
      userRole,
      analyticsData
    });
  } catch (error) {
    console.error('Error fetching analytics data:', error);
    res.status(500).json({ error: "Failed to fetch analytics data" });
  }
};

// ---------------------------------------------------------------------------
// Admin analytics helpers
// ---------------------------------------------------------------------------

const ADMIN_PERIODS = ['7d', '30d', '90d', '1y'];

const PERIOD_CONFIG = {
  '7d': { days: 7, bucket: 'day' },
  '30d': { days: 30, bucket: 'day' },
  '90d': { days: 90, bucket: 'week' },
  '1y': { days: 365, bucket: 'month' },
};

const CATEGORY_COLORS = ['bg-amber-500', 'bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-rose-500'];

const MS_DAY = 86400000;

// SQL DATE_FORMAT expression that turns a timestamp into the bucket key used
// for chart aggregation (day / ISO-week-start / month-start).
function bucketExpr(column, bucket) {
  if (bucket === 'week') {
    return `DATE_FORMAT(DATE_SUB(${column}, INTERVAL WEEKDAY(${column}) DAY), '%Y-%m-%d')`;
  }
  if (bucket === 'month') {
    return `DATE_FORMAT(${column}, '%Y-%m-01')`;
  }
  return `DATE_FORMAT(${column}, '%Y-%m-%d')`;
}

// Builds a UTC-aligned date range for a period, including the previous period
// (for growth %) and the ordered list of chart bucket labels.
function buildDateRange(period) {
  const config = PERIOD_CONFIG[period] || PERIOD_CONFIG['30d'];
  const { days, bucket } = config;

  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(todayUtc.getTime() + MS_DAY); // tomorrow 00:00 UTC (exclusive)
  const start = new Date(end.getTime() - days * MS_DAY);
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(prevEnd.getTime() - days * MS_DAY);

  const labels = [];
  if (bucket === 'week') {
    const monday = new Date(start.getTime());
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    for (let w = new Date(monday); w.getTime() < end.getTime(); w.setUTCDate(w.getUTCDate() + 7)) {
      labels.push(w.toISOString().slice(0, 10));
    }
  } else if (bucket === 'month') {
    let y = start.getUTCFullYear();
    let m = start.getUTCMonth();
    const monthCount = Math.ceil(days / 28) + 1;
    for (let i = 0; i < monthCount; i++) {
      labels.push(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      m += 1;
      if (m === 12) { m = 0; y += 1; }
    }
  } else {
    for (let t = start.getTime(); t < end.getTime(); t += MS_DAY) {
      labels.push(new Date(t).toISOString().slice(0, 10));
    }
  }

  return {
    bucket,
    startStr: start.toISOString().slice(0, 10),
    endStr: end.toISOString().slice(0, 10),
    prevStartStr: prevStart.toISOString().slice(0, 10),
    prevEndStr: prevEnd.toISOString().slice(0, 10),
    labels,
  };
}

// Maps aggregated SQL rows ({ k: bucketKey, v: total }) onto the ordered label
// list so every bucket is present (zero-filled when missing).
function zeroFill(rows, range) {
  const map = new Map();
  for (const row of rows) {
    map.set(String(row.k), Number(row.v) || 0);
  }
  return range.labels.map((label) => ({ label, value: map.get(label) || 0 }));
}

function growthPct(current, previous) {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function formatRelativeTime(date) {
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
// Get admin analytics data
export const getAdminAnalytics = async (req, res) => {
  try {
    const uid = req.user.uid;
    const period = ADMIN_PERIODS.includes(req.query.period) ? req.query.period : '30d';

    // Verify admin role
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ? AND role = 'admin'",
      [uid]
    );

    if (userRows.length === 0) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const range = buildDateRange(period);
    const keyExpr = bucketExpr('created_at', range.bucket);

    const [
      [revTotalRows], [usrTotalRows], [ordTotalRows], [listTotalRows],
      [revCurRows], [revPrevRows], [usrCurRows], [usrPrevRows],
      [ordCurRows], [ordPrevRows], [listCurRows], [listPrevRows],
      [revChartRows], [usrChartRows], [ordChartRows], [listChartRows],
      [categoryRows], [farmerRows], [activityRows],
    ] = await Promise.all([
      pool.query("SELECT COALESCE(SUM(total), 0) AS v FROM orders WHERE status = 'completed'"),
      pool.query("SELECT COUNT(*) AS v FROM users"),
      pool.query("SELECT COUNT(*) AS v FROM orders"),
      pool.query("SELECT COUNT(*) AS v FROM produce_listings WHERE status = 'active'"),

      pool.query("SELECT COALESCE(SUM(total), 0) AS v FROM orders WHERE status = 'completed' AND created_at >= ? AND created_at < ?", [range.startStr, range.endStr]),
      pool.query("SELECT COALESCE(SUM(total), 0) AS v FROM orders WHERE status = 'completed' AND created_at >= ? AND created_at < ?", [range.prevStartStr, range.prevEndStr]),
      pool.query("SELECT COUNT(*) AS v FROM users WHERE created_at >= ? AND created_at < ?", [range.startStr, range.endStr]),
      pool.query("SELECT COUNT(*) AS v FROM users WHERE created_at >= ? AND created_at < ?", [range.prevStartStr, range.prevEndStr]),
      pool.query("SELECT COUNT(*) AS v FROM orders WHERE created_at >= ? AND created_at < ?", [range.startStr, range.endStr]),
      pool.query("SELECT COUNT(*) AS v FROM orders WHERE created_at >= ? AND created_at < ?", [range.prevStartStr, range.prevEndStr]),
      pool.query("SELECT COUNT(*) AS v FROM produce_listings WHERE created_at >= ? AND created_at < ?", [range.startStr, range.endStr]),
      pool.query("SELECT COUNT(*) AS v FROM produce_listings WHERE created_at >= ? AND created_at < ?", [range.prevStartStr, range.prevEndStr]),

      pool.query(`SELECT ${keyExpr} AS k, SUM(total) AS v FROM orders WHERE status = 'completed' AND created_at >= ? AND created_at < ? GROUP BY ${keyExpr}`, [range.startStr, range.endStr]),
      pool.query(`SELECT ${keyExpr} AS k, COUNT(*) AS v FROM users WHERE created_at >= ? AND created_at < ? GROUP BY ${keyExpr}`, [range.startStr, range.endStr]),
      pool.query(`SELECT ${keyExpr} AS k, COUNT(*) AS v FROM orders WHERE created_at >= ? AND created_at < ? GROUP BY ${keyExpr}`, [range.startStr, range.endStr]),
      pool.query(`SELECT ${keyExpr} AS k, COUNT(*) AS v FROM produce_listings WHERE created_at >= ? AND created_at < ? GROUP BY ${keyExpr}`, [range.startStr, range.endStr]),

      pool.query(`SELECT l.crop AS name, COALESCE(SUM(oi.line_total), 0) AS revenue
          FROM order_items oi
          JOIN orders o ON oi.order_id = o.id AND o.status = 'completed'
          JOIN produce_listings l ON oi.listing_id = l.id
          WHERE o.created_at >= ? AND o.created_at < ?
          GROUP BY l.crop
          ORDER BY revenue DESC
          LIMIT 5`, [range.startStr, range.endStr]),

      pool.query(`SELECT u.full_name AS name, COUNT(o.id) AS orders,
            COALESCE(SUM(o.total), 0) AS revenue,
            COALESCE((SELECT AVG(r2.rating) FROM reviews r2 JOIN produce_listings pl ON r2.listing_id = pl.id WHERE pl.farmer_user_id = u.id), 0) AS rating
          FROM users u
          LEFT JOIN orders o ON u.id = o.farmer_user_id AND o.status = 'completed' AND o.created_at >= ? AND o.created_at < ?
          WHERE u.role = 'farmer'
          GROUP BY u.id, u.full_name
          HAVING orders > 0
          ORDER BY revenue DESC
          LIMIT 5`, [range.startStr, range.endStr]),

      pool.query(`SELECT * FROM (
            (SELECT 'order' AS type, CONCAT('Order #', o.id, ' placed') AS message, o.created_at AS ts, CONCAT('ETB ', FORMAT(o.total, 0)) AS value FROM orders o WHERE o.created_at >= ? AND o.created_at < ? ORDER BY o.created_at DESC LIMIT 12)
            UNION ALL
            (SELECT 'user' AS type, CONCAT('New user registered: ', u.full_name) AS message, u.created_at AS ts, u.role AS value FROM users u WHERE u.created_at >= ? AND u.created_at < ? ORDER BY u.created_at DESC LIMIT 12)
            UNION ALL
            (SELECT 'listing' AS type, CONCAT('New listing: ', l.title) AS message, l.created_at AS ts, l.crop AS value FROM produce_listings l WHERE l.created_at >= ? AND l.created_at < ? ORDER BY l.created_at DESC LIMIT 12)
          ) t ORDER BY ts DESC LIMIT 12`, [range.startStr, range.endStr, range.startStr, range.endStr, range.startStr, range.endStr]),
    ]);
const revenueTotal = Number(revTotalRows[0].v);
    const revenueCur = Number(revCurRows[0].v);
    const revenuePrev = Number(revPrevRows[0].v);
    const usersTotal = Number(usrTotalRows[0].v);
    const usersCur = Number(usrCurRows[0].v);
    const usersPrev = Number(usrPrevRows[0].v);
    const ordersTotal = Number(ordTotalRows[0].v);
    const ordersCur = Number(ordCurRows[0].v);
    const ordersPrev = Number(ordPrevRows[0].v);
    const listingsTotal = Number(listTotalRows[0].v);
    const listingsCur = Number(listCurRows[0].v);
    const listingsPrev = Number(listPrevRows[0].v);

    const categoryTotal = categoryRows.reduce((sum, r) => sum + Number(r.revenue), 0);
    const topCategories = categoryRows.map((r, i) => ({
      name: r.name,
      revenue: Number(r.revenue),
      value: categoryTotal ? Number(((Number(r.revenue) / categoryTotal) * 100).toFixed(1)) : 0,
      color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
    }));

    const topFarmers = farmerRows.map((r) => ({
      name: r.name,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
      rating: Number(Number(r.rating).toFixed(1)),
    }));

    const recentActivity = activityRows.map((r) => ({
      type: r.type,
      message: r.message,
      value: r.value,
      time: formatRelativeTime(new Date(r.ts)),
    }));

    res.json({
      period,
      revenue: { total: revenueTotal, growth: growthPct(revenueCur, revenuePrev), chart: zeroFill(revChartRows, range) },
      users: { total: usersTotal, growth: growthPct(usersCur, usersPrev), chart: zeroFill(usrChartRows, range) },
      orders: { total: ordersTotal, growth: growthPct(ordersCur, ordersPrev), chart: zeroFill(ordChartRows, range) },
      listings: { total: listingsTotal, growth: growthPct(listingsCur, listingsPrev), chart: zeroFill(listChartRows, range) },
      topCategories,
      topFarmers,
      recentActivity,
    });
  } catch (error) {
    console.error('Error fetching admin analytics:', error);
    res.status(500).json({ error: "Failed to fetch admin analytics data" });
  }
};

