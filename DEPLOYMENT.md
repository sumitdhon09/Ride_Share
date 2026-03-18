# Deployment Guide

Deploy the two apps separately from the repository root:

- Backend root directory: `ridesharelive-backend-main`
- Frontend root directory: `ridesharelive-frontend-main`

## Backend

1. Copy `ridesharelive-backend-main/.env.aws.example` to `ridesharelive-backend-main/.env.aws`.
2. Set these required values before starting the backend:
   - `SPRING_PROFILES_ACTIVE=postgres`
   - `APP_JWT_SECRET` with a random secret at least 32 characters long
   - `APP_CORS_ALLOWED_ORIGINS` with your real frontend origin list
3. Leave `APP_SWAGGER_ENABLED=false` unless you have a specific reason to expose Swagger outside local development.
4. Use PostgreSQL and Redis in production. Do not deploy with the `local` profile or H2.
5. Keep `.env.aws` local to the deployment machine. Do not commit real secrets to git.

## Frontend

1. Copy `ridesharelive-frontend-main/.env.production.example` to `ridesharelive-frontend-main/.env.production`.
2. Set `VITE_API_BASE_URL` to your backend HTTPS URL.
3. Set `VITE_WS_BASE_URL` to your backend WSS URL if WebSocket traffic uses a different host from the API.
4. Build with `npm run build`.

## Checklist

- Backend secret and CORS env values are set
- Swagger is disabled in production
- Backend runs with `postgres` profile
- Frontend points at the production API URL
- Local secret files stay out of git
- Current code and config changes are committed before release
