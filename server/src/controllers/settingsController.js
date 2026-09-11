import { pool } from '../config/database.js';
import { loadSettings, clearSettingsCache } from '../services/settingsService.js';

const SETTINGS_CATEGORIES = ['general', 'notifications', 'security', 'payment', 'features'];
const PRIMITIVE_TYPES = ['boolean', 'number', 'string'];

function validatePayload(body) {
  const updates = {};

  for (const category of SETTINGS_CATEGORIES) {
    const group = body?.[category];
    if (group && typeof group === 'object' && !Array.isArray(group)) {
      updates[category] = group;
    }
  }

  if (Object.keys(updates).length === 0) {
    return { error: 'No valid settings provided' };
  }

  for (const [category, group] of Object.entries(updates)) {
    for (const [key, value] of Object.entries(group)) {
      if (!PRIMITIVE_TYPES.includes(typeof value) || Number.isNaN(value)) {
        return { error: `Invalid value for ${category}.${key}: expected boolean, number, or string` };
      }
    }
  }

  return { updates };
}

// GET /api/settings (admin)
export const getSettings = async (req, res) => {
  try {
    const settings = await loadSettings(true);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
};

// PUT /api/settings (admin) — partial update by category group
export const updateSettings = async (req, res) => {
  try {
    const { updates, error } = validatePayload(req.body);
    if (error) {
      return res.status(400).json({ success: false, error });
    }

    const actorId = req.user?.id || null;

    for (const [category, group] of Object.entries(updates)) {
      for (const [key, value] of Object.entries(group)) {
        await pool.query(
          `INSERT INTO system_settings (category, setting_key, setting_value, updated_by)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             setting_value = VALUES(setting_value),
             updated_by = VALUES(updated_by)`,
          [category, key, JSON.stringify(value), actorId]
        );
      }
    }

    clearSettingsCache();
    const settings = await loadSettings(true);

    try {
      await pool.query(
        `INSERT INTO activity_logs (user_id, actor_name, actor_role, action, entity_type, entity_id, message)
         VALUES (?, ?, 'admin', 'settings.update', 'system_settings', NULL, ?)`,
        [actorId, req.user?.uid || 'admin', `Updated settings: ${Object.keys(updates).join(', ')}`]
      );
    } catch (logError) {
      console.error('Error writing activity log:', logError.message);
    }

    res.json({ success: true, settings, message: 'Settings saved successfully' });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ success: false, error: 'Failed to save settings' });
  }
};

// GET /api/settings/public (no auth) — safe subset only
export const getPublicSettings = async (req, res) => {
  try {
    const settings = await loadSettings();
    res.json({
      success: true,
      settings: {
        general: {
          siteName: settings.general?.siteName,
          siteDescription: settings.general?.siteDescription,
          currency: settings.general?.currency,
          maintenanceMode: settings.general?.maintenanceMode === true,
        },
        features: settings.features || {},
        // Expose password policy so the client can validate before submitting.
        // Only the minimum length is public; other security settings stay admin-only.
        security: {
          passwordMinLength: Number(settings.security?.passwordMinLength) || 8,
        },
      },
    });
  } catch (error) {
    console.error('Error loading public settings:', error);
    res.status(500).json({ success: false, error: 'Failed to load settings' });
  }
};