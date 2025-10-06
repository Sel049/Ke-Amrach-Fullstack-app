import { pool } from '../config/database.js';

export const upsertUser = async (req, res) => {
  const uid = req.user.uid;
  const { role, fullName, phoneNumber, email, region, woreda } = req.body || {};
  await pool.query(
    `INSERT INTO users (firebase_uid, role, full_name, phone, email, region, woreda)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role=VALUES(role), full_name=VALUES(full_name), phone=VALUES(phone), email=VALUES(email), region=VALUES(region), woreda=VALUES(woreda)`,
    [uid, role || "buyer", fullName || null, phoneNumber || null, email || null, region || null, woreda || null]
  );
  res.json({ ok: true });
};

export const getMe = async (req, res) => {
  const uid = req.user.uid;
  // Ensure avatars table exists to avoid errors on first run
  await pool.query(`CREATE TABLE IF NOT EXISTS user_avatars (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    url VARCHAR(1024) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX (user_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  // Ensure buyer_profiles table exists for business details
  await pool.query(`CREATE TABLE IF NOT EXISTS buyer_profiles (
    user_id BIGINT NOT NULL PRIMARY KEY,
    company_name VARCHAR(255) NULL,
    business_type ENUM('retailer','wholesaler','restaurant','individual','other') NULL,
    preferred_crops JSON NULL,
    address TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_buyer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const [rows] = await pool.query(
    `SELECT u.*, 
       (SELECT ua.url FROM user_avatars ua WHERE ua.user_id = u.id ORDER BY ua.updated_at DESC LIMIT 1) AS avatar_url,
       bp.company_name, bp.business_type, bp.preferred_crops, bp.address,
       bp.purchase_volume, bp.preferred_suppliers, bp.delivery_preference
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     WHERE u.firebase_uid = ?`,
    [uid]
  );
  if (rows.length === 0) return res.status(404).json({ error: "Profile not found" });
  const row = rows[0];
  res.json({
    id: row.id,
    firebaseUid: row.firebase_uid,
    role: row.role,
    fullName: row.full_name,
    phoneNumber: row.phone,
    email: row.email,
    region: row.region,
    woreda: row.woreda,
    avatarUrl: row.avatar_url || null,
    companyName: row.company_name || null,
    businessType: row.business_type || null,
    preferredCrops: row.preferred_crops ? JSON.parse(row.preferred_crops) : null,
    address: row.address || null,
    purchaseVolume: row.purchase_volume || null,
    preferredSuppliers: row.preferred_suppliers || null,
    deliveryPreference: row.delivery_preference || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
};

export const updateMe = async (req, res) => {
  const uid = req.user.uid;
  const { role, fullName, phoneNumber, email, region, woreda, companyName, businessType, preferredCrops, address, purchaseVolume, preferredSuppliers, deliveryPreference } = req.body || {};
  const [existing] = await pool.query("SELECT id FROM users WHERE firebase_uid = ?", [uid]);
  const toNullIfEmpty = (v) => (v === undefined || v === "" ? null : v);
  if (existing.length === 0) {
    // Create the profile row if it doesn't exist yet
    await pool.query(
      `INSERT INTO users (firebase_uid, role, full_name, phone, email, region, woreda)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        uid,
        toNullIfEmpty(role) || 'buyer',
        toNullIfEmpty(fullName),
        toNullIfEmpty(phoneNumber),
        toNullIfEmpty(email),
        toNullIfEmpty(region),
        toNullIfEmpty(woreda)
      ]
    );
  } else {
    await pool.query(
      `UPDATE users
       SET role = COALESCE(?, role),
           full_name = COALESCE(?, full_name),
           phone = COALESCE(?, phone),
           email = COALESCE(?, email),
           region = COALESCE(?, region),
           woreda = COALESCE(?, woreda)
       WHERE firebase_uid = ?`,
      [
        toNullIfEmpty(role),
        toNullIfEmpty(fullName),
        toNullIfEmpty(phoneNumber),
        toNullIfEmpty(email),
        toNullIfEmpty(region),
        toNullIfEmpty(woreda),
        uid,
      ]
    );
  }

  // Upsert buyer business details if provided (buyer_profiles)
  try {
    const [[userRow]] = await pool.query('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1', [uid]);
    const userId = userRow?.id;
    if (userId && (companyName !== undefined || businessType !== undefined || preferredCrops !== undefined || address !== undefined || purchaseVolume !== undefined || preferredSuppliers !== undefined || deliveryPreference !== undefined)) {
      console.log('DEBUG updateMe() - Saving buyer profile data:', {
        userId,
        companyName,
        businessType,
        preferredCrops,
        address,
        purchaseVolume,
        preferredSuppliers,
        deliveryPreference
      });
      await pool.query(`CREATE TABLE IF NOT EXISTS buyer_profiles (
        user_id BIGINT NOT NULL PRIMARY KEY,
        company_name VARCHAR(255) NULL,
        business_type ENUM('retailer','wholesaler','restaurant','individual','cooperative') NULL,
        preferred_crops JSON NULL,
        address TEXT NULL,
        purchase_volume ENUM('small','medium','large') NULL,
        preferred_suppliers ENUM('local-farmers','certified-organic','cooperatives','any') NULL,
        delivery_preference ENUM('pickup','delivery','both') NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_buyer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

      // Insert or update
      await pool.query(
        `INSERT INTO buyer_profiles (user_id, company_name, business_type, preferred_crops, address, purchase_volume, preferred_suppliers, delivery_preference)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE 
           company_name = COALESCE(VALUES(company_name), company_name),
           business_type = COALESCE(VALUES(business_type), business_type),
           preferred_crops = COALESCE(VALUES(preferred_crops), preferred_crops),
           address = COALESCE(VALUES(address), address),
           purchase_volume = COALESCE(VALUES(purchase_volume), purchase_volume),
           preferred_suppliers = COALESCE(VALUES(preferred_suppliers), preferred_suppliers),
           delivery_preference = COALESCE(VALUES(delivery_preference), delivery_preference)`,
        [
          userId,
          toNullIfEmpty(companyName),
          toNullIfEmpty(businessType),
          preferredCrops !== undefined ? JSON.stringify(preferredCrops) : null,
          toNullIfEmpty(address),
          toNullIfEmpty(purchaseVolume),
          toNullIfEmpty(preferredSuppliers),
          toNullIfEmpty(deliveryPreference)
        ]
      );
    }
  } catch (e) {
    // Non-fatal; log and continue
    console.error('buyer_profiles upsert failed:', e);
  }
  const [rows2] = await pool.query(
    `SELECT u.*, bp.company_name, bp.business_type, bp.preferred_crops, bp.address,
            bp.purchase_volume, bp.preferred_suppliers, bp.delivery_preference
     FROM users u
     LEFT JOIN buyer_profiles bp ON bp.user_id = u.id
     WHERE u.firebase_uid = ?`,
    [uid]
  );
  const row = rows2[0];
  
  // Debug logging for buyer profile data
  if (row.role === 'buyer') {
    console.log('DEBUG getMe() - Raw DB row for buyer:', {
      user_id: row.id,
      business_type: row.business_type,
      purchase_volume: row.purchase_volume,
      preferred_suppliers: row.preferred_suppliers,
      delivery_preference: row.delivery_preference
    });
  }
  
  const responseData = {
    id: row.id,
    firebaseUid: row.firebase_uid,
    role: row.role,
    fullName: row.full_name,
    phoneNumber: row.phone,
    email: row.email,
    region: row.region,
    woreda: row.woreda,
    avatarUrl: null,
    verificationStatus: row.verification_status || 'pending',
    companyName: row.company_name || null,
    businessType: row.business_type || null,
    preferredCrops: row.preferred_crops ? JSON.parse(row.preferred_crops) : null,
    address: row.address || null,
    purchaseVolume: row.purchase_volume || null,
    preferredSuppliers: row.preferred_suppliers || null,
    deliveryPreference: row.delivery_preference || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  
  if (row.role === 'buyer') {
    console.log('DEBUG getMe() - Response data for buyer:', {
      businessType: responseData.businessType,
      purchaseVolume: responseData.purchaseVolume,
      preferredSuppliers: responseData.preferredSuppliers,
      deliveryPreference: responseData.deliveryPreference
    });
  }
  
  res.json(responseData);
};

// Upload and save avatar URL for current user
export const uploadMyAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const uid = req.user.uid;
    const [[userRow]] = await pool.query('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1', [uid]);
    if (!userRow) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    const userId = userRow.id;

    // Ensure table exists (idempotent)
    await pool.query(`CREATE TABLE IF NOT EXISTS user_avatars (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      url VARCHAR(1024) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

    // Insert new avatar record
    await pool.query('INSERT INTO user_avatars (user_id, url) VALUES (?, ?)', [userId, imageUrl]);

    return res.status(201).json({ message: 'Avatar uploaded', avatarUrl: imageUrl });
  } catch (e) {
    console.error('uploadMyAvatar error:', e);
    return res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

// Admin: Get all users with optional filters and pagination
export const getAllUsers = async (req, res) => {
  try {
    const uid = req.user?.uid;
    const { role, search, status, limit = 50, offset = 0 } = req.query;

    // Enforce admin role
    const [me] = await pool.query('SELECT id, role FROM users WHERE firebase_uid = ? LIMIT 1', [uid]);
    if (me.length === 0) return res.status(404).json({ error: 'User not found' });
    if (me[0].role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });

    // Detect schema variants for safe SQL generation
    const [[hasBuyerUserIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_user_id'`
    );
    const [[hasBuyerIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'buyer_id'`
    );
    const [[hasFarmerUserIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_user_id'`
    );
    const [[hasFarmerIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'farmer_id'`
    );

    const hasBuyerUserId = Number(hasBuyerUserIdRow?.c || 0) > 0;
    const hasBuyerId = Number(hasBuyerIdRow?.c || 0) > 0;
    const hasFarmerUserId = Number(hasFarmerUserIdRow?.c || 0) > 0;
    const hasFarmerId = Number(hasFarmerIdRow?.c || 0) > 0;

    const [[hasPlFarmerUserIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'farmer_user_id'`
    );
    const [[hasPlFarmerIdRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'produce_listings' AND COLUMN_NAME = 'farmer_id'`
    );
    const plFarmerCol = Number(hasPlFarmerUserIdRow?.c || 0) > 0
      ? 'farmer_user_id'
      : (Number(hasPlFarmerIdRow?.c || 0) > 0 ? 'farmer_id' : null);

    // Build dynamic orders subquery WHERE clause
    const orderWhereParts = [];
    if (hasBuyerUserId) orderWhereParts.push('o.buyer_user_id = u.id');
    if (hasBuyerId) orderWhereParts.push('o.buyer_id = u.id');
    if (hasFarmerUserId) orderWhereParts.push('o.farmer_user_id = u.id');
    if (hasFarmerId) orderWhereParts.push('o.farmer_id = u.id');
    const ordersSubquery = orderWhereParts.length > 0
      ? `(SELECT COUNT(*) FROM orders o WHERE ${orderWhereParts.join(' OR ')})`
      : '0';

    let where = '1=1';
    const params = [];
    if (role && role !== 'all') {
      where += ' AND u.role = ?';
      params.push(role);
    }
    if (search) {
      where += ' AND (u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }
    // status placeholder (active/pending/suspended) if you later add a column

    const listingsSubquery = plFarmerCol
      ? `(SELECT COUNT(*) FROM produce_listings pl WHERE pl.${plFarmerCol} = u.id)`
      : '0';

    const sql = `SELECT
         u.id,
         u.full_name AS name,
         u.email,
         u.role,
         u.created_at AS joinDate,
         u.updated_at AS lastActive,
         ua.url AS avatar,
         ${listingsSubquery} AS listings,
         ${ordersSubquery} AS orders
       FROM users u
       LEFT JOIN user_avatars ua ON ua.user_id = u.id
       WHERE ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`;

    const [rows] = await pool.query(sql, [...params, Number(limit), Number(offset)]);

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM users u
       WHERE ${where}`,
      params
    );

    res.json({ users: rows, total: countRows[0]?.total || 0, limit: Number(limit), offset: Number(offset) });
  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
