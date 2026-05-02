# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: Firebase Firestore (migrated from PostgreSQL/Drizzle ORM)
- **File storage**: Firebase Storage (images/videos — no more base64 in DB)
- **Push notifications**: Expo Push API
- **Build**: esbuild (ESM bundle)

## Firebase

- **Project ID**: `tashi-9512b`
- **Storage bucket**: `tashi-9512b.firebasestorage.app`
- **Service account**: Set via `FIREBASE_SERVICE_ACCOUNT` secret (full JSON string)
- **Numeric IDs**: Maintained via atomic counter transactions in `_counters/{collection}` documents
- **Seed lock**: `_locks/super_admin_seed` prevents duplicate admin creation on concurrent startup
- **Composite indexes** (all Collection scope, all Enabled):
  - `commissions`: salesmanId ASC + periodFrom ASC
  - `orders`: salesmanId ASC + createdAt ASC
  - `payments`: receivedBy ASC + createdAt ASC
  - `scans`: userId ASC + claimId ASC

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server (port 8080, path /api)
│   └── tashi/              # Expo React Native mobile app (port 19190)
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Legacy Drizzle ORM schema (NOT used by api-server)
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml     # pnpm workspace config
├── tsconfig.base.json      # Shared TS options
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. All data access goes through Firebase Firestore and Firebase Storage.

- Entry: `src/index.ts` — reads `PORT`, starts Express, seeds super admin
- App setup: `src/app.ts` — CORS, JSON parsing, routes at `/api`
- Firebase: `src/lib/firebase.ts` — Admin SDK init, `nextId()`, helpers
- Storage: `src/lib/storage.ts` — upload base64/buffer to Firebase Storage, make public
- Push: `src/lib/push.ts` — Expo push notifications via push token collection
- Seed: `src/lib/seed.ts` — idempotent super admin creation using `_locks` transaction
- Routes: 16 route files in `src/routes/`
- `pnpm --filter @workspace/api-server run dev` — start dev server (pre-built dist)
- `pnpm --filter @workspace/api-server run build` — esbuild production bundle

### Firestore Collections

| Collection | Doc ID | Notes |
|---|---|---|
| `users` | numeric string | phone, passwordHash, role, points, etc. |
| `products` | numeric string | imageUrl stored in Firebase Storage |
| `qrCodes` | qrNumber string | O(1) lookup on scan |
| `scans` | numeric string | denormalized qrNumber + productName |
| `claims` | numeric string | pointsClaimed, verifiedPoints, status |
| `orders` | numeric string | salesmanId, retailerId, status |
| `orderItems` | auto | orderId field for batch queries |
| `payments` | numeric string | retailerId, receivedBy, amount |
| `commissions` | numeric string | salesmanId, periodFrom, commissionAmount |
| `ads` | numeric string | mediaUrl in Firebase Storage |
| `ticker` | numeric string | text messages |
| `regions` | numeric string | name |
| `pushTokens` | token string | O(1) upsert by token value |
| `adminSettings` | `global` | JSON blob of tab/card visibility |
| `adminUserSettings` | userId string | per-admin JSON settings |
| `_counters` | collection name | auto-increment counters |
| `_locks` | `super_admin_seed` | startup idempotency lock |

### `lib/db` (`@workspace/db`)

Legacy Drizzle ORM + PostgreSQL schema. **Not used by api-server anymore.** Kept for reference.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and Orval config. Run codegen:
`pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `artifacts/tashi` (`@workspace/tashi`)

Expo React Native mobile app with role-based authentication.

- **Roles**: Super Admin, Admin, Salesman, Mechanic, Retailer
- **Super Admin**: All admin powers + "Config" tab to control visible tabs/cards for admins
- **Admin screens**: Dashboard, Create QR Code, Products, Create Account, Payments, Orders, Claims
- **Mechanic**: QR code scanner using `expo-camera`
- **Navigation**: Admin/Super Admin uses tabs; others use drawer
- **Auth**: JWT in AsyncStorage, auto-restored on launch
- **API base URL**: Resolved by `lib/apiBase.ts` — checks `EXPO_PUBLIC_RAILWAY_URL` first, then `EXPO_PUBLIC_DOMAIN`. Set these in `eas.json` env sections for builds.
- **Super Admin credentials**: phone `03055198651` / password `khan0112`
- Colors: primary `#E87722` (orange), superAdmin `#7B2FBE` (purple)

### `scripts` (`@workspace/scripts`)

Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.

## Environment Variables / Secrets

| Key | Type | Description |
|---|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Secret | Firebase Admin SDK service account JSON string |
| `JWT_SECRET` | Secret | JWT signing secret (use a strong random string in production) |
| `SUPER_ADMIN_PHONE` | Env | Defaults to `03055198651` |
| `SUPER_ADMIN_PASSWORD` | Env | Defaults to `khan0112` |
| `PORT` | Runtime | Assigned by Replit |

## Deployment Notes

- **API server**: Deployed to Google Cloud (port 8080). Set `FIREBASE_SERVICE_ACCOUNT`, `JWT_SECRET` as environment variables.
- **Website** (separate repo): When building with Vite for App Engine, set `VITE_API_URL` at build time to the deployed API server's public URL (e.g. `https://your-api.appspot.com`). Without this, API calls resolve relative to the App Engine domain and return no data.
