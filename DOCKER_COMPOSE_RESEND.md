# Docker Compose Setup with Resend

This example shows how to run the RideShare backend with Resend OTP configured.

## Basic Docker Compose with Resend

```yaml
version: '3.9'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:14-alpine
    container_name: ridesharelive-postgres
    environment:
      POSTGRES_DB: ridesharelive
      POSTGRES_USER: ridesharelive
      POSTGRES_PASSWORD: your_password_here
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ridesharelive"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    container_name: ridesharelive-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend Application with Resend
  backend:
    build:
      context: ./ridesharelive-backend-main
      dockerfile: Dockerfile
    container_name: ridesharelive-backend
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      # Database
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/ridesharelive
      SPRING_DATASOURCE_USERNAME: ridesharelive
      SPRING_DATASOURCE_PASSWORD: your_password_here
      SPRING_DATA_REDIS_HOST: redis
      SPRING_DATA_REDIS_PORT: 6379

      # JWT
      APP_JWT_SECRET: your_32_char_secret_key_here_minimum_32_chars_required_1234567890

      # Resend OTP Configuration
      MAIL_PROVIDER: resend
      RESEND_API_KEY: re_your_api_key_here
      RESEND_FROM_ADDRESS: onboarding@resend.dev  # or your verified domain
      MAIL_FROM_NAME: RideShare Live
      MAIL_OTP_ENABLED: "true"
      AUTH_SIGNUP_OTP_ENABLED: "true"

      # Razorpay (optional)
      PAYMENT_RAZORPAY_KEY_ID: rzp_test_key_id_here
      PAYMENT_RAZORPAY_KEY_SECRET: razorpay_secret_here
      PAYMENT_CURRENCY: INR

      # CORS
      APP_CORS_ALLOWED_ORIGINS: http://localhost:5173,http://127.0.0.1:5173

      # Profiles
      SPRING_PROFILES_ACTIVE: postgres

    ports:
      - "8080:8080"
    networks:
      - ridesharelive-network

  # Frontend Application
  frontend:
    build:
      context: ./ridesharelive-frontend-main
      dockerfile: Dockerfile
    container_name: ridesharelive-frontend
    depends_on:
      - backend
    environment:
      VITE_API_URL: http://localhost:8080
    ports:
      - "5173:5173"
    networks:
      - ridesharelive-network

volumes:
  postgres_data:

networks:
  ridesharelive-network:
    driver: bridge
```

## Running with Docker Compose

### 1. Create `.env` file in project root

```env
# Database
POSTGRES_PASSWORD=your_secure_password_here

# JWT Secret (minimum 32 characters)
APP_JWT_SECRET=your_32_character_secret_key_minimum_required_1234567890

# Resend Configuration
RESEND_API_KEY=re_your_api_key_from_dashboard
RESEND_FROM_ADDRESS=onboarding@resend.dev

# Razorpay (if using payments)
PAYMENT_RAZORPAY_KEY_ID=rzp_test_key_id_here
PAYMENT_RAZORPAY_KEY_SECRET=razorpay_secret_here
```

### 2. Build and Start

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up

# Run in background
docker-compose up -d
```

### 3. Verify Services

```bash
# Check services status
docker-compose ps

# View logs
docker-compose logs backend
docker-compose logs frontend

# Test backend health
curl http://localhost:8080/health

# Access frontend
open http://localhost:5173
```

### 4. Test OTP Functionality

```bash
# Request OTP
curl -X POST http://localhost:8080/auth/signup/request-otp \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com"
  }'

# Response
{
  "message": "OTP sent to your email address.",
  "emailSent": true,
  "expiresAt": "2026-03-29T09:35:00Z"
}
```

## Important Notes

### 1. Environment Variables
- **RESEND_API_KEY** - Get from [Resend Dashboard](https://dashboard.resend.com)
- **APP_JWT_SECRET** - Must be at least 32 characters
- **POSTGRES_PASSWORD** - Use a strong password in production

### 2. Security
- Never commit `.env` file to git (add to `.gitignore`)
- Use separate API keys for development and production
- Rotate keys periodically
- Use environment-specific secrets management in production

### 3. Resend Domain
- Default: `onboarding@resend.dev` (testing)
- Production: Verify your custom domain in Resend Dashboard
- Update `RESEND_FROM_ADDRESS` after domain verification

### 4. Production Deployment
For production on Railway, Heroku, or similar:
- Use managed secrets/environment variables
- Don't include API keys in compose files
- Use separate database service (AWS RDS, etc.)
- Enable SSL/TLS

## Docker Compose Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Rebuild services
docker-compose up -d --build

# View logs
docker-compose logs -f backend

# Execute command in container
docker-compose exec backend sh

# Remove volumes (careful!)
docker-compose down -v
```

## Troubleshooting

### Backend won't start
```bash
docker-compose logs backend
# Check for RESEND_API_KEY or other environment variable issues
```

### Can't connect to PostgreSQL
```bash
# Verify postgres is healthy
docker-compose ps

# Check postgres logs
docker-compose logs postgres
```

### OTP not sending
```bash
# Check if Resend is configured
docker-compose exec backend grep "RESEND_API_KEY" /proc/*/environ

# Check logs
docker-compose logs backend | grep -i resend
```

## Example: Update Backend

```bash
# Pull latest code
git pull origin main

# Rebuild backend
docker-compose up -d --build backend

# View logs
docker-compose logs -f backend
```

## Performance Tuning

### Connection Pool
```yaml
environment:
  SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: "20"
  SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE: "5"
```

### Redis Cache
```yaml
environment:
  SPRING_DATA_REDIS_TIMEOUT: "2000ms"
```

## Monitoring

### Container Stats
```bash
docker stats ridesharelive-backend
```

### Network Communication
```bash
docker network inspect ridesharelive-network
```

---

For more details on Resend setup, see **RESEND_SETUP.md** and **QUICK_SETUP_RESEND.md**
