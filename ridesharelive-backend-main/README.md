# RideShare Live Backend

Spring Boot backend for a ride-sharing application with JWT auth, OTP signup, ride booking, admin operations, notifications, Redis-backed live driver lookup, and Razorpay payment support.

## Stack

- Java 17
- Spring Boot 3
- Spring Security with JWT access and refresh tokens
- Spring Data JPA
- PostgreSQL + PostGIS or H2 for local development
- Redis for live driver location cache and OTP-related flows
- WebSocket support for live updates
- Razorpay payment integration
- SMTP or Resend for OTP email delivery
- OpenAPI / Swagger UI

## Main Features

- Email OTP based signup flow
- Login, refresh token, logout
- Ride fare estimation and ride booking
- Ride status updates, cancellation, feedback, and history
- Nearby driver lookup
- Predictive ride insights
- Admin dashboard APIs for users, drivers, rides, pricing, zones, alerts, analytics, payments, and settings
- In-app notifications
- User settings management

## Project Structure

```text
src/main/java/com/example/backend
|- config
|- controller
|- dto
|- entity
|- repository
|- security
|- service

src/main/resources
|- application.properties
|- application-local.properties
|- application-postgres.properties
|- application-prod.properties
```

## Profiles

- `local`
  Uses in-memory H2 by default and is the default profile.
- `postgres`
  Uses PostgreSQL and Redis for a closer production-like setup.
- `prod`
  Intended for deployed environments with externalized configuration.

## Prerequisites

- JDK 17
- Maven Wrapper included in repo
- Redis running on `localhost:6379` for flows that depend on Redis
- Optional:
  PostgreSQL/PostGIS for `postgres` profile
  MailPit, SMTP, or Resend for OTP emails

## Quick Start

### Local profile

1. Start Redis locally.
2. Set a JWT secret.
3. Run the app.

```powershell
$env:APP_JWT_SECRET="replace-with-a-long-random-secret"
.\mvnw.cmd spring-boot:run
```

App URLs:

- API: `http://localhost:8080`
- Health: `http://localhost:8080/health`
- Swagger UI: `http://localhost:8080/swagger-ui.html`
- H2 console: `http://localhost:8080/h2-console`

### PostgreSQL profile

Run with PostgreSQL and Redis:

```powershell
$env:SPRING_PROFILES_ACTIVE="postgres"
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/rideshare"
$env:SPRING_DATASOURCE_USERNAME="postgres"
$env:SPRING_DATASOURCE_PASSWORD="postgres"
$env:APP_JWT_SECRET="replace-with-a-long-random-secret"
.\mvnw.cmd spring-boot:run
```

## Docker Compose

The repo includes `docker-compose.yml` for:

- `server`
- `postgresdb` with PostGIS
- `redis`
- `mailpit`

Start everything:

```powershell
docker compose up --build
```

Default exposed ports:

- Backend: `8080`
- PostgreSQL: `5432`
- Redis: `6379`
- MailPit SMTP: `1025`
- MailPit UI: `8025`

## Important Environment Variables

Minimum recommended variables:

```env
APP_JWT_SECRET=replace-with-a-long-random-secret
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
```

Database:

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/rideshare
SPRING_DATASOURCE_USERNAME=postgres
SPRING_DATASOURCE_PASSWORD=postgres
```

Mail and OTP:

```env
MAIL_PROVIDER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email
MAIL_PASSWORD=your-app-password
MAIL_OTP_ENABLED=true
AUTH_SIGNUP_OTP_ENABLED=true
AUTH_SIGNUP_OTP_EXPOSE_DEV_OTP=false
```

Resend option:

```env
MAIL_PROVIDER=resend
RESEND_API_KEY=re_your_key_here
RESEND_FROM_ADDRESS=noreply@yourdomain.com
```

Payments:

```env
PAYMENT_RAZORPAY_KEY_ID=your_key_id
PAYMENT_RAZORPAY_KEY_SECRET=your_key_secret
PAYMENT_CURRENCY=INR
```

Routing and CORS:

```env
ROUTING_OSRM_BASE_URL=https://router.project-osrm.org
APP_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
APP_SWAGGER_ENABLED=true
```

See also:

- `ENV_VARIABLES.md`
- `SMTP_SETUP.md`
- `RESEND_SETUP.md`
- `QUICK_SETUP_RESEND.md`
- `.env.production.example`
- `.env.smtp.example`

## API Overview

Public:

- `GET /`
- `GET /health`

Authentication:

- `POST /auth/signup/request-otp`
- `POST /auth/signup`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

Rides:

- `POST /rides/book`
- `GET /rides/estimate`
- `POST /rides/status/{rideId}`
- `GET /rides/history`
- `GET /rides/requested`
- `GET /rides/status/{rideId}`
- `GET /rides/drivers/nearby`
- `GET /rides/insights/predictive`
- `POST /rides/feedback/{rideId}`
- `POST /rides/location/{rideId}`
- `POST /rides/cancel/{rideId}`

Payments:

- `POST /payments/order`
- `POST /payments/verify`
- `GET /payments/session/{sessionId}`

Notifications:

- `GET /notifications/history`
- `POST /notifications/mark-read/{notificationId}`
- `POST /notifications/mark-all-read`
- `POST /notifications/test`

User settings:

- `GET /user-settings`
- `PUT /user-settings`

Admin:

- Base path: `/api/admin`
- Includes overview, users, drivers, rides, pricing, complaints, payments, zones, alerts, analytics, live-map, and settings endpoints

For full request/response details, use Swagger UI.

## Authentication Notes

- Most non-public endpoints require `Authorization: Bearer <access-token>`.
- Login returns both access and refresh tokens.
- Signup requires OTP verification before account creation.
- Supported roles include `USER`, `RIDER`, `DRIVER`, and `ADMIN`.

## Development Notes

- Default profile is `local`.
- `spring.jpa.hibernate.ddl-auto=update` is enabled, so schema updates happen automatically.
- Swagger is enabled by default unless disabled through env vars.
- Local H2 and production PostgreSQL configs are both available.
- Some flows depend on Redis. If Redis is down, related features may fail or return empty results.

## Build and Test

Build:

```powershell
.\mvnw.cmd clean package
```

Run tests:

```powershell
.\mvnw.cmd test
```

## Deployment Notes

- Do not commit secrets, API keys, SMTP passwords, or production `.env` files.
- Set `APP_SWAGGER_ENABLED=false` in production unless docs are intentionally public.
- Use a strong `APP_JWT_SECRET`.
- Configure production PostgreSQL, Redis, SMTP/Resend, CORS origins, and Razorpay credentials through environment variables.

## Current Repository Notes

- `.env.smtp.local` is gitignored.
- Runtime log files exist in the working tree; review them before committing if you do not want them in the repository.
