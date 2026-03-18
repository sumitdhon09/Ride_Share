package com.example.backend.service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class SignupOtpService {

    private static final int OTP_LENGTH = 6;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, PendingOtp> pendingOtps = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();

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

        String normalizedEmail = normalizeEmail(email);
        Instant now = Instant.now(clock);
        PendingOtp existing = pendingOtps.get(normalizedEmail);
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
        pendingOtps.put(normalizedEmail, nextOtp);

        OtpEmailService.MailDeliveryResult mailDeliveryResult =
                otpEmailService.sendSignupOtpEmail(nextOtp.name(), normalizedEmail, otp);
        boolean emailSent = mailDeliveryResult.sent();
        String devOtp = exposeDevOtp ? otp : null;
        IssueResult result = IssueResult.issued(emailSent, devOtp, nextOtp.expiresAt(), mailDeliveryResult.message());
        if (!result.accepted()) {
            pendingOtps.remove(normalizedEmail, nextOtp);
        }
        return result;
    }

    public VerificationResult verifyOtp(String email, String otp) {
        if (!signupOtpEnabled) {
            return VerificationResult.success();
        }

        String normalizedEmail = normalizeEmail(email);
        String normalizedOtp = otp == null ? "" : otp.trim();
        if (normalizedOtp.isBlank()) {
            return VerificationResult.invalid("OTP is required.");
        }

        PendingOtp pendingOtp = pendingOtps.get(normalizedEmail);
        if (pendingOtp == null) {
            return VerificationResult.invalid("Request an OTP first.");
        }

        Instant now = Instant.now(clock);
        if (pendingOtp.expiresAt().isBefore(now)) {
            pendingOtps.remove(normalizedEmail, pendingOtp);
            return VerificationResult.invalid("OTP expired. Request a new code.");
        }

        if (!Objects.equals(pendingOtp.otp(), normalizedOtp)) {
            return VerificationResult.invalid("Invalid OTP.");
        }

        pendingOtps.remove(normalizedEmail, pendingOtp);
        return VerificationResult.success();
    }

    private String generateOtp() {
        int bound = (int) Math.pow(10, OTP_LENGTH);
        int value = secureRandom.nextInt(bound);
        return String.format(Locale.ROOT, "%0" + OTP_LENGTH + "d", value);
    }

    private static String defaultName(String name) {
        if (name == null || name.isBlank()) {
            return "Rider";
        }
        return name.trim();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private record PendingOtp(String otp, String name, Instant expiresAt, Instant canResendAt) {
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

        static IssueResult issued(boolean emailSent, String devOtp, Instant expiresAt, String failureMessage) {
            boolean accepted = emailSent || devOtp != null;
            String message = emailSent
                    ? "OTP sent to your email address."
                    : (devOtp != null ? "OTP generated for local development." : failureMessage);
            return new IssueResult(accepted, false, emailSent, devOtp, expiresAt, 0L, message);
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
