# Client (React + Vite) Setup

## Prerequisites
- Node.js >= 18
- npm >= 8

## 1) Install dependencies
```bash
cd client
npm install
```

## 2) Configure environment variables
Copy the example file and adjust values as needed:
```bash
cp env.example .env
```
Required keys (see `client/env.example` for full list):
- `VITE_API_BASE_URL` (e.g., `http://localhost:5000/api`)
- Firebase web config: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_MEASUREMENT_ID`
- App metadata: `VITE_APP_NAME`, `VITE_APP_VERSION`

## 3) Run the development server
```bash
npm run dev
```
Vite will print a local URL (commonly `http://localhost:5173`).

Ensure the backend is running at `VITE_API_BASE_URL` (default `http://localhost:5000/api`).

## 4) Build for production
```bash
npm run build
```
The production bundle is output to `client/build` (configured in `vite.config.mjs`).
Preview the build locally:
```bash
npm run preview
```

## 5) Tailwind CSS
- Tailwind is preconfigured via `tailwind.config.js`, `postcss.config.js`, and `src/styles/tailwind.css`.
- Global styles live in `src/styles/`.

## 6) Firebase (optional in dev)
- The app can run without Firebase in development if the backend supports dev auth.
- For production, provide valid Firebase Web config values in `.env`.

## 7) Common issues
- CORS: If API calls fail, verify server `ALLOWED_ORIGINS` includes `http://localhost:5173` and your dev URL.
- Wrong API URL: Confirm `VITE_API_BASE_URL` matches the server address (`/api` path included).
- Ports in use: If `5173` is occupied, Vite will choose another port; update server CORS origins accordingly.

## Scripts
- `npm run dev` – start Vite dev server
- `npm run build` – production build to `build/`
- `npm run preview` – preview the production build
