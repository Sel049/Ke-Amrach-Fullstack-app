/**
 * Single source of truth for Ethiopian locations (region / zone / woreda).
 *
 * Data: ./ethiopiaLocations.data.js  (auto-generated, CC-BY-4.0 — see ATTRIBUTION.md)
 *
 * The DB stores only `region` + `woreda` (VARCHAR(128)), so zones are exposed
 * purely as grouping metadata for the UI — no schema change is required.
 *
 * Canonical values:
 *   region -> slug          e.g. "oromia", "addis-ababa", "central-ethiopia"
 *   zone   -> slug          e.g. "guji"
 *   woreda -> English name  e.g. "Adola", "Bole Sub City"
 *
 * Legacy values that already exist in the database (e.g. "Addis Ababa",
 * "B/Gumuz", "SNNPR", "bahir-dar") are still resolvable via the normalizers.
 */

import { ETHIOPIA_REGIONS, ETHIOPIA_DATA_META } from './ethiopiaLocations.data.js';

export { ETHIOPIA_REGIONS, ETHIOPIA_DATA_META };

/** Lowercase-dash form of any label, e.g. "Nifas Silk Lafto" -> "nifas-silk-lafto". */
export const slugifyLocation = (value) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Historical / alternate spellings that still live in the database.
 * A value of `null` means the region no longer exists and cannot be mapped.
 */
const REGION_ALIASES = {
  'b-gumuz': 'benishangul-gumuz',
  'bgumuz': 'benishangul-gumuz',
  'benishangul': 'benishangul-gumuz',
  'benishangul-gumuz-regional-state': 'benishangul-gumuz',
  'gambella': 'gambela',
  'harar': 'harari',
  'addis-ababa-city': 'addis-ababa',
  'addis-ababa-city-administration': 'addis-ababa',
  'dire-dawa-city': 'dire-dawa',
  'dire-dawa-city-administration': 'dire-dawa',
  'south-west': 'south-west-ethiopia',
  'southwest-ethiopia': 'south-west-ethiopia',
  'south-west-ethiopia-peoples-region': 'south-west-ethiopia',
  'central-ethiopia-regional-state': 'central-ethiopia',
  'south-ethiopia-regional-state': 'south-ethiopia',
  // Dissolved in 2023 — its territory became Central/South Ethiopia. Cannot be
  // safely mapped to a single successor, so it resolves to null.
  'snnpr': null,
  'snnp': null,
  'snnpr-regional-state': null,
  'southern-nations-nationalities-and-peoples-region': null
};

/** Find a region record from a slug, a display label, or a legacy value. */
export function getRegion(slugOrLabel) {
  if (!slugOrLabel) return null;
  const slug = slugifyLocation(slugOrLabel);
  if (slug in REGION_ALIASES) {
    const mapped = REGION_ALIASES[slug];
    return mapped ? ETHIOPIA_REGIONS.find((r) => r.value === mapped) || null : null;
  }
  return (
    ETHIOPIA_REGIONS.find((r) => r.value === slug) ||
    ETHIOPIA_REGIONS.find((r) => slugifyLocation(r.label) === slug) ||
    null
  );
}

/** Canonical region slug for any stored/legacy value, or null if unmappable. */
export function normalizeRegion(slugOrLabel) {
  return getRegion(slugOrLabel)?.value ?? null;
}

/** Localized region name; always falls back to English. */
export function getRegionLabel(slugOrLabel, language = 'en') {
  const region = getRegion(slugOrLabel);
  if (!region) return slugOrLabel ? String(slugOrLabel) : '';
  return language === 'am' && region.labelAm ? region.labelAm : region.label;
}

/** All 14 first-level divisions as `{ value, label }` options. */
export function getRegionOptions(language = 'en') {
  return ETHIOPIA_REGIONS.map((region) => ({
    value: region.value,
    label: getRegionLabel(region.value, language)
  }));
}

/** Zone records of a region: `[{ value, label, woredas: [names] }]`. */
export function getWoredaGroups(slugOrLabel) {
  return getRegion(slugOrLabel)?.zones ?? [];
}

/** Flat list of woreda names for a region. */
export function getWoredas(slugOrLabel) {
  return getWoredaGroups(slugOrLabel).flatMap((zone) => zone.woredas);
}

/** Every woreda in the country (used when the region is unknown). */
export function getAllWoredas() {
  return ETHIOPIA_REGIONS.flatMap((region) => getWoredas(region.value));
}

/**
 * Searchable `Select`-friendly options. Woredas have no Amharic translation
 * upstream, so `label` stays the English name and the zone is surfaced as the
 * option `description` (rendered by components/ui/Select.jsx).
 */
export function getWoredaOptions(slugOrLabel, language = 'en') {
  void language; // woreda labels are English-only until Amharic data exists
  return getWoredaGroups(slugOrLabel).flatMap((zone) =>
    zone.woredas.map((name) => ({
      value: name,
      label: name,
      description: zone.label,
      zone: zone.value,
      zoneLabel: zone.label
    }))
  );
}

/** True when the value is one of the 14 current first-level divisions. */
export function isKnownRegion(slugOrLabel) {
  return Boolean(getRegion(slugOrLabel));
}

/**
 * Resolve a stored woreda value (English name or legacy lowercase slug) back to
 * its canonical English name. Pass a region to disambiguate.
 */
export function findWoreda(slugOrLabel, storedValue) {
  if (!storedValue) return null;
  const names = slugOrLabel ? getWoredas(slugOrLabel) : getAllWoredas();
  const slug = slugifyLocation(storedValue);
  return (
    names.find((name) => name === storedValue) ||
    names.find((name) => slugifyLocation(name) === slug) ||
    null
  );
}

/** Localized display label for a stored woreda value (falls back to the raw value). */
export function getWoredaLabel(slugOrLabel, storedValue, language = 'en') {
  void language;
  if (!storedValue) return '';
  return findWoreda(slugOrLabel, storedValue) || String(storedValue);
}

/** Number of woredas in a region (0 when the region is unknown). */
export function countWoredas(slugOrLabel) {
  return getWoredas(slugOrLabel).length;
}

export default {
  ETHIOPIA_REGIONS,
  ETHIOPIA_DATA_META,
  getRegion,
  getRegionOptions,
  getRegionLabel,
  normalizeRegion,
  isKnownRegion,
  getWoredaGroups,
  getWoredas,
  getAllWoredas,
  getWoredaOptions,
  getWoredaLabel,
  findWoreda,
  countWoredas,
  slugifyLocation
};
