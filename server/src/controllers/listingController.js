import { pool } from '../config/database.js';


function normalizeImageUrl(req, url) {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = `${req.protocol}://${req.get('host')}`;
  if (url.startsWith('/uploads/')) return `${base}${url}`;
  if (url.startsWith('uploads/')) return `${base}/${url}`;
  return url;
}

// Get all active listings for buyer dashboard
export const getAllActiveListings = async (req, res) => {
  try {
    const startTime = Date.now();
    
    // First get all listings
    const listingsQuery = `
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as nameAm,
        pl.description,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.crop as category,
        pl.status,
        pl.created_at as createdAt,
        pl.updated_at as updatedAt,
        u.full_name as farmerName,
        ua.url as farmerAvatar,
        pl.region as location,
        pl.woreda,
        pl.unit,
        pl.currency,
        u.id as farmer_user_id,
        u.phone as farmer_phone
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN user_avatars ua ON u.id = ua.user_id
      WHERE pl.status = 'active'
      AND pl.quantity > 0
      ORDER BY pl.created_at DESC
      LIMIT 100
    `;

    const [listings] = await pool.query(listingsQuery);
    
    // Get all images for these listings
    const listingIds = listings.map(l => l.id);
    let images = [];
    let reviewStatsByListing = {};
    
    if (listingIds.length > 0) {
      const imagesQuery = `
        SELECT listing_id, url, sort_order
        FROM listing_images
        WHERE listing_id IN (${listingIds.map(() => '?').join(',')})
        ORDER BY listing_id, sort_order
      `;
      
      const [imageRows] = await pool.query(imagesQuery, listingIds);
      images = imageRows;

      // Fetch review aggregates per listing
      const reviewsQuery = `
        SELECT listing_id, AVG(rating) AS avg_rating, COUNT(*) AS total_reviews
        FROM reviews
        WHERE listing_id IN (${listingIds.map(() => '?').join(',')})
        GROUP BY listing_id
      `;
      const [reviewRows] = await pool.query(reviewsQuery, listingIds);
      reviewStatsByListing = reviewRows.reduce((acc, row) => {
        acc[row.listing_id] = {
          avg_rating: Number(row.avg_rating || 0),
          total_reviews: Number(row.total_reviews || 0)
        };
        return acc;
      }, {});
    }
    
    // Group images by listing_id
    const imagesByListing = {};
    images.forEach(img => {
      if (!imagesByListing[img.listing_id]) {
        imagesByListing[img.listing_id] = [];
      }
      imagesByListing[img.listing_id].push(normalizeImageUrl(req, img.url));
    });
    
    // Add images and farmer info to listings
    const listingsWithImages = listings.map(listing => {
      const stats = reviewStatsByListing[listing.id] || { avg_rating: 0, total_reviews: 0 };
      return {
        ...listing,
        averageRating: stats.avg_rating,
        reviewCount: stats.total_reviews,
        image: imagesByListing[listing.id]?.[0] || null,
        images: imagesByListing[listing.id] || [],
        farmer: {
          name: listing.farmerName,
          avatar: listing.farmerAvatar || '/public/assets/images/no_image.png',
          location: listing.location,
          phone: listing.farmer_phone,
          rating: stats.avg_rating,
          reviewCount: stats.total_reviews,
          isVerified: false // Default verification status
        }
      };
    });
    
    const queryTime = Date.now() - startTime;
    console.log(`Active listings query took ${queryTime}ms, returned ${listingsWithImages.length} results`);
    
    res.json({
      success: true,
      count: listingsWithImages.length,
      listings: listingsWithImages,
      queryTime: queryTime
    });
  } catch (error) {
    console.error('Error fetching active listings:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch listings',
      details: error.message 
    });
  }
};

// Get listing by ID
export const getListingById = async (req, res) => {
  try {
    const { id } = req.params;

    // First get the listing with farmer details
    const listingQuery = `
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as nameAm,
        pl.description,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.crop as category,
        pl.status,
        pl.created_at as createdAt,
        pl.updated_at as updatedAt,
        pl.region as location,
        pl.unit,
        pl.currency,
        u.full_name as farmerName,
        u.phone as farmerPhone,
        u.email as farmerEmail,
        u.region as farmerRegion,
        u.woreda as farmerWoreda,
        ua.url as farmerAvatar,
        fp.farm_name,
        fp.experience_years,
        fp.certifications,
        fp.crops
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN user_avatars ua ON u.id = ua.user_id
      LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
      WHERE pl.id = ?
    `;

    const [listingRows] = await pool.query(listingQuery, [id]);

    if (listingRows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = listingRows[0];

    // Get all images for this listing
    const imagesQuery = `
      SELECT url, sort_order
      FROM listing_images
      WHERE listing_id = ?
      ORDER BY sort_order
    `;

    const [imageRows] = await pool.query(imagesQuery, [id]);
    const images = imageRows.map(img => normalizeImageUrl(req, img.url));

    // Get review stats for this listing
    const [statsRows] = await pool.query(
      `SELECT AVG(rating) AS avg_rating, COUNT(*) AS total_reviews FROM reviews WHERE listing_id = ?`,
      [id]
    );
    const avgRating = Number(statsRows?.[0]?.avg_rating || 0);
    const totalReviews = Number(statsRows?.[0]?.total_reviews || 0);

    // Add images, farmer info, and aggregated review stats to listing
    const listingWithImages = {
      ...listing,
      averageRating: avgRating,
      reviewCount: totalReviews,
      image: images[0] || null,
      images: images,
      farmer: {
        name: listing.farmerName,
        avatar: listing.farmerAvatar || '/public/assets/images/no_image.png',
        location: listing.farmerRegion,
        phone: listing.farmerPhone,
        email: listing.farmerEmail,
        farmName: listing.farm_name,
        experienceYears: listing.experience_years,
        certifications: listing.certifications,
        crops: listing.crops,
        rating: avgRating,
        reviewCount: totalReviews,
        isVerified: !!listing.certifications
      }
    };

    res.json(listingWithImages);
  } catch (error) {
    console.error('Error fetching listing by ID:', error);
    res.status(500).json({ error: 'Failed to fetch listing' });
  }
};

// Search listings with filters
export const searchListings = async (req, res) => {
  try {
    const {
      query: searchQuery,
      category,
      region,
      minPrice,
      maxPrice,
      sortBy = 'newest',
      limit = 20,
      offset = 0
    } = req.query;

    let whereClause = 'WHERE pl.status = "active" AND pl.quantity > 0';
    const params = [];

    // Search query filter
    if (searchQuery) {
      whereClause += ' AND (pl.title LIKE ? OR pl.crop LIKE ? OR pl.region LIKE ?)';
      const searchPattern = `%${searchQuery}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Category filter
    if (category && category !== 'all') {
      whereClause += ' AND pl.crop = ?';
      params.push(category);
    }

    // Region filter
    if (region && region !== 'all') {
      whereClause += ' AND pl.region = ?';
      params.push(region);
    }

    // Price range filter
    if (minPrice) {
      whereClause += ' AND pl.price_per_unit >= ?';
      params.push(Number(minPrice));
    }
    if (maxPrice) {
      whereClause += ' AND pl.price_per_unit <= ?';
      params.push(Number(maxPrice));
    }

    // Sorting
    let orderClause = 'ORDER BY ';
    switch (sortBy) {
      case 'price-low':
        orderClause += 'pl.price_per_unit ASC';
        break;
      case 'price-high':
        orderClause += 'pl.price_per_unit DESC';
        break;
      case 'oldest':
        orderClause += 'pl.created_at ASC';
        break;
      case 'newest':
      default:
        orderClause += 'pl.created_at DESC';
        break;
    }

    const sql = `
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as nameAm,
        pl.description,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.crop as category,
        li.url as image,
        pl.status,
        pl.created_at as createdAt,
        pl.updated_at as updatedAt,
        u.full_name as farmerName,
        u.avatar_url as farmerAvatar,
        pl.region as location,
        pl.unit,
        pl.currency
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    params.push(Number(limit), Number(offset));

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (error) {
    console.error('Error searching listings:', error);
    res.status(500).json({ error: 'Failed to search listings' });
  }
};

// Get listings by category
export const getListingsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const query = `
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as nameAm,
        pl.description,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.crop as category,
        li.url as image,
        pl.status,
        pl.created_at as createdAt,
        pl.updated_at as updatedAt,
        u.full_name as farmerName,
        u.avatar_url as farmerAvatar,
        pl.region as location,
        pl.unit,
        pl.currency
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
      WHERE pl.crop = ?
      AND pl.status = 'active'
      AND pl.quantity > 0
      ORDER BY pl.created_at DESC
    `;

    const [rows] = await pool.query(query, [category]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching listings by category:', error);
    res.status(500).json({ error: 'Failed to fetch listings by category' });
  }
};

// Get listings by region
export const getListingsByRegion = async (req, res) => {
  try {
    const { region } = req.params;

    const query = `
      SELECT
        pl.id,
        pl.title as name,
        pl.crop as nameAm,
        pl.description,
        pl.price_per_unit as pricePerKg,
        pl.quantity as availableQuantity,
        pl.crop as category,
        li.url as image,
        pl.status,
        pl.created_at as createdAt,
        pl.updated_at as updatedAt,
        u.full_name as farmerName,
        u.avatar_url as farmerAvatar,
        pl.region as location,
        pl.unit,
        pl.currency
      FROM produce_listings pl
      JOIN users u ON pl.farmer_user_id = u.id
      LEFT JOIN listing_images li ON pl.id = li.listing_id AND li.sort_order = 0
      WHERE pl.region = ?
      AND pl.status = 'active'
      AND pl.quantity > 0
      ORDER BY pl.created_at DESC
    `;

    const [rows] = await pool.query(query, [region]);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching listings by region:', error);
    res.status(500).json({ error: 'Failed to fetch listings by region' });
  }
};

// Admin: Get all listings with filters and pagination
export const getAllListingsAdmin = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { status, search, category, region, limit = 50, offset = 0 } = req.query;

    // Enforce role-based access
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ?",
      [uid]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userRole = userRows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    // Build dynamic filters
    let whereClause = "1=1";
    const params = [];

    if (status && status !== 'all') {
      whereClause += " AND pl.status = ?";
      params.push(status);
    }

    if (category && category !== 'all') {
      whereClause += " AND pl.crop = ?";
      params.push(category);
    }

    if (region && region !== 'all') {
      whereClause += " AND pl.region = ?";
      params.push(region);
    }

    if (search) {
      whereClause += " AND (pl.title LIKE ? OR pl.crop LIKE ? OR u.full_name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    // Main query
    const [rows] = await pool.query(
      `SELECT
        pl.id,
        pl.title,
        pl.crop,
        pl.description,
        pl.price_per_unit,
        pl.quantity,
        pl.unit,
        pl.currency,
        pl.status,
        pl.created_at,
        pl.updated_at,
        pl.region,
        pl.woreda,
        u.full_name AS farmer_name,
        ua.url AS farmer_avatar,
        (
          SELECT COUNT(*) FROM order_items oi
          WHERE oi.listing_id = pl.id
        ) AS orders_count,
        (
          SELECT li.url FROM listing_images li
          WHERE li.listing_id = pl.id
          ORDER BY li.sort_order ASC
          LIMIT 1
        ) AS image
       FROM produce_listings pl
       JOIN users u ON pl.farmer_user_id = u.id
       LEFT JOIN user_avatars ua ON u.id = ua.user_id
       WHERE ${whereClause}
       ORDER BY pl.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, Number(limit), Number(offset)]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM produce_listings pl
       JOIN users u ON pl.farmer_user_id = u.id
       WHERE ${whereClause}`,
      params
    );

    res.json({ listings: rows, total: countRows[0]?.total || 0, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error('Error fetching admin listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

// Admin: Update listing status (suspend/activate/etc.)
export const adminUpdateListingStatus = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { id } = req.params;
    const { status } = req.body;

    if (!id || !status) {
      return res.status(400).json({ error: "Listing id and status are required" });
    }

    // Enforce role-based access
    const [userRows] = await pool.query(
      "SELECT id, role FROM users WHERE firebase_uid = ?",
      [uid]
    );
    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }
    const userRole = userRows[0].role;
    if (userRole !== 'admin') {
      return res.status(403).json({ error: "Access denied. Admin role required." });
    }

    // Detect allowed enum values for status column
    const [[colInfo]] = await pool.query(
      `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'status'`
    );
    let allowedStatuses = [];
    if (colInfo && typeof colInfo.COLUMN_TYPE === 'string' && colInfo.COLUMN_TYPE.startsWith('enum(')) {
      allowedStatuses = colInfo.COLUMN_TYPE
        .slice(5, -1)
        .split(',')
        .map(s => s.trim().replace(/^'(.*)'$/, '$1'));
    }
    if (!allowedStatuses.length) {
      allowedStatuses = ['active', 'expired', 'pending', 'rejected', 'sold_out'];
    }

    // Map requested status to supported value in enum
    let targetStatus = status;
    if (!allowedStatuses.includes(targetStatus)) {
      if (status === 'suspended') {
        targetStatus = allowedStatuses.includes('expired') ? 'expired' : (allowedStatuses.find(s => s !== 'active') || 'active');
      } else if (status === 'active') {
        targetStatus = allowedStatuses.includes('active') ? 'active' : allowedStatuses[0];
      } else {
        return res.status(400).json({ error: `Invalid status. Allowed: ${allowedStatuses.join(', ')}` });
      }
    }

    // Fetch listing and owner
    const [listings] = await pool.query(
      `SELECT pl.id, pl.farmer_user_id, pl.status, pl.title
       FROM produce_listings pl
       WHERE pl.id = ?`,
      [id]
    );
    if (listings.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Update status
    await pool.query(
      `UPDATE produce_listings SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [targetStatus, id]
    );

    // Notify listing owner about status change
    try {
      const ownerUserId = listings[0].farmer_user_id;
      const listingTitle = listings[0].title;
      const notificationType = targetStatus === 'active' ? 'listing_activated' : 'listing_suspended';
      const payload = {
        title: notificationType === 'listing_activated' ? 'Listing Activated' : 'Listing Suspended',
        message: notificationType === 'listing_activated'
          ? 'Your listing has been reactivated by an administrator.'
          : 'Your listing has been suspended by an administrator.',
        listingId: Number(id),
        listingTitle,
        action: 'view_listing'
      };
      await pool.query(
        `INSERT INTO notifications (user_id, type, payload, is_read)
         VALUES (?, ?, ?, 0)`,
        [ownerUserId, notificationType, JSON.stringify(payload)]
      );
    } catch (e) {
      console.error('Failed to create listing status notification:', e);
    }

    res.json({ message: "Listing status updated", id: Number(id), status: targetStatus });
  } catch (error) {
    console.error('Error updating listing status (admin):', error);
    res.status(500).json({ error: 'Failed to update listing status' });
  }
};

// Create new listing
export const createListing = async (req, res) => {
  try {
    const uid = req.user.uid;
    const {
      title, crop, variety, quantity, unit, pricePerUnit, currency,
      availableFrom, availableUntil, region, woreda, description
    } = req.body;

    // Get user ID - handle both Firebase and dev users
    let userId, userRole;

    if (uid.startsWith('dev-uid-')) {
      // Dev user - use the ID from the token
      userId = req.user.id;
      userRole = req.user.role;
    } else {
      // Real Firebase user - look up in database
      const [userRows] = await pool.query(
        "SELECT id, role FROM users WHERE firebase_uid = ?",
        [uid]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      userId = userRows[0].id;
      userRole = userRows[0].role;
    }

    if (userRole !== 'farmer') {
      return res.status(403).json({ error: "Only farmers can create listings" });
    }

    // Insert listing
    const [result] = await pool.query(
      `INSERT INTO produce_listings (
        farmer_user_id, title, crop, variety, quantity, unit,
        price_per_unit, currency, available_from, available_until,
        region, woreda, description, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [
        userId, title, crop, variety, quantity, unit, pricePerUnit,
        currency, availableFrom, availableUntil, region, woreda, description
      ]
    );

    const listingId = result.insertId;

    res.status(201).json({
      id: listingId,
      message: "Listing created successfully",
      listing: {
        id: listingId,
        title,
        crop,
        variety,
        quantity,
        unit,
        pricePerUnit,
        currency,
        availableFrom,
        availableUntil,
        region,
        woreda,
        description,
        status: 'active'
      }
    });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: "Failed to create listing" });
  }
};

// Get listings with filtering and pagination
export const getListings = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      crop,
      region,
      woreda,
      minPrice,
      maxPrice,
      verifiedOnly = false,
      status = 'active',
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    const validSortFields = ['created_at', 'price_per_unit', 'quantity', 'title'];
    const validSortOrders = ['ASC', 'DESC'];

    if (!validSortFields.includes(sortBy)) sortBy = 'created_at';
    if (!validSortOrders.includes(sortOrder.toUpperCase())) sortOrder = 'DESC';

    let whereClause = "WHERE l.status = ?";
    let params = [status];

    if (crop) {
      whereClause += " AND l.crop LIKE ?";
      params.push(`%${crop}%`);
    }

    if (region) {
      whereClause += " AND l.region = ?";
      params.push(region);
    }

    if (woreda) {
      whereClause += " AND l.woreda = ?";
      params.push(woreda);
    }

    if (minPrice) {
      whereClause += " AND l.price_per_unit >= ?";
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      whereClause += " AND l.price_per_unit <= ?";
      params.push(parseFloat(maxPrice));
    }

    if (verifiedOnly) {
      whereClause += " AND u.id IN (SELECT user_id FROM farmer_profiles WHERE certifications IS NOT NULL)";
    }

    // Get listings with farmer info and avatar
    const [listings] = await pool.query(
      `SELECT
        l.*,
        u.full_name as farmer_name,
        u.phone as farmer_phone,
        u.region as farmer_region,
        u.woreda as farmer_woreda,
        fp.farm_name,
        fp.experience_years,
        fp.certifications,
        ua.url as farmer_avatar
      FROM produce_listings l
      JOIN users u ON l.farmer_user_id = u.id
      LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
      LEFT JOIN user_avatars ua ON u.id = ua.user_id
      ${whereClause}
      ORDER BY l.${sortBy} ${sortOrder}
      LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    // Get total count for pagination
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM produce_listings l
       JOIN users u ON l.farmer_user_id = u.id
       LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
       LEFT JOIN user_avatars ua ON u.id = ua.user_id
       ${whereClause}`,
      params
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    // Process listings to include farmer information in expected format
    const processedListings = listings.map(listing => ({
      ...listing,
      farmer: {
        name: listing.farmer_name,
        avatar: listing.farmer_avatar || '/public/assets/images/no_image.png',
        location: listing.farmer_region,
        phone: listing.farmer_phone,
        farmName: listing.farm_name,
        experienceYears: listing.experience_years,
        certifications: listing.certifications,
        rating: 4.5, // Default rating - you can implement actual rating system later
        reviewCount: 0, // Default review count - you can implement actual review system later
        isVerified: !!listing.certifications
      }
    }));

    res.json({
      listings: processedListings,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        total,
        limit: parseInt(limit),
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
};

// Update a listing
export const updateListing = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;
    const updateData = req.body;

    // Verify user owns the listing
    const [listings] = await pool.query(
      `SELECT l.*, u.firebase_uid, u.id as user_id
       FROM produce_listings l
       JOIN users u ON l.farmer_user_id = u.id
       WHERE l.id = ?`,
      [id]
    );

    if (listings.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Check authorization - handle both Firebase and dev users
    let isAuthorized = false;

    if (uid.startsWith('dev-uid-')) {
      // Dev user - check if the user ID matches
      isAuthorized = (req.user.id === listings[0].user_id);
    } else {
      // Real Firebase user - check firebase_uid
      isAuthorized = (listings[0].firebase_uid === uid);
    }

    if (!isAuthorized) {
      return res.status(403).json({ error: "Not authorized to update this listing" });
    }

    // Build update query dynamically
    const allowedFields = [
      'title', 'crop', 'variety', 'quantity', 'unit', 'price_per_unit',
      'currency', 'available_from', 'available_until', 'region', 'woreda',
      'description', 'status'
    ];

    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(id);

    await pool.query(
      `UPDATE produce_listings SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({ message: "Listing updated successfully" });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: "Failed to update listing" });
  }
};

// Delete a listing
export const deleteListing = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { id } = req.params;

    // Verify user owns the listing
    const [listings] = await pool.query(
      `SELECT l.*, u.firebase_uid
       FROM produce_listings l
       JOIN users u ON l.farmer_user_id = u.id
       WHERE l.id = ?`,
      [id]
    );

    if (listings.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    if (listings[0].firebase_uid !== uid) {
      return res.status(403).json({ error: "Not authorized to delete this listing" });
    }

    // Check if listing has active orders
    const [orders] = await pool.query(
      "SELECT COUNT(*) as count FROM order_items WHERE listing_id = ?",
      [id]
    );

    if (orders[0].count > 0) {
      return res.status(400).json({
        error: "Cannot delete listing with active orders. Consider setting status to 'expired' instead."
      });
    }

    // Delete listing images first
    await pool.query("DELETE FROM listing_images WHERE listing_id = ?", [id]);

    // Delete the listing
    await pool.query("DELETE FROM produce_listings WHERE id = ?", [id]);

    res.json({ message: "Listing deleted successfully" });
  } catch (error) {
    console.error('Error deleting listing:', error);
    res.status(500).json({ error: "Failed to delete listing" });
  }
};

// Get farmer's listings
export const getFarmerListings = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { status } = req.query;

    // Get user ID
    const [userRows] = await pool.query(
      "SELECT id FROM users WHERE firebase_uid = ?",
      [uid]
    );

    if (userRows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const userId = userRows[0].id;
    let whereClause = "WHERE farmer_user_id = ?";
    let params = [userId];

    if (status) {
      whereClause += " AND status = ?";
      params.push(status);
    }

    const [listings] = await pool.query(
      `SELECT * FROM produce_listings ${whereClause} ORDER BY created_at DESC`,
      params
    );

    res.json({ listings });
  } catch (error) {
    console.error('Error fetching farmer listings:', error);
    res.status(500).json({ error: "Failed to fetch listings" });
  }
};


