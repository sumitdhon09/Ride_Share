# SMTP Setup For Signup OTP

Use these environment variables to enable email OTP delivery from backend:

```env
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_SMTP_AUTH=true
MAIL_SMTP_STARTTLS_ENABLE=true
MAIL_SMTP_STARTTLS_REQUIRED=true
MAIL_SMTP_SSL_ENABLE=false
MAIL_SMTP_CONNECTION_TIMEOUT_MS=5000
MAIL_SMTP_TIMEOUT_MS=5000
MAIL_SMTP_WRITE_TIMEOUT_MS=5000
MAIL_OTP_ENABLED=true
MAIL_SKIP_IF_NO_SMTP_HOST=false
MAIL_FROM_ADDRESS=your-email@gmail.com
MAIL_FROM_NAME=RideShare Live
AUTH_SIGNUP_OTP_EXPOSE_DEV_OTP=false
```

## Gmail notes

- Enable 2-Step Verification.
- Generate an App Password (16 characters).
- Use the app password in `MAIL_PASSWORD` (not your normal Gmail login password).

## Where to set values

- Docker compose run: set these values in `.env.aws` (or deployment environment).
- Host-based backend run (`mvnw` / `scripts/run-postgres.ps1`): use host-resolvable values (for example `MAIL_HOST=localhost` when using Mailpit on host).
- You can load a custom env file for host-based runs:
  `scripts/run-postgres.ps1 -EnvFile .env.smtp.local`

## Verify OTP flow

1. Request OTP:
   `POST /auth/signup/request-otp` with body:
   `{"name":"Test User","email":"you@example.com"}`
2. If SMTP is configured correctly, response includes `"emailSent": true`.
3. Complete signup:
   `POST /auth/signup` with `name`, `email`, `password`, `role`, and `otp`.
