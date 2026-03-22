package com.example.backend.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.ConcurrentHashMap;

import com.example.backend.util.ContactPointNormalizer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SignupOtpService {

    private static final int OTP_LENGTH = 6;
    private static final long CLEANUP_INTERVAL_SECONDS = 60;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, PendingOtp> pendingOtps = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();
    private final AtomicLong lastCleanupEpochSecond = new AtomicLong(0);

    @Autowired
    private OtpEmailService otpEmailService;

    @Value("${app.auth.signup-otp.enabled:true}")
    private boolean signupOtpEnabled;

    @Value("${app.auth.signup-otp.ttl-seconds:300}")
    private long otpTtlSeconds;

    @Value("${app.auth.signup-otp.resend-delay-seconds:30}")
    private long resendDelaySeconds;

    @Value("${app.auth.signup-otp.expose-dev-otp:false}")
    private boolean exposeDevOtp;

    public IssueResult issueOtp(String name, String email) {
        if (!signupOtpEnabled) {
            return IssueResult.disabled();
        }

        String otpTarget = resolveOtpTarget(email);
        Instant now = Instant.now(clock);
        cleanupExpiredOtpsIfDue(now);
        PendingOtp existing = pendingOtps.get(otpTarget);
        if (existing != null && existing.expiresAt().isAfter(now) && existing.canResendAt().isAfter(now)) {
            return IssueResult.rateLimited(Duration.between(now, existing.canResendAt()).getSeconds());
        }

        String otp = generateOtp();
        PendingOtp nextOtp = new PendingOtp(
                otp,
                defaultName(name),
                now.plusSeconds(Math.max(60L, otpTtlSeconds)),
                now.plusSeconds(Math.max(0L, resendDelaySeconds))
        );
        pendingOtps.put(otpTarget, nextOtp);

        DeliveryAttempt deliveryAttempt = sendOtp(nextOtp.name(), otpTarget, otp);
        String devOtp = exposeDevOtp && !deliveryAttempt.deliverySent() ? otp : null;
        long retryAfterSeconds = Math.max(1L, Duration.between(now, nextOtp.canResendAt()).getSeconds());
        IssueResult result = IssueResult.issued(
                deliveryAttempt.deliverySent(),
                devOtp,
                nextOtp.expiresAt(),
                retryAfterSeconds,
                deliveryAttempt.message()
        );
        if (!result.accepted()) {
            pendingOtps.remove(otpTarget, nextOtp);
        }
        return result;
    }

    public VerificationResult verifyOtp(String email, String otp) {
        if (!signupOtpEnabled) {
            return VerificationResult.success();
        }

        String normalizedOtp = otp == null ? "" : otp.trim();
        if (normalizedOtp.isBlank()) {
            return VerificationResult.invalid("OTP is required.");
        }

        final String otpTarget;
        try {
            otpTarget = resolveOtpTarget(email);
        } catch (IllegalArgumentException validationError) {
            return VerificationResult.invalid(validationError.getMessage());
        }

        Instant now = Instant.now(clock);
        cleanupExpiredOtpsIfDue(now);
        PendingOtp pendingOtp = pendingOtps.get(otpTarget);
        if (pendingOtp == null) {
            return VerificationResult.invalid("Request an OTP first.");
        }

        if (pendingOtp.expiresAt().isBefore(now)) {
            pendingOtps.remove(otpTarget, pendingOtp);
            return VerificationResult.invalid("OTP expired. Request a new code.");
        }

        if (!Objects.equals(pendingOtp.otp(), normalizedOtp)) {
            return VerificationResult.invalid("Invalid OTP.");
        }

        pendingOtps.remove(otpTarget, pendingOtp);
        return VerificationResult.success();
    }

    private String generateOtp() {
        int bound = (int) Math.pow(10, OTP_LENGTH);
        int value = secureRandom.nextInt(bound);
        return String.format(java.util.Locale.ROOT, "%0" + OTP_LENGTH + "d", value);
    }

    private static String defaultName(String name) {
        if (name == null || name.isBlank()) {
            return "Rider";
        }
        return name.trim();
    }

    private String resolveOtpTarget(String email) {
        String normalizedEmail = ContactPointNormalizer.normalizeEmail(email);
        if (normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("email is required.");
        }
        return normalizedEmail;
    }

    private DeliveryAttempt sendOtp(String name, String otpTarget, String otp) {
        OtpEmailService.MailDeliveryResult mailDeliveryResult =
                otpEmailService.sendSignupOtpEmail(name, otpTarget, otp);
        return new DeliveryAttempt(mailDeliveryResult.sent(), mailDeliveryResult.message());
    }

    private void cleanupExpiredOtpsIfDue(Instant now) {
        long nowEpochSecond = now.getEpochSecond();
        long lastCleanup = lastCleanupEpochSecond.get();
        if (nowEpochSecond - lastCleanup < CLEANUP_INTERVAL_SECONDS) {
            return;
        }
        if (!lastCleanupEpochSecond.compareAndSet(lastCleanup, nowEpochSecond)) {
            return;
        }
        pendingOtps.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
    }

    private record PendingOtp(String otp, String name, Instant expiresAt, Instant canResendAt) {
    }

    private record DeliveryAttempt(boolean deliverySent, String message) {
    }

    public record IssueResult(
            boolean accepted,
            boolean rateLimited,
            boolean emailSent,
            String devOtp,
            Instant expiresAt,
            long retryAfterSeconds,
            String message
    ) {

        static IssueResult disabled() {
            return new IssueResult(false, false, false, null, null, 0L, "Signup OTP is currently disabled.");
        }

        static IssueResult rateLimited(long retryAfterSeconds) {
            return new IssueResult(false, true, false, null, null, Math.max(1L, retryAfterSeconds), "Please wait before requesting another OTP.");
        }

        static IssueResult issued(boolean deliverySent, String devOtp, Instant expiresAt, long retryAfterSeconds, String failureMessage) {
            boolean accepted = deliverySent || devOtp != null;
            String message = deliverySent
                    ? "OTP sent to your email address."
                    : (devOtp != null ? "OTP generated for local development." : failureMessage);
            return new IssueResult(
                    accepted,
                    false,
                    deliverySent,
                    devOtp,
                    expiresAt,
                    accepted ? Math.max(1L, retryAfterSeconds) : 0L,
                    message
            );
        }
    }

    public record VerificationResult(boolean valid, String message) {

        static VerificationResult success() {
            return new VerificationResult(true, "OTP verified.");
        }

        static VerificationResult invalid(String message) {
            return new VerificationResult(false, message);
        }
    }
}
