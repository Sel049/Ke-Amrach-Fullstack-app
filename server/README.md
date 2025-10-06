# Server (Node.js + Express) Setup

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy the example file and edit values as needed:
   ```bash
   cp env.example .env
   ```
   Key settings (see `server/env.example` for the full list):
   - Database: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`
   - Server: `PORT`, `NODE_ENV`, `ALLOWED_ORIGINS`
   - Security: `JWT_SECRET`, `SESSION_SECRET`, rate limiting vars
   - Email (password reset): `SMTP_*`
   - Optional Firebase Admin: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (PEM with \n)

3. **Database Setup:**
   - Create a MySQL database named `ke_geberew`
   - Import schema (baseline): `server/src/sql/schema.sql`
   - Optional advanced/payment schemas in `server/src/sql/`
   - Or run provided scripts in `server/scripts/` (see below)

4. **Firebase Setup (optional):**
   - Prefer environment variables in `.env`:
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_CLIENT_EMAIL`
     - `FIREBASE_PRIVATE_KEY` (wrap in quotes; use literal \n)
   - Alternatively, set `USE_APPLICATION_DEFAULT=true` when running on GCP

5. **Start the server:**
   ```bash
   npm run dev
   ```

## 📊 API Endpoints (samples)

### Public
- `GET /health` – Health check
- `GET /public/listings` – Public listings feed

### Farmer Dashboard
- `GET /farmer/metrics` – Farmer dashboard metrics
- `GET /farmer/listings` – Farmer's produce listings
- `GET /farmer/orders` – Farmer's orders
- `GET /farmer/activity` – Recent activity

### Authentication
- `POST /auth/sync` – Sync user with Firebase
- `GET /users/me` – Current user profile
- `PUT /users/me` – Update user profile

## 🗄️ Database Schema
Core tables are provisioned/ensured at startup where possible (see `server/src/index.js`). Full schemas live in `server/src/sql/`.

## 🔧 Development

- Hot reload: `npm run dev`
- Production: `npm start`
- Database connection: tested on startup; key tables ensured if missing

### Useful scripts (see `server/package.json`)
- `npm run db:bootstrap` – Apply schema and create admin (idempotent)
- `node scripts/setup-database.js` – Initial DB setup
- `node scripts/apply-performance-indexes.js` – Add performance indexes
- `node scripts/seed-market-trends-data.js` – Seed demo data
