# FixMate API — Server

Smart Device & Home Appliance Repair Service Platform (REST API) built with **Express 4 + MongoDB (native driver) + BetterAuth (JWT plugin) + Stripe Checkout**.

## Tech Stack

| Layer     | Package                                        |
| --------- | ---------------------------------------------- |
| Server    | express, cors, dotenv                          |
| Database  | mongodb (native driver)                        |
| Auth      | better-auth (user management) + JWT plugin     |
| JWT check | jose (`createRemoteJWKSet` / `jwtVerify`)      |
| Payments  | stripe (Checkout Session + webhook)            |
| Images    | ImgBB (server-side upload proxy)               |
| Dev tools | nodemon, mongodb-memory-server                 |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start a database — pick ONE option:
npm run dev:db        # Option A: in-memory MongoDB (no install needed, data resets on stop)
#                     # Option B: your local MongoDB service (mongodb://127.0.0.1:27017)
#                     # Option C: set MONGODB_URI in .env to a MongoDB Atlas URI

# 3. Seed demo data (admin, technicians, customers, services, bookings, payments)
npm run seed          # skips if data already exists
npm run seed:fresh    # wipes users/sessions first, then re-seeds everything

# 4. Start the API
npm run dev           # development (nodemon auto-restart)
npm start             # plain node
```

Health check: <http://localhost:5001/health>

## Seeded Accounts

| Role       | Email              | Password  |
| ---------- | ------------------ | --------- |
| Admin      | admin@fixmate.com  | Admin@123 |
| Technician | rakib@fixmate.com  | Tech@123  |
| Technician | sabbir@fixmate.com | Tech@123  |
| Customer   | nusrat@fixmate.com | Cust@123  |
| Customer   | tanvir@fixmate.com | Cust@123  |

## Environment Variables (`.env`)

| Variable                | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `PORT`                  | API port (default 5000)                                           |
| `NODE_ENV`              | development / production                                          |
| `MONGODB_URI`           | MongoDB connection string (**required**)                          |
| `DB_NAME`               | Database name (default `fixmate`)                                 |
| `BETTER_AUTH_SECRET`    | BetterAuth secret used to sign sessions & encrypt JWKS (**required**) |
| `BETTER_AUTH_URL`       | Public server URL — must match the running host (trusted origins, JWKS) |
| `JWT_ISSUER` / `JWT_AUDIENCE` | Expected `iss` / `aud` claims on verified JWTs              |
| `JWT_EXPIRES_IN`        | JWT lifetime (default `7d`)                                       |
| `CLIENT_URL`            | Frontend origin (also used for Stripe success/cancel URLs)        |
| `CORS_ORIGINS`          | Comma-separated extra allowed origins                             |
| `STRIPE_SECRET_KEY`     | Stripe test key (`sk_test_...`) — payments disabled without it    |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`)                       |
| `IMGBB_API_KEY`         | ImgBB API key for image uploads                                   |
| `GOOGLE_*` / `GITHUB_*` | Optional social login providers                                   |

## Scripts

| Script               | What it does                                   |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Start API with nodemon (auto-restart)          |
| `npm start`          | Start API with node                            |
| `npm run dev:db`     | Start in-memory MongoDB on port 27017          |
| `npm run seed`       | Seed demo data (skips existing)                |
| `npm run seed:fresh` | Wipe users + re-seed everything                |
| `node scripts/smoke-test.js` | Self-contained 68-assertion test suite |

## Collections (4)

1. **`users`** — BetterAuth-managed (sign-up / sign-in / sessions / accounts) + `role` (`customer` \| `technician` \| `admin`), `phone`, `area`, `bio`
2. **`services`** — created by technicians, `approvalStatus` approved/rejected by admin, searchable/filterable/sortable
3. **`bookings`** — created by customers, status updated by the owning technician, payment status updated by Stripe
4. **`payments`** — inserted on Stripe Checkout success (verification endpoint or webhook)

## Authentication (BetterAuth + JWT)

BetterAuth handles sign-up/sign-in with session cookies. Private REST APIs consume a
**JWT** issued by BetterAuth's JWT plugin and verified against BetterAuth's JWKS endpoint:

```bash
# 1. Sign in (sets a session cookie)
curl -c jar.txt -X POST http://localhost:5001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fixmate.com","password":"Admin@123"}'

# 2. Exchange the session for a JWT
curl -b jar.txt http://localhost:5001/api/auth/token        # → { token: "..." }

# 3. Call private APIs with the Bearer token
curl http://localhost:5001/api/users/me -H "Authorization: Bearer <token>"
```

### Role Middlewares (Challenge 2)

| Middleware         | Behavior                                                     |
| ------------------ | ------------------------------------------------------------ |
| `verifyToken`      | Verifies `Authorization: Bearer <jwt>` (iss/aud/JWKS). **401** without a valid token |
| `verifyCustomer`   | **403** unless `role === 'customer'`                          |
| `verifyTechnician` | **403** unless `role === 'technician'`                        |
| `verifyAdmin`      | **403** unless `role === 'admin'`                             |

Role is clamped server-side at sign-up (nobody can self-register as `admin`), and every
query is scoped to the logged-in user (data isolation).

## API Reference (base: `/api`)

### BetterAuth endpoints (`/api/auth/*`)

`POST /sign-up/email` · `POST /sign-in/email` · `POST /sign-out` · `GET /get-session` ·
`GET /token` (session → JWT) · `GET /jwks` (public keys)

Password policy is enforced server-side: uppercase + lowercase + min length 6.

### Services
| Method | Endpoint                 | Access     | Notes                                                                  |
| ------ | ------------------------ | ---------- | ---------------------------------------------------------------------- |
| GET    | `/services`              | Public     | `?search=` (title/category) `&category=` `&serviceMode=` `&sort=price-asc\|price-desc\|newest` `&page=` `&limit=` |
| GET    | `/services/featured`     | Public     | 6 newest approved services                                             |
| GET    | `/services/:id`          | Public     | Includes technician summary                                            |
| POST   | `/services`              | Technician | Creates with `approvalStatus: pending`                                 |
| GET    | `/services/mine/all`     | Technician | Own services incl. pending/rejected                                    |
| PATCH  | `/services/:id`          | Technician | Edit (resets approval to `pending`)                                    |
| PATCH  | `/services/:id/availability` | Technician | Toggle `isAvailable`                                               |
| DELETE | `/services/:id`          | Technician | Own only (**403** otherwise)                                           |

### Bookings
| Method | Endpoint                  | Access     | Notes                                        |
| ------ | ------------------------- | ---------- | -------------------------------------------- |
| POST   | `/bookings`               | Customer   | serviceId, customerPhone, address, preferredDate, problemDescription — duplicate active request → **409** |
| GET    | `/bookings/my`            | Customer   | Own bookings (data isolation)                |
| PATCH  | `/bookings/:id/cancel`    | Customer   | Only while `requested`                       |
| GET    | `/bookings/technician`    | Technician | Only the technician's own jobs               |
| PATCH  | `/bookings/:id/status`    | Technician | Job owner only; strict pipeline enforced     |
| GET    | `/bookings/:id`           | Owner/admin| Includes statusHistory                       |

**Job pipeline (Challenge 3, server-enforced):**

```
requested ➔ accepted / rejected / cancelled ➔ in-progress ➔ completed ➔ paid
                                                  (finalAmount > 0 required)  (via Stripe)
```

Invalid transitions are rejected with **400**; the technician who owns the job is the only
one who can update it (others → **403**).

### Payments
| Method | Endpoint                        | Access   | Notes                                                        |
| ------ | ------------------------------- | -------- | ------------------------------------------------------------ |
| POST   | `/payments/create-checkout-session` | Customer | `{ bookingId }` — booking loaded from DB (never client amounts), `finalAmount × 100` cents; only for **completed + unpaid + own** bookings |
| GET    | `/payments/verify?session_id=`  | Customer | Verifies the Checkout session with Stripe, inserts payment, marks booking `paid` |
| POST   | `/payments/webhook`             | Stripe   | `checkout.session.completed`, signature-verified with raw body |
| GET    | `/payments/my`                  | Customer | Own payment history                                          |

Without Stripe keys these return a clean **503** instead of crashing.

### Admin
| Method | Endpoint                       | Access | Notes                                    |
| ------ | ------------------------------ | ------ | ---------------------------------------- |
| GET    | `/admin/stats`                 | Admin  | Totals, revenue, statusCounts, categoryCounts |
| GET    | `/admin/users`                 | Admin  | All users                                |
| PATCH  | `/admin/users/:id/role`        | Admin  | Change role (cannot change own)          |
| GET    | `/admin/services?approval=`    | Admin  | All services incl. pending               |
| PATCH  | `/admin/services/:id/approval` | Admin  | `approved` \| `rejected`                 |
| GET    | `/admin/bookings`              | Admin  | All bookings `?status=`                  |
| GET    | `/admin/payments`              | Admin  | All payments + totalRevenue              |

### Users & Uploads
| Method | Endpoint                 | Access     | Notes                                        |
| ------ | ------------------------ | ---------- | -------------------------------------------- |
| GET    | `/users/me`              | Any user   | Own profile                                  |
| PATCH  | `/users/profile`         | Any user   | name, phone, area, bio, image                |
| GET    | `/users/stats/customer`  | Customer   | totalRequests, activeJobs, completedJobs, totalSpent |
| GET    | `/users/stats/technician`| Technician | totalServices, pendingRequests, inProgress, completed, totalEarnings |
| POST   | `/uploads/image`         | Any user   | `{ image: "<base64 or data URL>" }` → hosted URL via ImgBB   |

## Stripe Testing (optional)

1. Put a test key `sk_test_...` in `.env` → `STRIPE_SECRET_KEY`
2. `POST /api/payments/create-checkout-session { bookingId }` → get `url`
3. Pay with test card `4242 4242 4242 4242` (any future date, any CVC)
4. On return, the client calls `GET /api/payments/verify?session_id=...`, or Stripe hits
   `POST /api/payments/webhook` (configure the endpoint + `whsec_...` secret in `.env`)
5. The booking becomes `paid` and a payment record is inserted (idempotent)

## Project Structure

```
fixmate-server/
├── scripts/
│   ├── memory-mongo.js         # in-memory MongoDB launcher (npm run dev:db)
│   ├── smoke-test.js           # 68-assertion end-to-end suite
│   ├── pipeline-live-test.js   # live-server pipeline & search tests
│   └── mongodb-live-proof.js   # Atlas + browser rendering proof
├── src/
│   ├── config/
│   │   ├── env.js              # validated env config
│   │   └── db.js               # MongoClient singleton + indexes
│   ├── lib/
│   │   └── auth.js             # BetterAuth instance (JWT plugin, role clamp hook)
│   ├── middlewares/
│   │   ├── auth.middleware.js  # verifyToken / verifyCustomer / verifyTechnician / verifyAdmin
│   │   └── error.middleware.js # 404 + centralized error handler + ApiError
│   ├── controllers/            # services, bookings, payments, admin, users, uploads, stats
│   ├── routes/                 # route definitions per resource
│   ├── seed/
│   │   └── seed.js             # demo data seeder (via BetterAuth API)
│   ├── utils/                  # helpers (oid, ok/fail, constants), stripe client
│   └── index.js                # bootstrap: CORS → BetterAuth handler → routes → errors
├── .env / .env.example
├── nodemon.json
└── package.json
```

## Security Notes

- **BetterAuth** manages passwords (scrypt), sessions (httpOnly cookies, cookie-cache) and account data
- **JWTs** are EdDSA-signed by the JWT plugin, verified with `jose` against the JWKS endpoint with issuer/audience checks
- Role is never trusted from the client: clamped at sign-up, re-read from the DB on every request
- CORS allow-list (`CLIENT_URL` + `CORS_ORIGINS`) matches BetterAuth `trustedOrigins`
- Amounts always come from the database (`finalAmount × 100`), never from the client
- Stripe webhook signature verified against the raw body before any processing
- Regex input escaped before Mongo `$regex`; ObjectIds validated before queries
- Secrets (MongoDB, BetterAuth, JWT, ImgBB, Stripe) live only in `.env`
