# FixMate API — Server

Smart Device & Home Appliance Repair Service Platform (REST API) built with **Express 4 + MongoDB (native driver) + JWT (jose) + Stripe**.

## Tech Stack

| Layer     | Package                                   |
| --------- | ----------------------------------------- |
| Server    | express, cors, dotenv                     |
| Database  | mongodb (native driver)                   |
| Auth      | jose (JWT), scrypt password hashing, httpOnly cookie |
| Payments  | stripe (PaymentIntent + webhook)          |
| Dev tools | nodemon, mongodb-memory-server            |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start a database — pick ONE option:
npm run dev:db        # Option A: in-memory MongoDB (no install needed, data resets on stop)
#                     # Option B: your local MongoDB service
#                     # Option C: set DATABASE_URL in .env to a MongoDB Atlas URI

# 3. Seed demo data (admin, technicians, customers, services, bookings)
npm run seed          # or: npm run seed:fresh  (wipes collections first)

# 4. Start the API
npm run dev           # development (nodemon auto-restart)
npm start             # production mode
```

Health check: <http://localhost:5000/api/v1/health>

## Seeded Accounts

| Role       | Email                     | Password    |
| ---------- | ------------------------- | ----------- |
| Admin      | admin@fixmate.com         | Admin@1234  |
| Technician | tanvir.tech@fixmate.com   | Tech@1234   |
| Technician | nusrat.tech@fixmate.com   | Tech@1234   |
| Customer   | rahim@fixmate.com         | Cust@1234   |
| Customer   | karim@fixmate.com         | Cust@1234   |

## Environment Variables (`.env`)

| Variable                | Description                                        |
| ----------------------- | -------------------------------------------------- |
| `PORT`                  | API port (default 5000)                            |
| `NODE_ENV`              | development / production                           |
| `DATABASE_URL`          | MongoDB connection string                          |
| `DB_NAME`               | Database name (default `fixmate`)                  |
| `JWT_SECRET`            | Secret used to sign tokens (**required in prod**)  |
| `JWT_EXPIRES_IN`        | e.g. `7d`, `12h`                                   |
| `COOKIE_NAME`           | httpOnly auth cookie name                          |
| `CLIENT_URL`            | Comma-separated allowed CORS origins               |
| `STRIPE_SECRET_KEY`     | Stripe test key (`sk_test_...`) — optional         |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret (`whsec_...`)        |
| `SUPER_ADMIN_*`         | Credentials used by the seed script                |

## Scripts

| Script            | What it does                                |
| ----------------- | ------------------------------------------- |
| `npm run dev`     | Start API with nodemon (auto-restart)       |
| `npm start`       | Start API with node                         |
| `npm run dev:db`  | Start in-memory MongoDB on port 27017       |
| `npm run seed`    | Seed demo data (skips existing)             |
| `npm run seed:fresh` | Drop collections and re-seed everything  |

## API Reference (base: `/api/v1`)

### Auth
| Method | Endpoint                  | Access   | Notes                              |
| ------ | ------------------------- | -------- | ---------------------------------- |
| POST   | `/auth/register`          | Public   | Creates a customer account         |
| POST   | `/auth/login`             | Public   | Returns JWT + sets httpOnly cookie |
| POST   | `/auth/logout`            | Public   | Clears cookie                      |
| GET    | `/auth/me`                | Any user | Current profile                    |
| PATCH  | `/auth/profile`           | Any user | name, phone, address, photoURL     |
| POST   | `/auth/change-password`   | Any user | currentPassword, newPassword       |

### Users
| Method | Endpoint              | Access   | Notes                                    |
| ------ | --------------------- | -------- | ---------------------------------------- |
| GET    | `/users`              | Admin    | ?search= &role= &status= &sort= &page= &limit= |
| GET    | `/users/technicians`  | Admin    | Active technicians for assignment        |
| GET    | `/users/:id`          | Admin/self |                                        |
| PATCH  | `/users/:id`          | Admin/self | Admin: role, status; self: profile    |
| DELETE | `/users/:id`          | Admin    | Cannot delete self                       |

### Services
| Method | Endpoint                 | Access | Notes                                        |
| ------ | ------------------------ | ------ | -------------------------------------------- |
| GET    | `/services`              | Public | ?search= &category= &minPrice= &maxPrice= &sort=price-asc|price-desc|name|newest &page= &limit= |
| GET    | `/services/categories`   | Public | Distinct categories                          |
| GET    | `/services/:id`          | Public | Includes aggregated rating                   |
| POST   | `/services`              | Admin  | name, category, description, basePrice, image |
| PATCH  | `/services/:id`          | Admin  | Any field / isActive toggle                  |
| DELETE | `/services/:id`          | Admin  |                                              |

### Bookings
| Method | Endpoint                    | Access               | Notes                                     |
| ------ | --------------------------- | -------------------- | ----------------------------------------- |
| POST   | `/bookings`                 | Customer             | serviceId, deviceType, deviceModel, issueDescription, preferredDate?, address?, contactPhone? |
| GET    | `/bookings`                 | Any (role-scoped)    | Customers see own, technicians assigned, admins all; ?status= &paymentStatus= &search= |
| GET    | `/bookings/:id`             | Owner/tech/admin     | Includes statusHistory                    |
| PATCH  | `/bookings/:id`             | Owner (pending)/admin| Edit details; admin can set totalCost     |
| PATCH  | `/bookings/:id/assign`      | Admin                | { technicianId }                          |
| PATCH  | `/bookings/:id/status`      | Role-based           | { status, note? }                         |

Booking status flow: `pending → assigned → in-progress → completed` (or `cancelled`).
Customers may cancel their own pending booking; technicians update only their assigned jobs.

### Payments
| Method | Endpoint              | Access   | Notes                                            |
| ------ | --------------------- | -------- | ------------------------------------------------ |
| POST   | `/payments/intent`    | Owner    | Stripe PaymentIntent → { clientSecret }          |
| POST   | `/payments/confirm`   | Owner    | Verifies intent with Stripe, marks booking paid  |
| POST   | `/payments/webhook`   | Stripe   | Signature-verified (`payment_intent.succeeded`)  |
| POST   | `/payments/cash`      | Admin    | Record a cash payment { bookingId }              |
| GET    | `/payments/mine`      | Customer | Own payment history                              |
| GET    | `/payments`           | Admin    | All payments, ?method= &search=                  |

Without Stripe keys, use the **cash** endpoint to mark bookings paid.

### Reviews
| Method | Endpoint         | Access               | Notes                                    |
| ------ | ---------------- | -------------------- | ---------------------------------------- |
| POST   | `/reviews`       | Customer (owner)     | { bookingId, rating 1-5, comment } — booking must be completed + paid |
| GET    | `/reviews`       | Public (filtered)    | ?serviceId= or ?technicianId=            |
| DELETE | `/reviews/:id`   | Owner/admin          |                                          |

## Authentication

Send the token either way:

```bash
Authorization: Bearer <token>
```

or via the httpOnly cookie `fixmate_token` (set automatically on login/register).

Example:

```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fixmate.com","password":"Admin@1234"}' \
  | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).data.token))")

curl http://localhost:5000/api/v1/users -H "Authorization: Bearer $TOKEN"
```

## Stripe Testing (optional)

1. Put a test key `sk_test_...` in `.env` → `STRIPE_SECRET_KEY`
2. `POST /payments/intent { bookingId }` → get `clientSecret`
3. Complete payment on the client (test card `4242 4242 4242 4242`, any future date, any CVC)
4. Either `POST /payments/confirm { bookingId }` or configure a webhook endpoint to `POST /payments/webhook` with `STRIPE_WEBHOOK_SECRET`

## Project Structure

```
fixmate-server/
├── scripts/
│   └── dev-db.js              # in-memory MongoDB launcher
├── src/
│   ├── config/
│   │   ├── env.js             # validated env config
│   │   └── database.js        # MongoClient singleton
│   ├── controllers/           # request handlers (auth, user, service, booking, payment, review)
│   ├── middleware/
│   │   ├── auth.js            # verifyAuth / optionalAuth / requireRoles
│   │   └── error.js           # 404 + centralized error handler
│   ├── models/
│   │   └── index.js           # collections + indexes
│   ├── routes/                # route definitions per resource
│   ├── seed/
│   │   └── seed.js            # demo data seeder
│   ├── utils/                 # ApiError, jwt (jose), scrypt password, pagination, validation...
│   ├── app.js                 # express app (CORS, cookies, routes, errors)
│   └── index.js               # bootstrap: connect DB → indexes → listen
├── .env / .env.example
├── nodemon.json
└── package.json
```

## Security Notes

- Passwords hashed with scrypt (Node built-in) + per-user salt, timing-safe comparison
- JWT signed HS256 with `jose`, issuer/audience validated, 7-day expiry
- Role-based access control (`customer` / `technician` / `admin`)
- Regex input escaped before Mongo `$regex` use; ObjectIds validated before queries
- CORS restricted to `CLIENT_URL`; httpOnly + SameSite cookie; basic security headers
- Stripe webhook verified with the signing secret against the raw body
