# Resend OTP Integration - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        RideShare Backend (Spring Boot)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                     AuthController                               │   │
│  │  POST /auth/signup/request-otp                                   │   │
│  └────────────────────────┬─────────────────────────────────────────┘   │
│                           │                                             │
│                           ▼                                             │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                  SignupOtpService                                │   │
│  │  ┌─ Generates 6-digit OTP                                        │   │
│  │  ├─ Validates expiration (5 min)                                 │   │
│  │  ├─ Handles rate limiting (30 sec)                               │   │
│  │  │                                                               │   │
│  │  └─ Routes to Email Service Based on MAIL_PROVIDER:              │   │
│  └────────┬────────────────────────────────┬────────────────────── ─┘   │
│           │                                │                            │
│       "resend"                         "smtp"                           │
│           │                                │                            │
│           ▼                                ▼                            │
│  ┌──────────────────────┐    ┌──────────────────────────┐               │
│  │ ResendOtpEmail      │    │ OtpEmailService           │               │
│  │ Service (NEW)       │    │ (Existing - Fallback)      │              │
│  │                      │    │                           │              │
│  │ ├─ API Key mgmt     │    │ ├─ Gmail SMTP              │              │
│  │ ├─ HTML templates   │    │ └─ Traditional email    │              │
│  │ └─ Error handling   │    │                          │              │
│  └────────┬────────────┘    └────────┬─────────────────┘              │
│           │                          │                                 │
│           └──────────┬───────────────┘                                 │
│                      │                                                  │
│                      ▼                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │              Returns MailDeliveryResult                           │  │
│  │  {                                                                │  │
│  │    "sent": true/false,                                           │  │
│  │    "message": "OTP sent..." or error message                     │  │
│  │  }                                                                │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

            │                                  │
            └──────────────┬───────────────────┘
                           │
                    If EmailSent = true
                           │
        ┌──────────────────▼──────────────────┐
        │                                      │
        ▼                                      ▼
    ┌────────────┐                     ┌──────────────┐
    │  Resend    │                     │ Gmail SMTP   │
    │  API       │                     │ Server       │
    └────┬───────┘                     └──────┬───────┘
         │                                     │
         │                                     │
         ▼                                     ▼
    ┌────────────────────────────────────────────────┐
    │         User's Email Inbox                      │
    │  ╔════════════════════════════════════════╗   │
    │  ║   From: RideShare Live                 ║   │
    │  ║   Subject: RideShare Live Signup OTP   ║   │
    │  ║   ─────────────────────────────────────║   │
    │  ║   Hi User,                             ║   │
    │  ║                                        ║   │
    │  ║   Your OTP is:                         ║   │
    │  ║   ┌──────────────┐                     ║   │
    │  ║   │   123456     │  ← 6-digit OTP     ║   │
    │  ║   └──────────────┘                     ║   │
    │  ║                                        ║   │
    │  ║   Expires in 5 minutes                 ║   │
    │  ╚════════════════════════════════════════╝   │
    └────────────────────────────────────────────────┘
```

---

## Data Flow: From Signup to Email

```
1. Frontend: User requests OTP
   │
   ▼
   POST /auth/signup/request-otp
   {
     "name": "John Doe",
     "email": "john@example.com"
   }

2. Backend: AuthController receives request
   │
   ▼
   SignupOtpService.issueOtp()
   │
   ├─ Generate OTP: "123456"
   ├─ Store with 5-min expiration
   ├─ Set 30-sec resend delay
   │
   └─ Check MAIL_PROVIDER env variable
     │
     ├─ If "resend"
     │  └─ Use ResendOtpEmailService
     │
     └─ Else
        └─ Use OtpEmailService (SMTP)

3. Email Service routes to provider
   │
   ├─ Resend Path:
   │  ├─ Create Resend client with API key
   │  ├─ Build HTML + text email
   │  └─ Call: resend.emails().send()
   │
   └─ SMTP Path:
      ├─ Create MIME message
      ├─ Set headers and body
      └─ Call: javaMailSender.send()

4. Email delivery
   │
   ├─ If Resend: →  Resend API  →  Email Servers  →  Inbox
   │
   └─ If SMTP:   →  Gmail SMTP  →  Email Servers  →  Inbox

5. Response to frontend
   {
     "message": "OTP sent to your email address.",
     "emailSent": true,
     "expiresAt": "2026-03-29T09:35:00Z"
   }
```

---

## Configuration Switch

```
Environment Variable: MAIL_PROVIDER

┌─────────────────────────────────────────────────────────┐
│                 SignupOtpService                        │
└─────────────────────────────────────────────────────────┘

┌──────────────────────────┐  ┌──────────────────────────┐
│ MAIL_PROVIDER = "resend" │  │ MAIL_PROVIDER = "smtp"   │
│ or "resend"              │  │ or any other value       │
└──────────────┬───────────┘  └──────────┬───────────────┘
               │                         │
               ▼                         ▼
      ┌─────────────────┐      ┌─────────────────┐
      │ ResendOtpEmail  │      │ OtpEmailService │
      │ Service         │      │ (SMTP)          │
      │                 │      │                 │
      │ ✓ Modern        │      │ ✓ Traditional   │
      │ ✓ Reliable      │      │ ✓ Fallback      │
      │ ✓ Dashboard     │      │ ✓ No extra cost │
      │                 │      │                 │
      │ Needs:          │      │ Needs:          │
      │ • API Key       │      │ • SMTP host     │
      │ • Resend acct   │      │ • Gmail/office  │
      └─────────────────┘      └─────────────────┘
```

---

## OTP Lifecycle

```
Timeline: 5 minutes (300 seconds)

T=0:00 ──→ User requests OTP
           OTP Generated: "123456"
           Storage: pendingOtps["user@example.com"]
           Status: PENDING
           │
           ▼
T=0:10 ──→ Resend API processes email
           Email in flight
           │
           ▼
T=0:30 ──→ Email delivered to user
           User sees OTP
           Can retry OTP request NOW
           │
           ▼
T=1:00 ──→ User enters OTP: "123456"
           Backend verifies
           OTP matches ✓
           Time valid ✓ (1 min < 5 min)
           │
           ▼
T=1:05 ──→ OTP VERIFIED
           User automatically logged in
           Storage: pendingOtps["user@example.com"] CLEARED
           │
T=5:00 ──→ If no verification:
           OTP EXPIRED
           Storage: pendingOtps["user@example.com"] CLEARED
           User must request new OTP
```

---

## Error Handling Flow

```
┌─ OTP Request ─────────────────────────────────┐
│                                               │
├─ Is MAIL_OTP_ENABLED = true?                 │
│  ├─ NO  → Return "Email OTP is disabled"     │
│  └─ YES → Continue                            │
│                                               │
├─ Is MAIL_PROVIDER = "resend"?                │
│  ├─ YES → Use ResendOtpEmailService          │
│  │        ├─ API Key configured?             │
│  │        │  ├─ NO  → Error                  │
│  │        │  └─ YES → Send via Resend        │
│  │        │          ├─ Success → OK         │
│  │        │          └─ Error → Catch        │
│  │                                            │
│  └─ NO  → Use OtpEmailService (SMTP)         │
│           ├─ SMTP configured?                │
│           │  ├─ NO  → Error                  │
│           │  └─ YES → Send via SMTP          │
│           │          ├─ Success → OK         │
│           │          └─ Error → Catch        │
│                                               │
└─ Return Response (Success or Error) ─────────┘
```

---

## Security Measures

```
┌─ OTP Request ─────────────────┐
│                               │
├─ Email Normalization          │
│  └─ Lowercase, trim spaces    │
│                               │
├─ Rate Limiting                │
│  └─ 30-second delay           │
│                               │
├─ Expiration Check             │
│  └─ 5-minute TTL              │
│                               │
├─ Code Validation              │
│  └─ Exact match required      │
│                               │
├─ API Key Security             │
│  └─ Environment variables     │
│     (Never in code/logs)      │
│                               │
└─ Logging                      │
   └─ Sanitized (no OTP shown)
```

---

## Provider Comparison

```
┌────────────────────────┬──────────────────┬──────────────────┐
│ Feature                │ Resend (NEW)     │ SMTP (Existing) │
├────────────────────────┼──────────────────┼──────────────────┤
│ Setup Time             │ 2 minutes        │ 10+ minutes      │
│ Deliverability         │ 99%+             │ 95-98%           │
│ Spam Rate              │ Very Low         │ Medium-High      │
│ Free Tier              │ 10k/month        │ Limited          │
│ Dashboard              │ Yes (advanced)   │ Limited          │
│ Authentication         │ API Key          │ Username+Pass    │
│ Configuration          │ Simple (3 vars)  │ Complex (6 vars) │
│ Provider Reliability   │ Enterprise       │ Depends on Gmail │
│ Custom Domain          │ Easy to verify   │ Gmail only       │
│ Rate Limiting          │ Built-in         │ Manual           │
│ HTML Templates         │ Full support     │ Basic            │
│ Monitoring             │ Excellent        │ Minimal          │
│ Cost Scale             │ Linear           │ Fixed            │
└────────────────────────┴──────────────────┴──────────────────┘
```

---

## Code Flow Diagram

```java
//AuthController.requestSignupOtp()
//    ↓
//SignupOtpService.issueOtp()
//    ├─ Check if enabled
//    ├─ Check rate limiting
//    ├─ Generate OTP
//    ├─ Store OTP with TTL
//    │
//    └─ Check MAIL_PROVIDER
//        ├─ "resend" → ResendOtpEmailService.sendSignupOtpEmail()
//        │              ├─ Check API key configured
//        │              ├─ Create Resend client
//        │              ├─ Build email
//        │              └─ Call Resend API
//        │
//        └─ else → OtpEmailService.sendSignupOtpEmail();
//                   ├─ Check SMTP configured
//                   ├─ Create MIME message
//                   ├─ Set content
//                   └─ Send via JavaMailSender
//    
//    ↓
//Returns MailDeliveryResult
//    ├─ sent: true/false
//    └─ message: success/error description
//    
//    ↓
//AuthController returns HTTP response
//    ├─ 200 OK: Email sent
//    └─ 4xx/5xx: Error with message`
```

---

## Environment Variables Flow

```
System Environment Variables
    │
    ├─ MAIL_PROVIDER
    │  └─ Determines routing (resend vs smtp)
    │
    ├─ RESEND_API_KEY (if using Resend)
    │  ├─ Loaded by ResendOtpEmailService
    │  └─ Used to create Resend client
    │
    ├─ MAIL_HOST (if using SMTP)
    ├─ MAIL_USERNAME (if using SMTP)
    └─ MAIL_PASSWORD (if using SMTP)
    
    ↓
application.properties reads these
    │
    ├─ app.mail.provider
    ├─ app.mail.resend.api-key
    ├─ app.mail.resend.from-address
    ├─ app.mail.otp.enabled
    └─ ... (other OTP settings)
    
    ↓
Spring @Value annotations inject them
    │
    ├─ SignupOtpService.mailProvider
    ├─ ResendOtpEmailService.resendApiKey
    └─ OtpEmailService.smtpHost
    
    ↓
Services use configuration at runtime
```

---

**End of Architecture Diagrams**

For implementation details, see the source code.
For setup instructions, see CHECKLIST_RESEND_SETUP.md
