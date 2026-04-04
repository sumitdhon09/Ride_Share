# Environment Variables - Resend Setup

This file shows how to set environment variables for Resend OTP integration.

## On Windows (PowerShell)

Create a `.env.ps1` file:

```powershell
# Set Resend as mail provider
[Environment]::SetEnvironmentVariable("MAIL_PROVIDER", "resend", "User")

# Set your Resend API Key (get from https://dashboard.resend.com)
[Environment]::SetEnvironmentVariable("RESEND_API_KEY", "re_your_api_key_here", "User")

# Optional: Set custom from address (must be verified in Resend)
[Environment]::SetEnvironmentVariable("RESEND_FROM_ADDRESS", "noreply@yourdomain.com", "User")

# Enable OTP emails
[Environment]::SetEnvironmentVariable("MAIL_OTP_ENABLED", "true", "User")
[Environment]::SetEnvironmentVariable("AUTH_SIGNUP_OTP_ENABLED", "true", "User")
```

Then run:
```powershell
. .\.env.ps1
```

Or set them directly in PowerShell:
```powershell
$env:MAIL_PROVIDER = "resend"
$env:RESEND_API_KEY = "re_your_key_here"
$env:MAIL_OTP_ENABLED = "true"
```

## On Linux/Mac (Bash)

Add to `.bashrc` or `.zshrc`:

```bash
export MAIL_PROVIDER=resend
export RESEND_API_KEY=re_your_key_here
export RESEND_FROM_ADDRESS=noreply@yourdomain.com
export MAIL_OTP_ENABLED=true
export AUTH_SIGNUP_OTP_ENABLED=true
```

Then run:
```bash
source ~/.bashrc
```

Or set them directly:
```bash
export MAIL_PROVIDER=resend
export RESEND_API_KEY=re_your_api_key_here
```

## In Docker

Add to your Dockerfile or docker-compose.yml:

```yaml
environment:
  MAIL_PROVIDER: resend
  RESEND_API_KEY: re_your_key_here
  RESEND_FROM_ADDRESS: noreply@yourdomain.com
  MAIL_OTP_ENABLED: "true"
  AUTH_SIGNUP_OTP_ENABLED: "true"
```

Or pass at runtime:
```bash
docker run -e MAIL_PROVIDER=resend \
           -e RESEND_API_KEY=re_your_key \
           your-backend-image
```

## In Application Properties

You can also add to `application-local.properties`:

```properties
app.mail.provider=resend
app.mail.resend.api-key=re_your_key_here
app.mail.resend.from-address=onboarding@resend.dev
app.mail.otp.enabled=true
app.auth.signup-otp.enabled=true
```

## Verify Environment Variables Are Set

### Windows PowerShell
```powershell
$env:RESEND_API_KEY  # Should print your API key
```

### Linux/Mac
```bash
echo $RESEND_API_KEY  # Should print your API key
```

### Check Backend Logs
If set correctly, you should see in backend logs:
```
INFO: OTP email sent successfully via Resend to user@example.com
```

If not set:
```
WARN: Resend API key not configured; cannot send signup OTP
```

## Security Tips

⚠️ **Never commit API keys to git!**

- Use `.env` files (add to `.gitignore`)
- Use environment variables for sensitive data
- Rotate API keys periodically
- Create service-specific API keys in Resend Dashboard
- Delete old/unused keys

## Next Steps

1. Set the environment variables above
2. Restart the backend service
3. Test OTP with `/auth/signup/request-otp` endpoint
4. Check email for OTP code
5. See `RESEND_SETUP.md` for full documentation
