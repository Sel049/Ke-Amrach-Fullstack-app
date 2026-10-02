# Data Attribution — Ethiopian Administrative Divisions

The files in this directory contain Ethiopian administrative-division data that is
**not** authored by this project. It is redistributed under the terms of the
**Creative Commons Attribution 4.0 International (CC BY 4.0)** licence, which
requires attribution.

## Source

| | |
|---|---|
| **Dataset** | Open Admin Data — Ethiopia Administrative Divisions |
| **Publisher** | Open Admin Data (`https://openadmindata.org/et/`) |
| **Repository** | https://github.com/open-admin-data/ethiopia-administrative-divisions |
| **Licence** | CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/ |
| **Licence file** | https://github.com/open-admin-data/ethiopia-administrative-divisions/blob/master/LICENSE |
| **Copyright** | © 2026 jakkrapongt |
| **Snapshot used** | 2026-09-08 |

## Files

| File | Description |
|---|---|
| `ethiopiaLocations.data.js` | **Auto-generated.** 14 regions, 104 zones, 1,130 woredas. Do not edit by hand. |
| `ethiopiaLocations.js` | Hand-written helpers/normalizers over the generated data. |

Regenerate with:

```bash
node client/scripts/generate-ethiopia-locations.mjs
```

(see the header of that script for the `curl` commands that fetch the raw dataset).

## Changes made to the source data

The upstream dataset is a verbose record format (ids, ISO codes, ancestors,
postal codes, WGS84 coordinates). We store a **modified, reduced** form:

1. **Reduced** each record to `name` + `slug` + parent `zone`, grouped as
   `region -> zone -> woreda`. Coordinates, ISO codes, zip codes and ancestor
   chains are dropped because the app does not use them.
2. **Excluded** the synthetic `"Contested"` bucket (`ET99`: 3 zones / 18 woredas)
   from the selectable region list. It is not a legal first-level division; it
   groups areas (Western Tigray) whose regional assignment is disputed. Those
   18 woredas are therefore not selectable. This is why the counts here read
   14 regions / 104 zones / 1,130 woredas instead of 15 / 107 / 1,148.
3. **Added** Amharic (`ግዕዝ`) names for the 14 first-level divisions. The upstream
   data has no Amharic transliteration for zones or woredas, so those fall back
   to their Latin names — consumers must always use `labelAm || label`.

## Notes for maintainers

- Ethiopia's federal structure changes often. **Sidama** became a region in 2020,
  **South West Ethiopia** in 2021, and **Central Ethiopia** + **South Ethiopia**
  were created in 2023 when **SNNPR was dissolved**. Re-run the generator when
  new regions are announced, and update `REGION_AMHARIC` in the generator for
  any new division.
- `SNNPR` values already stored in the database (`users.region`,
  `produce_listings.region`) can no longer be mapped to a successor region and
  intentionally resolve to `null` in `normalizeRegion()`.
