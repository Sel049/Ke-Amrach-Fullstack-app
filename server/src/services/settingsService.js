import { pool } from '../config/database.js';

// Lightweight in-memory cache for system_settings. Settings are read frequently
// (e.g. maintenance mode gate on every request) so avoid a query per request.
let cache = null;
let cacheAt = 0;
const TTL_MS = 10 * 1000; // 10 seconds

export async function loadSettings(force = false) {
  const now = Date.now();
  if (cache && !force && now - cacheAt < TTL_MS) {
    return cache;
  }

  const [rows] = await pool.query(
    'SELECT category, setting_key, setting_value FROM system_settings'
  );

  const map = {};
  for (const row of rows) {
    if (!map[row.category]) map[row.category] = {};
    let value = row.setting_value;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        // leave as raw string
      }
    }
    map[row.category][row.setting_key] = value;
  }

  cache = map;
  cacheAt = now;
  return map;
}

export async function getSettingValue(category, key, fallback = undefined) {
  try {
    const map = await loadSettings();
    const value = map?.[category]?.[key];
    return value === undefined ? fallback : value;
  } catch {
    return fallback;
  }
}

export function clearSettingsCache() {
  cache = null;
  cacheAt = 0;
}