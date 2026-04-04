# Resend Email Setup Guide

This guide explains how to configure Resend for OTP email delivery in RideShare Live backend.

## Overview

Resend is a modern email service that replaces traditional SMTP for sending transactional emails like OTPs. It's reliable, easy to set up, and has excellent deliverability.

## Prerequisites

1. A Resend account (sign up at https://resend.com)
2. A verified email domain or use the default testing domain
3. The Resend Java SDK (already added to `pom.xml`)

## Step 1: Get Your Resend API Key

1. Go to [Resend Dashboard](https://dashboard.resend.com)
2. Navigate to **API Keys** section
3. Create a new API key or copy your existing one
4. The key starts with `re_` (e.g., `re_your_api_key_here`)

## Step 2: Set Up Environment Variables

Add the following environment variables to your system or `.env` file:

```bash
# Switch mail provider to Resend
MAIL_PROVIDER=resend

# Your Resend API Key (keep this secret!)
RESEND_API_KEY=re_your_api_key_here

# Sender email address (must be verified in Resend dashboard)
RESEND_FROM_ADDRESS=noreply@yourdomain.com

# Display name for emails
MAIL_FROM_NAME=RideShare Live

# Enable OTP emails
MAIL_OTP_ENABLED=true

# Keep OTP service enabled
AUTH_SIGNUP_OTP_ENABLED=true
```

### Optional Environment Variables

```bash
# For local development - expose OTP in response (testing only!)
AUTH_SIGNUP_OTP_EXPOSE_DEV_OTP=true

# OTP validity period in seconds (default: 300)
AUTH_SIGNUP_OTP_TTL_SECONDS=300

# Time to wait before resending (default: 30)
AUTH_SIGNUP_OTP_RESEND_DELAY_SECONDS=30
```

## Step 3: Configure Resend From Address

### Option A: Using Resend's Default Domain (For Testing)

The default from address `onboarding@resend.dev` is already verified and works for testing.

```bash
RESEND_FROM_ADDRESS=onboarding@resend.dev
```

### Option B: Using Your Custom Domain (For Production)

1. In Resend Dashboard, go to **Domains**
2. Add your custom domain (e.g., `noreply@ridesharelive.com`)
3. Follow DNS verification steps provided by Resend
4. Once verified, use it:

```bash
RESEND_FROM_ADDRESS=noreply@ridesharelive.com
```

## Step 4: Application Configuration

The backend automatically detects the mail provider from the `MAIL_PROVIDER` environment variable:

- `MAIL_PROVIDER=resend` → Uses Resend (new)
- `MAIL_PROVIDER=smtp` or empty → Uses traditional SMTP (Gmail)

No code changes needed! The `SignupOtpService` automatically switches between providers.

## Step 5: Test the Integration

### Test OTP Generation

```bash
POST /auth/signup/request-otp
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com"
}
```

**Response (Success):**
```json
{
  "message": "OTP sent to your email address.",
  "emailSent": true,
  "expiresAt": "2026-03-29T09:32:03.935Z"
}
```

**Response (Dev Mode - when `AUTH_SIGNUP_OTP_EXPOSE_DEV_OTP=true`):**
```json
{
  "message": "OTP generated for local development.",
  "emailSent": false,
  "expiresAt": "2026-03-29T09:32:03.935Z",
  "devOtp": "123456"
}
```

### Check Email

If `emailSent: true`, check the provided email address for the OTP.

### Verify OTP

```bash
POST /auth/signup
Content-Type: application/json

{
  "name": "Test User",
  "email": "test@example.com",
  "password": "securePassword123!",
  "role": "RIDER",
  "otp": "123456"
}
```

## Email Template

The OTP email sent via Resend includes:

**Subject:** `RideShare Live Signup OTP`

**HTML Body:**
- Professional branded email template
- Large, easy-to-read OTP code
- Expiration notice (5 minutes)
- Security warning (don't share)
- Support contact

**Text Body:**
- Plain text fallback for clients that don't support HTML

## Troubleshooting

### "Email service is not configured"

**Cause:** `RESEND_API_KEY` is not set or is empty.

**Fix:** 
1. Verify you've copied the API key correctly from Resend Dashboard
2. Check that `MAIL_PROVIDER=resend` is set
3. Restart the backend service

### "No message ID returned"

**Cause:** Resend API didn't confirm email send.

**Fix:**
1. Check that your Resend account has email credits
2. Verify the from address is verified in Resend
3. Check backend logs for detailed error message

### OTP Email Not Arriving

**Causes:**
- From address not verified in Resend
- Email might be in spam folder
- Resend account rate limit exceeded

**Fix:**
1. Go to Resend Dashboard → Domains
2. Verify that your from address is in the "Verified" status
3. Check spam/junk folder in test email
4. Wait a few minutes before retrying

### Fallback to SMTP

If Resend is unavailable, temporarily fallback to SMTP:

```bash
MAIL_PROVIDER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
```

## Monitoring

### Check Resend Analytics

1. Go to [Resend Dashboard](https://dashboard.resend.com)
2. View email delivery stats, bounce rates, and logs
3. Monitor API quota usage

### Backend Logs

Look for log entries like:
```
INFO: OTP email sent successfully via Resend to user@example.com. Message ID: xxxxxxxx
ERROR: Failed to send signup OTP email via Resend: ...
```

## Security Considerations

1. **Never commit API keys** - Use environment variables
2. **Restrict API key permissions** - Create keys with minimal required scopes in Resend
3. **Rotate keys periodically** - Delete old keys after creating new ones
4. **Monitor for unusual activity** - Check Resend Dashboard for suspicious patterns
5. **Use production domains** - Avoid using `@resend.dev` in production

## Cost

- Resend offers **10,000 free emails per month**
- Additional emails are billed at $0.0005 per email
- Perfect for OTP use cases with moderate volume

## Migration from SMTP to Resend

1. **Add Resend dependency** (already done: v0.3.0)
2. **Set environment variables** as shown in Step 2
3. **Update `MAIL_PROVIDER=resend`**
4. **Restart the backend** - no code changes needed
5. **Monitor** first OTP sends to ensure it works
6. **Optional:** Remove SMTP credentials once confident

## Next Steps

- Test OTP functionality with signup flow
- Monitor delivery in Resend Dashboard
- Configure alerts for delivery failures
- Set up domain warming if sending high volume
- Document in team runbook

---

**Questions?** Check the [Resend Documentation](https://resend.com/docs) or contact support.
