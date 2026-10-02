#!/usr/bin/env node
/**
 * Generates client/src/data/ethiopiaLocations.data.js
 *
 * Source of truth: Open Admin Data — Ethiopia Administrative Divisions
 *   https://github.com/open-admin-data/ethiopia-administrative-divisions
 *   License: CC-BY-4.0  (see client/src/data/ATTRIBUTION.md)
 *
 * Usage
 *   1. Download the raw dataset into client/scripts/.geo-tmp:
 *        curl -sSL -o client/scripts/.geo-tmp/all-region.json https://raw.githubusercontent.com/open-admin-data/ethiopia-administrative-divisions/master/data/all-region.json
 *        curl -sSL -o client/scripts/.geo-tmp/all-zone.json   https://raw.githubusercontent.com/open-admin-data/ethiopia-administrative-divisions/master/data/all-zone.json
 *        curl -sSL -o client/scripts/.geo-tmp/all-woreda.json https://raw.githubusercontent.com/open-admin-data/ethiopia-administrative-divisions/master/data/all-woreda.json
 *   2. node client/scripts/generate-ethiopia-locations.mjs
 *
 * Re-run whenever Ethiopia creates/merges regions, zones or woredas.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputDir = process.argv.includes('--input')
  ? process.argv[process.argv.indexOf('--input') + 1]
  : path.join(__dirname, '.geo-tmp');
const outputFile = path.resolve(__dirname, '..', 'src', 'data', 'ethiopiaLocations.data.js');

const read = (name) => JSON.parse(fs.readFileSync(path.join(inputDir, name), 'utf8'));

// Amharic (የአማርኛ ፊደል) names for the 14 current first-level divisions.
// The upstream dataset only carries Latin transliterations, so these are
// maintained here. Zones/woredas intentionally fall back to their Latin name.
const REGION_AMHARIC = {
  'tigray': 'ትግራይ',
  'afar': 'አፋር',
  'amhara': 'አማራ',
  'oromia': 'ኦሮሚያ',
  'somali': 'ሶማሌ',
  'benishangul-gumuz': 'ቤኒሻንጉል ጉሙዝ',
  'central-ethiopia': 'ማዕከላዊ ኢትዮጵያ',
  'south-ethiopia': 'ደቡብ ኢትዮጵያ',
  'south-west-ethiopia': 'ደቡብ ምዕራብ ኢትዮጵያ',
  'gambela': 'ጋምቤላ',
  'harari': 'ሐረሪ',
  'addis-ababa': 'አዲስ አበባ',
  'dire-dawa': 'ድሬዳዋ',
  'sidama': 'ሲዳማ'
};

// The upstream feed includes a synthetic "Contested" bucket (ET99) grouping
// zones/woredas whose final regional assignment is disputed (Western Tigray).
// It is deliberately excluded from selectable options; see ATTRIBUTION.md.
const EXCLUDED_REGION_IDS = new Set(['ET99']);

const SPECIAL_ZONE = { value: 'special', label: 'Special Woredas' };

const regionsIn = read('all-region.json');
const zonesIn = read('all-zone.json');
const woredasIn = read('all-woreda.json');

const regionById = new Map();

for (const r of regionsIn) {
  if (EXCLUDED_REGION_IDS.has(r.id)) continue;
  const region = {
    value: r.name.slug,
    label: r.name.en,
    labelAm: REGION_AMHARIC[r.name.slug] || r.name.en,
    zones: [],
    zoneById: new Map()
  };
  regionById.set(r.id, region);
}

for (const z of zonesIn) {
  const region = regionById.get(z.parent?.id);
  if (!region) continue;
  const zone = { value: z.name.slug, label: z.name.en, woredas: [] };
  region.zones.push(zone);
  region.zoneById.set(z.id, zone);
}

let orphanWoredas = 0;
for (const w of woredasIn) {
  const region = regionById.get(w.ancestors?.[0]?.id);
  if (!region) continue;
  const parentId = w.parent?.level === 2 ? w.parent.id : null;
  let zone = parentId ? region.zoneById.get(parentId) : null;
  if (!zone) {
    // The woreda sits directly under the region (no zone) — group it separately.
    zone = region.zones.find((z) => z.value === SPECIAL_ZONE.value);
    if (!zone) {
      zone = { ...SPECIAL_ZONE, woredas: [] };
      region.zones.push(zone);
    }
    orphanWoredas += 1;
  }
  zone.woredas.push(w.name.en);
}

const regions = [...regionById.values()]
  .map((r) => ({
    value: r.value,
    label: r.label,
    labelAm: r.labelAm,
    zones: r.zones
      .map((z) => ({
        value: z.value,
        label: z.label,
        woredas: [...new Set(z.woredas)].sort((a, b) => a.localeCompare(b, 'en'))
      }))
      .filter((z) => z.woredas.length > 0)
      .sort((a, b) => a.label.localeCompare(b.label, 'en'))
  }))
  .sort((a, b) => a.label.localeCompare(b.label, 'en'));

const zoneTotal = regions.reduce((n, r) => n + r.zones.length, 0);
const woredaTotal = regions.reduce(
  (n, r) => n + r.zones.reduce((m, z) => m + z.woredas.length, 0),
  0
);

// ---- diagnostics -----------------------------------------------------------
const emptyRegions = regions.filter((r) => r.zones.length === 0);
if (emptyRegions.length) {
  console.warn(`[warn] regions without any zone: ${emptyRegions.map((r) => r.value).join(', ')}`);
}
if (orphanWoredas) {
  console.warn(`[warn] ${orphanWoredas} woreda(s) had no zone and were grouped as "Special Woredas"`);
}

const duplicateNames = [];
for (const r of regions) {
  const seen = new Map();
  for (const z of r.zones) {
    for (const name of z.woredas) {
      if (seen.has(name)) duplicateNames.push(`${r.value}: ${name} (${seen.get(name)} & ${z.label})`);
      else seen.set(name, z.label);
    }
  }
}

// ---- emit ------------------------------------------------------------------
const json = (value) => JSON.stringify(value);

const body = regions
  .map((r) => {
    const zones = r.zones
      .map(
        (z) =>
          `      {\n` +
          `        value: ${json(z.value)},\n` +
          `        label: ${json(z.label)},\n` +
          `        woredas: [\n` +
          z.woredas.map((w) => `          ${json(w)}`).join(',\n') +
          `\n        ]\n` +
          `      }`
      )
      .join(',\n');
    return (
      `  {\n` +
      `    value: ${json(r.value)},\n` +
      `    label: ${json(r.label)},\n` +
      `    labelAm: ${json(r.labelAm)},\n` +
      `    zones: [\n${zones}\n    ]\n` +
      `  }`
    );
  })
  .join(',\n');

const today = new Date().toISOString().slice(0, 10);
const header = `/**
 * AUTO-GENERATED FILE - DO NOT EDIT BY HAND.
 *
 * Ethiopia's current administrative divisions: region -> zone -> woreda.
 * Generated by: client/scripts/generate-ethiopia-locations.mjs
 *
 * Source : Open Admin Data - Ethiopia Administrative Divisions
 *          https://github.com/open-admin-data/ethiopia-administrative-divisions
 * License: CC-BY-4.0 (attribution required - see client/src/data/ATTRIBUTION.md)
 *
 * Snapshot: ${today}
 * Contents: ${regions.length} regions, ${zoneTotal} zones, ${woredaTotal} woredas
 *
 * NOTE: \`labelAm\` is only populated for regions. The upstream dataset has no
 * Amharic transliteration for zones/woredas, so consumers MUST fall back to
 * \`label\` when rendering Amharic.
 */

export const ETHIOPIA_DATA_META = {
  source: 'Open Admin Data - Ethiopia Administrative Divisions',
  sourceUrl: 'https://github.com/open-admin-data/ethiopia-administrative-divisions',
  license: 'CC-BY-4.0',
  generatedAt: ${json(today)},
  regionCount: ${regions.length},
  zoneCount: ${zoneTotal},
  woredaCount: ${woredaTotal}
};

export const ETHIOPIA_REGIONS = [
${body}
];

export default ETHIOPIA_REGIONS;
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, header, 'utf8');

console.log(`[ok] wrote ${path.relative(process.cwd(), outputFile)}`);
console.log(`     regions=${regions.length} zones=${zoneTotal} woredas=${woredaTotal}`);
if (duplicateNames.length) {
  console.log(`     note: ${duplicateNames.length} duplicated woreda name(s) within a region (disambiguated by zone):`);
  duplicateNames.slice(0, 10).forEach((d) => console.log(`       - ${d}`));
}