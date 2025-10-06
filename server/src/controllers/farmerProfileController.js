import { pool } from '../config/database.js';

// Helper to safely parse array-like JSON fields that may be stored as plain strings
function parseArrayField(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '' || trimmed.toLowerCase() === 'null') return null;
    // If it's a comma-separated list, split into array
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    }
    // Attempt JSON parse only if it looks like JSON
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { return JSON.parse(trimmed); } catch (_) { /* fall through */ }
    }
    // Fallback: treat single scalar string (e.g., "wheat") as ["wheat"]
    return [trimmed];
  }
  try {
    return JSON.parse(value);
  } catch (_) {
    return null;
  }
}

// Helper to serialize arrays as plain strings for DB storage
function serializeArrayField(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.length === 1) return String(value[0]).trim() || null;
    return value.map(v => String(v).trim()).filter(Boolean).join(',');
  }
  // Already a string
  const s = String(value).trim();
  return s === '' ? null : s;
}

// Get farmer profile with enhanced details
export const getFarmerProfile = async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    
    // Get farmer profile with all details
    const [profileRows] = await pool.query(
      `SELECT 
        fp.*,
        u.full_name,
        u.email,
        u.phone,
        u.region,
        u.woreda,
        COALESCE((
          SELECT AVG(r.rating) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as avg_rating,
        COALESCE((
          SELECT COUNT(*) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as review_count,
        u.created_at as member_since
       FROM farmer_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.user_id = ?`,
      [userId]
    );
    
    if (profileRows.length === 0) {
      // Create empty profile if it doesn't exist
      await pool.query(
        'INSERT INTO farmer_profiles (user_id) VALUES (?)',
        [userId]
      );
      
      // Return empty profile
      return res.json({
        user_id: userId,
        farm_name: null,
        farm_size_ha: null,
        farm_size_unit: 'hectares',
        certifications: null,
        crops: null,
        experience_years: null,
        address: null,
        farming_methods: null,
        seasonal_availability: 'year-round',
        business_hours_start: null,
        business_hours_end: null,
        farm_description: null,
        farm_description_am: null,
        specializations: null,
        equipment: null,
        irrigation_type: null,
        soil_type: null,
        organic_certified: false,
        fair_trade_certified: false,
        gmo_free: true,
        sustainability_practices: null,
        full_name: null,
        email: null,
        phone: null,
        region: null,
        woreda: null,
        avg_rating: null,
        review_count: 0,
        member_since: null
      });
    }
    
    const profile = profileRows[0];
    
    // Parse JSON fields
    const parsedProfile = {
      ...profile,
      certifications: parseArrayField(profile.certifications),
      crops: parseArrayField(profile.crops),
      farming_methods: parseArrayField(profile.farming_methods),
      specializations: parseArrayField(profile.specializations),
      equipment: parseArrayField(profile.equipment),
      sustainability_practices: parseArrayField(profile.sustainability_practices)
    };
    
    res.json(parsedProfile);
  } catch (error) {
    console.error('Error fetching farmer profile:', error);
    res.status(500).json({ error: 'Failed to fetch farmer profile' });
  }
};

// Update farmer profile
export const updateFarmerProfile = async (req, res) => {
  try {
    console.log('DEBUG: updateFarmerProfile called');
    console.log('DEBUG: Request body:', req.body);
    console.log('DEBUG: User:', req.user);
    
    const uid = req.user.uid;
    const {
      farm_name,
      farm_size_ha,
      farm_size_unit,
      certifications,
      crops,
      experience_years,
      address,
      farming_methods,
      seasonal_availability,
      business_hours_start,
      business_hours_end,
      farm_description,
      farm_description_am,
      specializations,
      equipment,
      irrigation_type,
      soil_type,
      organic_certified,
      fair_trade_certified,
      gmo_free,
      sustainability_practices
    } = req.body;
    
    // Get user ID from firebase_uid
    console.log('DEBUG: Looking for user with firebase_uid:', uid);
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    console.log('DEBUG: User query result:', userRows);
    
    if (userRows.length === 0) {
      console.log('DEBUG: User not found in database');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    console.log('DEBUG: User ID:', userId);
    
    // Check if profile exists
    const [existingProfile] = await pool.query(
      'SELECT user_id FROM farmer_profiles WHERE user_id = ?',
      [userId]
    );
    
    console.log('DEBUG: Existing profile found:', existingProfile.length > 0);
    
    if (existingProfile.length === 0) {
      console.log('DEBUG: Creating new profile');
      // Create new profile
      await pool.query(
        `INSERT INTO farmer_profiles (
          user_id, farm_name, farm_size_ha, farm_size_unit, certifications, crops,
          experience_years, address, farming_methods, seasonal_availability,
          business_hours_start, business_hours_end, farm_description, farm_description_am,
          specializations, equipment, irrigation_type, soil_type, organic_certified,
          fair_trade_certified, gmo_free, sustainability_practices
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, farm_name, farm_size_ha, farm_size_unit,
          serializeArrayField(certifications),
          serializeArrayField(crops),
          experience_years, address,
          serializeArrayField(farming_methods),
          seasonal_availability, business_hours_start, business_hours_end,
          farm_description, farm_description_am,
          serializeArrayField(specializations),
          serializeArrayField(equipment),
          irrigation_type, soil_type, organic_certified, fair_trade_certified,
          gmo_free, serializeArrayField(sustainability_practices)
        ]
      );
    } else {
      console.log('DEBUG: Updating existing profile');
      // Update existing profile
      await pool.query(
        `UPDATE farmer_profiles SET
          farm_name = ?,
          farm_size_ha = ?,
          farm_size_unit = ?,
          certifications = ?,
          crops = ?,
          experience_years = ?,
          address = ?,
          farming_methods = ?,
          seasonal_availability = ?,
          business_hours_start = ?,
          business_hours_end = ?,
          farm_description = ?,
          farm_description_am = ?,
          specializations = ?,
          equipment = ?,
          irrigation_type = ?,
          soil_type = ?,
          organic_certified = ?,
          fair_trade_certified = ?,
          gmo_free = ?,
          sustainability_practices = ?,
          updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?`,
        [
          farm_name, farm_size_ha, farm_size_unit,
          serializeArrayField(certifications),
          serializeArrayField(crops),
          experience_years, address,
          serializeArrayField(farming_methods),
          seasonal_availability, business_hours_start, business_hours_end,
          farm_description, farm_description_am,
          serializeArrayField(specializations),
          serializeArrayField(equipment),
          irrigation_type, soil_type, organic_certified, fair_trade_certified,
          gmo_free, serializeArrayField(sustainability_practices),
          userId
        ]
      );
      console.log('DEBUG: Profile update query executed');
    }
    
    console.log('DEBUG: Returning updated profile');
    // Return updated profile
    const [updatedProfile] = await pool.query(
      `SELECT 
        fp.*,
        u.full_name,
        u.email,
        u.phone,
        u.region,
        u.woreda,
        COALESCE((
          SELECT AVG(r.rating) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as avg_rating,
        COALESCE((
          SELECT COUNT(*) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as review_count,
        u.created_at as member_since
       FROM farmer_profiles fp
       JOIN users u ON fp.user_id = u.id
       WHERE fp.user_id = ?`,
      [userId]
    );
    
    const profile = updatedProfile[0];
    const parsedProfile = {
      ...profile,
      certifications: parseArrayField(profile.certifications),
      crops: parseArrayField(profile.crops),
      farming_methods: parseArrayField(profile.farming_methods),
      specializations: parseArrayField(profile.specializations),
      equipment: parseArrayField(profile.equipment),
      sustainability_practices: parseArrayField(profile.sustainability_practices)
    };
    
    res.json(parsedProfile);
  } catch (error) {
    console.error('Error updating farmer profile:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Failed to update farmer profile', details: error.message });
  }
};

// Get farmer profile statistics
export const getFarmerProfileStats = async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    
    // Get comprehensive statistics
    const [stats] = await pool.query(
      `SELECT 
        -- Profile completion (0-100), considering empty strings as incomplete and verification docs
        LEAST(100,
          (
            -- Base profile fields worth 70 points total
            (
              (CASE WHEN NULLIF(TRIM(fp.farm_name), '') IS NOT NULL THEN 17.5 ELSE 0 END) +
              (CASE WHEN NULLIF(TRIM(fp.farm_size_ha), '') IS NOT NULL THEN 17.5 ELSE 0 END) +
              (CASE WHEN NULLIF(TRIM(fp.crops), '') IS NOT NULL THEN 17.5 ELSE 0 END) +
              (CASE WHEN NULLIF(TRIM(fp.farming_methods), '') IS NOT NULL THEN 17.5 ELSE 0 END)
            )
            +
            -- Verification docs: national-id (required) and land-certificate (required) worth 30 points total
            (
              (CASE WHEN EXISTS (
                SELECT 1 FROM verification_documents vd 
                WHERE vd.user_id = u.id AND vd.document_type = 'national-id' AND vd.status = 'verified'
              ) THEN 15 ELSE 0 END)
              +
              (CASE WHEN EXISTS (
                SELECT 1 FROM verification_documents vd 
                WHERE vd.user_id = u.id AND vd.document_type = 'land-certificate' AND vd.status = 'verified'
              ) THEN 15 ELSE 0 END)
            )
          )
        ) as profile_completion,
        
        -- Business metrics
        COUNT(DISTINCT pl.id) as total_listings,
        COUNT(DISTINCT CASE WHEN pl.status = 'active' THEN pl.id END) as active_listings,
        COUNT(DISTINCT o.id) as total_orders,
        COUNT(DISTINCT CASE WHEN o.status = 'completed' THEN o.id END) as completed_orders,
        COALESCE(SUM(CASE WHEN o.status = 'completed' THEN o.total ELSE 0 END), 0) as total_earnings,
        COALESCE(AVG(CASE WHEN o.status = 'completed' THEN o.total END), 0) as avg_order_value,
        
        -- Rating and reviews (calculated on the fly)
        COALESCE((
          SELECT AVG(r.rating) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as avg_rating,
        COALESCE((
          SELECT COUNT(*) 
          FROM reviews r 
          JOIN produce_listings pl ON r.listing_id = pl.id 
          WHERE pl.farmer_user_id = u.id
        ), 0) as review_count,
        
        -- Profile details
        fp.experience_years,
        fp.organic_certified,
        fp.fair_trade_certified,
        fp.gmo_free,
        fp.farm_size_ha,
        fp.farm_size_unit
        
       FROM users u
       LEFT JOIN farmer_profiles fp ON u.id = fp.user_id
       LEFT JOIN produce_listings pl ON u.id = pl.farmer_user_id
       LEFT JOIN orders o ON u.id = o.farmer_user_id
       WHERE u.id = ?
       GROUP BY u.id, fp.farm_name, fp.farm_size_ha, fp.crops, fp.farming_methods, 
                fp.experience_years, fp.organic_certified, fp.fair_trade_certified, 
                fp.gmo_free, fp.farm_size_unit`,
      [userId]
    );
    
    const [recentActivity] = await pool.query(
      `SELECT 
        'listing' as type,
        pl.title as title,
        pl.created_at as created_at,
        pl.status as status
       FROM produce_listings pl
       WHERE pl.farmer_user_id = ?
       
       UNION ALL
       
       SELECT 
        'order' as type,
        CONCAT('Order #', o.id) as title,
        o.created_at as created_at,
        o.status as status
       FROM orders o
       WHERE o.farmer_user_id = ?
       
       ORDER BY created_at DESC
       LIMIT 10`,
      [userId, userId]
    );
    
    res.json({
      stats: stats[0] || {
        profile_completion: 0,
        total_listings: 0,
        active_listings: 0,
        total_orders: 0,
        completed_orders: 0,
        total_earnings: 0,
        avg_order_value: 0,
        avg_rating: 0,
        review_count: 0,
        experience_years: 0,
        organic_certified: false,
        fair_trade_certified: false,
        gmo_free: true,
        farm_size_ha: 0,
        farm_size_unit: 'hectares'
      },
      recent_activity: recentActivity
    });
  } catch (error) {
    console.error('Error fetching farmer profile stats:', error);
    res.status(500).json({ error: 'Failed to fetch farmer profile statistics' });
  }
};

// Upload certification document
export const uploadCertification = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    const uid = req.user.uid;
    const { certification_type, certification_body, issue_date, expiry_date } = req.body;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    
    // Create certifications table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS farmer_certifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        farmer_id BIGINT NOT NULL,
        certification_type VARCHAR(255) NOT NULL,
        certification_body VARCHAR(255) NOT NULL,
        document_url VARCHAR(1024) NOT NULL,
        issue_date DATE NULL,
        expiry_date DATE NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX (farmer_id),
        CONSTRAINT fk_certification_farmer FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    
    const documentUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    
    // Insert certification record
    const [result] = await pool.query(
      `INSERT INTO farmer_certifications 
       (farmer_id, certification_type, certification_body, document_url, issue_date, expiry_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, certification_type, certification_body, documentUrl, issue_date, expiry_date]
    );
    
    res.status(201).json({
      message: 'Certification uploaded successfully',
      certification_id: result.insertId,
      document_url: documentUrl
    });
  } catch (error) {
    console.error('Error uploading certification:', error);
    res.status(500).json({ error: 'Failed to upload certification' });
  }
};

// Get farmer certifications
export const getFarmerCertifications = async (req, res) => {
  try {
    const uid = req.user.uid;
    
    // Get user ID from firebase_uid
    const [userRows] = await pool.query(
      'SELECT id FROM users WHERE firebase_uid = ?',
      [uid]
    );
    
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userRows[0].id;
    
    // Check if certifications table exists
    const [tableExists] = await pool.query(
      "SHOW TABLES LIKE 'farmer_certifications'"
    );
    
    if (tableExists.length === 0) {
      return res.json([]);
    }
    
    const [certifications] = await pool.query(
      `SELECT * FROM farmer_certifications 
       WHERE farmer_id = ? 
       ORDER BY created_at DESC`,
      [userId]
    );
    
    res.json(certifications);
  } catch (error) {
    console.error('Error fetching certifications:', error);
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
};
