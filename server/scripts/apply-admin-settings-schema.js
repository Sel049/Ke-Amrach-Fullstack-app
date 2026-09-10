import { pool } from '../src/config/database.js';

// Default settings mirrored from the Admin Settings UI.
// Typed values (booleans/numbers/strings) are stored as JSON so that
// JSON.parse on read preserves their native JS types.
const DEFAULT_SETTINGS = {
  general: {
    siteName: 'Ethio Farmers Shop',
    siteDescription: 'Connecting farmers with buyers across Ethiopia',
    defaultLanguage: 'en',
    timezone: 'Africa/Addis_Ababa',
    currency: 'ETB',
    maintenanceMode: false,
  },
  notifications: {
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    orderAlerts: true,
    userRegistrationAlerts: true,
    systemAlerts: true,
  },
  security: {
    twoFactorAuth: true,
    passwordMinLength: 8,
    sessionTimeout: 30,
    maxLoginAttempts: 5,
    ipWhitelist: false,
    auditLogging: true,
  },
  payment: {
    stripeEnabled: true,
    paypalEnabled: false,
    bankTransferEnabled: true,
    mobileMoneyEnabled: true,
    commissionRate: 5,
    minimumPayout: 1000,
  },
  features: {
    userRegistration: true,
    farmerVerification: true,
    listingApproval: true,
    orderTracking: true,
    reviewsEnabled: true,
    chatEnabled: true,
  },
};

async function applyAdminSettingsSchema() {
  try {
    console.log('Creating system_settings and activity_logs tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id BIGINT PRIMARY KEY AUTO_INCREMENT,
        category VARCHAR(64) NOT NULL,
        setting_key VARCHAR(64) NOT NULL,
        setting_value JSON NOT NULL,
        updated_by BIGINT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_system_settings_key (category, setting_key),
        INDEX idx_system_settings_category (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
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
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('✅ system_settings and activity_logs tables ready');

    // Seed defaults only when the settings table is empty (idempotent).
    const [[{ count }]] = await pool.query(
      'SELECT COUNT(*) AS count FROM system_settings'
    );

    if (Number(count) === 0) {
      const rows = [];
      for (const [category, keys] of Object.entries(DEFAULT_SETTINGS)) {
        for (const [key, value] of Object.entries(keys)) {
          rows.push([category, key, JSON.stringify(value)]);
        }
      }

      await pool.query(
        'INSERT INTO system_settings (category, setting_key, setting_value) VALUES ?',
        [rows]
      );
      console.log(`✅ Seeded ${rows.length} default settings`);
    } else {
      console.log(`ℹ️  Settings already present (${count} rows) — skipping seed`);
    }
  } catch (error) {
    console.error('❌ Error applying admin settings schema:', error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

applyAdminSettingsSchema();