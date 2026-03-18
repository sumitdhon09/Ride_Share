# 🚗 RideShare Live - Ride Sharing Application

> **A Modern, Fast, and Secure Ride-Sharing Platform built with Spring Boot, React, and Real-time Location Tracking**

## Repository Layout

- `ridesharelive-backend-main/` : Spring Boot backend for separate backend deployment
- `ridesharelive-frontend-main/` : React/Vite frontend for separate frontend deployment
- `DEPLOYMENT.md` : deployment setup notes and required environment variables

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Status](https://img.shields.io/badge/status-Active%20Development-brightgreen.svg)

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Running the Application](#-running-the-application)
- [API Documentation](#-api-documentation)
- [Database Schema](#-database-schema)
- [Authentication](#-authentication)
- [Email System](#-email-system)
- [Deployment](#-deployment)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [Support](#-support)

---

## ✨ Features

### 🔐 **Authentication & Security**
- ✅ JWT Token-based authentication
- ✅ OTP verification via Email
- ✅ Secure password hashing (bcrypt)
- ✅ Role-based access control (User/Driver/Admin)
- ✅ 2-Factor Authentication ready

### 📍 **Real-time Features**
- ✅ Live location tracking
- ✅ WebSocket real-time updates
- ✅ Live driver tracking
- ✅ Real-time ride notifications
- ✅ Route optimization

### 💳 **Payment Integration**
- ✅ Stripe payment gateway
- ✅ Multiple payment methods
- ✅ Digital wallet support
- ✅ Transaction history
- ✅ Refund management

### 👥 **User Management**
- ✅ User registration & login
- ✅ Driver registration
- ✅ Profile management
- ✅ Rating & reviews system
- ✅ User verification badges

### 📱 **Ride Management**
- ✅ Book a ride
- ✅ Schedule rides
- ✅ Accept/Reject rides (for drivers)
- ✅ Ride history
- ✅ Ride sharing with groups

### 🔔 **Notifications**
- ✅ Email notifications
- ✅ SMS notifications (Twilio)
- ✅ Push notifications
- ✅ Ride updates
- ✅ Payment confirmations

### 📊 **Admin Dashboard**
- ✅ User management
- ✅ Driver verification
- ✅ Transaction monitoring
- ✅ Analytics & reports
- ✅ Support ticket system

---

## 🛠 Tech Stack

### **Backend**
```
Spring Boot 3.5.3
Java 17
Spring Data JPA
Spring Security
Spring WebSocket
PostgreSQL 14+
Redis (Caching & Sessions)
Maven
```

### **Frontend**
```
React 18+
Next.js (optional)
Tailwind CSS
React Query
Axios
Socket.io (Real-time)
Leaflet Maps (Location)
```

### **External Services**
```
Gmail SMTP (Email)
Twilio (SMS)
Stripe (Payments)
Google Maps API (Location)
Firebase (Push Notifications)
```

### **DevOps & Deployment**
```
Docker
Docker Compose
Kubernetes (Production)
AWS / Azure / GCP
CI/CD Pipeline (GitHub Actions)
```

---

## 📁 Project Structure

```
ridesharelive-backend/
│
├── src/
│   └── main/
│       ├── java/com/example/backend/
│       │   ├── auth/
│       │   │   ├── AuthController.java
│       │   │   ├── JwtFilter.java
│       │   │   └── JwtUtil.java
│       │   │
│       │   ├── service/
│       │   │   ├── UserService.java
│       │   │   ├── RideService.java
│       │   │   ├── DriverService.java
│       │   │   ├── PaymentService.java
│       │   │   ├── EmailService.java
│       │   │   ├── LocationService.java
│       │   │   └── NotificationService.java
│       │   │
│       │   ├── controller/
│       │   │   ├── UserController.java
│       │   │   ├── RideController.java
│       │   │   ├── DriverController.java
│       │   │   ├── PaymentController.java
│       │   │   └── LocationController.java
│       │   │
│       │   ├── model/
│       │   │   ├── User.java
│       │   │   ├── Driver.java
│       │   │   ├── Ride.java
│       │   │   ├── Payment.java
│       │   │   └── Location.java
│       │   │
│       │   ├── repository/
│       │   │   ├── UserRepository.java
│       │   │   ├── RideRepository.java
│       │   │   ├── PaymentRepository.java
│       │   │   └── LocationRepository.java
│       │   │
│       │   ├── config/
│       │   │   ├── SecurityConfig.java
│       │   │   ├── CorsConfig.java
│       │   │   └── WebSocketConfig.java
│       │   │
│       │   └── RideShareLiveApplication.java
│       │
│       └── resources/
│           ├── application.properties
│           ├── application-dev.properties
│           ├── application-prod.properties
│           └── db/
│               └── migration/ (Flyway scripts)
│
├── pom.xml
├── Dockerfile
├── docker-compose.yml
├── README.md
└── .env.example
```

---

## 📦 Prerequisites

### **Required**
- **Java 17+** - `java -version`
- **Maven 3.8+** - `mvn -version`
- **PostgreSQL 14+** - Database
- **Redis 6+** - Caching
- **Git** - Version control

### **Optional**
- **Docker** - For containerization
- **Docker Compose** - For multi-container setup
- **Postman** - API testing
- **Node.js 18+** - For frontend

### **Accounts Required**
- **Gmail Account** - Email service
- **Stripe Account** - Payment processing
- **Twilio Account** - SMS service
- **Google Cloud** - Maps & APIs

---

## 🚀 Installation

### **Step 1: Clone the Repository**

```bash
git clone https://github.com/yourusername/ridesharelive-backend.git
cd ridesharelive-backend
```

### **Step 2: Install Java 17**

```bash
# Windows (using winget)
winget install Oracle.JDK.17

# macOS (using brew)
brew install openjdk@17

# Linux (Ubuntu/Debian)
sudo apt-get install openjdk-17-jdk
```

### **Step 3: Install PostgreSQL**

```bash
# Windows
winget install PostgreSQL

# macOS
brew install postgresql

# Linux
sudo apt-get install postgresql postgresql-contrib
```

**Create Database:**
```bash
psql -U postgres
CREATE DATABASE ridesharelive;
CREATE USER ridesharelive_user WITH PASSWORD 'secure_password';
ALTER ROLE ridesharelive_user SET client_encoding TO 'utf8';
GRANT ALL PRIVILEGES ON DATABASE ridesharelive TO ridesharelive_user;
```

### **Step 4: Install Redis**

```bash
# Windows (using WSL or Docker)
docker run -d -p 6379:6379 redis:latest

# macOS
brew install redis

# Linux
sudo apt-get install redis-server
```

### **Step 5: Clone and Setup Project**

```bash
# Clone
git clone https://github.com/yourusername/ridesharelive-backend.git
cd ridesharelive-backend

# Create .env file
cp .env.example .env

# Install dependencies
mvn clean install
```

---

## ⚙️ Configuration

### **1. Environment Variables (.env)**

Create `.env` file in project root:

```env
# ===================== DATABASE =====================
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ridesharelive
DB_USERNAME=ridesharelive_user
DB_PASSWORD=secure_password

# ===================== REDIS =====================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# ===================== JWT =====================
JWT_SECRET=your_super_secret_jwt_key_minimum_256_bits_long
JWT_EXPIRATION=86400000

# ===================== EMAIL (Gmail SMTP) =====================
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=yourgmail@gmail.com
MAIL_PASSWORD=your_16_char_google_app_password
MAIL_FROM_ADDRESS=yourgmail@gmail.com
MAIL_FROM_NAME=RideShare Live

# ===================== SMS (Twilio) =====================
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# ===================== PAYMENT (Stripe) =====================
STRIPE_API_KEY=your_stripe_api_key
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# ===================== GOOGLE MAPS =====================
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# ===================== APPLICATION =====================
APP_ENV=development
APP_URL=http://localhost:8080
CORS_ORIGIN=http://localhost:3000
```

### **2. application.properties**

```properties
# Server Configuration
server.port=8080
server.servlet.context-path=/api/v1

# Database Configuration
spring.datasource.url=jdbc:postgresql://${DB_HOST}:${DB_PORT}/${DB_NAME}
spring.datasource.username=${DB_USERNAME}
spring.datasource.password=${DB_PASSWORD}
spring.jpa.hibernate.ddl-auto=validate
spring.jpa.database-platform=org.hibernate.dialect.PostgreSQL10Dialect

# JPA/Hibernate
spring.jpa.show-sql=false
spring.jpa.properties.hibernate.format_sql=true
spring.jpa.properties.hibernate.generate_statistics=false

# Redis Configuration
spring.redis.host=${REDIS_HOST}
spring.redis.port=${REDIS_PORT}
spring.cache.type=redis

# Email Configuration
spring.mail.host=${MAIL_HOST}
spring.mail.port=${MAIL_PORT}
spring.mail.username=${MAIL_USERNAME}
spring.mail.password=${MAIL_PASSWORD}
spring.mail.properties.mail.smtp.auth=true
spring.mail.properties.mail.smtp.starttls.enable=true
mail.from.address=${MAIL_FROM_ADDRESS}
mail.from.name=${MAIL_FROM_NAME}

# Security
jwt.secret=${JWT_SECRET}
jwt.expiration=${JWT_EXPIRATION}

# Logging
logging.level.root=INFO
logging.level.com.example.backend=DEBUG
logging.file.name=logs/application.log
```

---

## 🏃 Running the Application

### **Development Mode**

```bash
# Using Maven
mvn spring-boot:run

# Or build and run JAR
mvn clean package
java -jar target/ridesharelive-1.0.0.jar
```

### **With Docker**

```bash
# Build image
docker build -t ridesharelive:1.0 .

# Run container
docker run -p 8080:8080 --env-file .env ridesharelive:1.0
```

### **Using Docker Compose** (Recommended)

```bash
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### **Access Application**

```
Backend API: http://localhost:8080
API Docs: http://localhost:8080/swagger-ui.html
H2 Console: http://localhost:8080/h2-console
```

---

## 📚 API Documentation

### **Authentication Endpoints**

#### **Register User**
```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+919876543210",
  "role": "USER"
}

Response (201):
{
  "success": true,
  "message": "✅ User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "firstName": "John"
  }
}
```

#### **Login**
```bash
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}

Response (200):
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### **Send OTP**
```bash
POST /api/v1/email/send-otp?email=user@example.com

Response (200):
{
  "success": true,
  "message": "✅ OTP sent successfully"
}
```

#### **Verify OTP**
```bash
POST /api/v1/email/verify-otp?email=user@example.com&otp=123456

Response (200):
{
  "success": true,
  "message": "✅ OTP verified"
}
```

### **Ride Endpoints**

#### **Create Ride**
```bash
POST /api/v1/rides/create
Authorization: Bearer {token}
Content-Type: application/json

{
  "pickupLocation": {
    "latitude": 28.7041,
    "longitude": 77.1025
  },
  "dropoffLocation": {
    "latitude": 28.6139,
    "longitude": 77.2090
  },
  "rideType": "STANDARD",
  "scheduledTime": "2024-03-10T10:30:00"
}

Response (201):
{
  "success": true,
  "rideId": 1,
  "estimatedPrice": 250.00,
  "estimatedDuration": "25 mins"
}
```

#### **Get Ride Details**
```bash
GET /api/v1/rides/{rideId}
Authorization: Bearer {token}

Response (200):
{
  "id": 1,
  "status": "ACTIVE",
  "driver": { ... },
  "passenger": { ... },
  "pickupLocation": { ... },
  "dropoffLocation": { ... }
}
```

### **Payment Endpoints**

#### **Process Payment**
```bash
POST /api/v1/payments/process
Authorization: Bearer {token}
Content-Type: application/json

{
  "rideId": 1,
  "amount": 250.00,
  "paymentMethod": "CARD",
  "stripeToken": "tok_visa"
}

Response (200):
{
  "success": true,
  "transactionId": "txn_123456",
  "status": "SUCCESS"
}
```

---

## 🗄️ Database Schema

### **Users Table**
```sql
CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone_number VARCHAR(20),
  profile_picture_url VARCHAR(500),
  is_verified BOOLEAN DEFAULT false,
  rating DECIMAL(3,2),
  total_rides INT DEFAULT 0,
  role VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Rides Table**
```sql
CREATE TABLE rides (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id),
  driver_id BIGINT REFERENCES users(id),
  status VARCHAR(50),
  pickup_latitude DECIMAL(10,8),
  pickup_longitude DECIMAL(11,8),
  dropoff_latitude DECIMAL(10,8),
  dropoff_longitude DECIMAL(11,8),
  ride_type VARCHAR(50),
  estimated_price DECIMAL(10,2),
  actual_price DECIMAL(10,2),
  estimated_duration INT,
  actual_duration INT,
  scheduled_time TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **Payments Table**
```sql
CREATE TABLE payments (
  id BIGSERIAL PRIMARY KEY,
  ride_id BIGINT REFERENCES rides(id),
  user_id BIGINT REFERENCES users(id),
  amount DECIMAL(10,2),
  payment_method VARCHAR(50),
  stripe_transaction_id VARCHAR(255),
  status VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔐 Authentication

### **JWT Implementation**

```
Header: Authorization: Bearer {token}

Token Structure:
{
  "header": { "alg": "HS256", "typ": "JWT" },
  "payload": {
    "sub": "user@example.com",
    "userId": 1,
    "role": "USER",
    "iat": 1704067200,
    "exp": 1704153600
  },
  "signature": "..."
}
```

### **Token Expiration**
- Access Token: 24 hours
- Refresh Token: 7 days
- OTP Token: 5 minutes

---

## 📧 Email System

### **Supported Email Types**

1. **OTP Email** - 6-digit OTP (5 mins validity)
2. **Welcome Email** - New user registration
3. **Password Reset** - Password recovery
4. **Ride Notifications** - Ride updates
5. **Payment Confirmations** - Transaction receipts

### **Setup Gmail**

```
1. https://myaccount.google.com/apppasswords
2. Select "Mail" and "Windows Computer"
3. Generate 16-character password
4. Add to MAIL_PASSWORD in .env
```

---

## 🚢 Deployment

### **Heroku Deployment**

```bash
# Login to Heroku
heroku login

# Create app
heroku create ridesharelive

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main

# View logs
heroku logs --tail
```

### **AWS Deployment**

```bash
# Create EC2 instance
# Install Java, PostgreSQL, Redis
# Clone repository
# Configure .env
# Run with PM2

npm install -g pm2
pm2 start "mvn spring-boot:run" --name ridesharelive
pm2 save
```

### **Docker Compose Production**

```bash
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale api=3
```

---

## 🐛 Troubleshooting

### **Problem: Port 8080 already in use**
```bash
# Windows
netstat -ano | findstr :8080
taskkill /PID {PID} /F

# macOS/Linux
lsof -i :8080
kill -9 {PID}
```

### **Problem: Database connection failed**
```bash
# Check PostgreSQL status
sudo service postgresql status

# Restart PostgreSQL
sudo service postgresql restart

# Test connection
psql -U postgres -h localhost
```

### **Problem: Redis connection error**
```bash
# Check Redis
redis-cli ping

# Restart Redis
sudo service redis-server restart
```

### **Problem: Email not sending**
```
1. Check Gmail App Password (16 chars)
2. Enable SMTP in Gmail settings
3. Check firewall (port 587)
4. Verify MAIL_USERNAME in .env
```

---

## 📈 Performance Optimization

### **Caching**
```properties
spring.cache.type=redis
spring.redis.timeout=2000ms
```

### **Connection Pooling**
```properties
spring.datasource.hikari.maximum-pool-size=20
spring.datasource.hikari.minimum-idle=5
```

### **Database Indexes**
```sql
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_ride_user ON rides(user_id);
CREATE INDEX idx_ride_status ON rides(status);
```

---

## 📝 Logging

```
logs/
├── application.log
├── error.log
└── access.log
```

---

## 🔄 CI/CD Pipeline

### **.github/workflows/build.yml**

```yaml
name: Build & Test
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Set up JDK 17
        uses: actions/setup-java@v2
        with:
          java-version: '17'
      - name: Build with Maven
        run: mvn clean package
      - name: Run Tests
        run: mvn test
```

---

## 📚 Additional Resources

- [Spring Boot Documentation](https://spring.io/projects/spring-boot)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [JWT Guide](https://jwt.io/)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Google Maps API](https://developers.google.com/maps)

---

## 👥 Contributing

```bash
# Fork the repository
# Create feature branch
git checkout -b feature/amazing-feature

# Commit changes
git commit -m 'Add amazing feature'

# Push to branch
git push origin feature/amazing-feature

# Open Pull Request
```

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 📞 Support

- **Email:** support@ridesharelive.com
- **Issues:** GitHub Issues
- **Discussions:** GitHub Discussions
- **Website:** www.ridesharelive.com

---

## 🙏 Acknowledgments

- Spring Boot Community
- PostgreSQL Contributors
- All contributors and users

---

## 📊 Project Statistics

```
Lines of Code: 5000+
Database Tables: 10+
API Endpoints: 50+
Test Coverage: 80%+
```

---

