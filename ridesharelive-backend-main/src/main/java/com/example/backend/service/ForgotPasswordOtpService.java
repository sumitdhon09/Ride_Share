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
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.backend.entity.User;

@Service
public class ForgotPasswordOtpService {

    private static final int OTP_LENGTH = 6;

    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<String, PendingOtp> pendingOtps = new ConcurrentHashMap<>();
    private final Clock clock = Clock.systemUTC();

    @Autowired
    private OtpEmailService otpEmailService;

    @Autowired
    private ResendOtpEmailService resendOtpEmailService;

    @Autowired
    private UserService userService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.mail.provider:smtp}")
    private String mailProvider;

    @Value("${app.auth.forgot-password-otp.enabled:true}")
    private boolean forgotPasswordOtpEnabled;

    @Value("${app.auth.forgot-password-otp.ttl-seconds:600}")
    private long otpTtlSeconds;

    @Value("${app.auth.forgot-password-otp.resend-delay-seconds:30}")
    private long resendDelaySeconds;

    @Value("${app.auth.forgot-password-otp.expose-dev-otp:false}")
    private boolean exposeDevOtp;

    public IssueResult issueOtp(String email) {
        if (!forgotPasswordOtpEnabled) {
            return IssueResult.disabled();
        }

        String normalizedEmail = normalizeEmail(email);
        
        // Check if user exists
        if (userService.findByEmail(normalizedEmail).isEmpty()) {
            return IssueResult.issued(false, null, null, "If an account exists with this email, a password reset link will be sent.");
        }

        Instant now = Instant.now(clock);
        PendingOtp existing = pendingOtps.get(normalizedEmail);
        if (existing != null && existing.expiresAt().isAfter(now) && existing.canResendAt().isAfter(now)) {
            return IssueResult.rateLimited(Duration.between(now, existing.canResendAt()).getSeconds());
        }

        String otp = generateOtp();
        PendingOtp nextOtp = new PendingOtp(
                otp,
                now.plusSeconds(Math.max(60L, otpTtlSeconds)),
                now.plusSeconds(Math.max(0L, resendDelaySeconds))
        );
        pendingOtps.put(normalizedEmail, nextOtp);

        OtpEmailService.MailDeliveryResult mailDeliveryResult;
        if ("resend".equalsIgnoreCase(mailProvider)) {
            ResendOtpEmailService.MailDeliveryResult resendResult = resendOtpEmailService.sendForgotPasswordOtpEmail(normalizedEmail, otp);
            mailDeliveryResult = new OtpEmailService.MailDeliveryResult(resendResult.sent(), resendResult.message());
        } else {
            mailDeliveryResult = otpEmailService.sendForgotPasswordOtpEmail(normalizedEmail, otp);
        }
        boolean emailSent = mailDeliveryResult.sent();
        String devOtp = exposeDevOtp ? otp : null;
        IssueResult result = IssueResult.issued(emailSent, devOtp, nextOtp.expiresAt(), mailDeliveryResult.message());
        if (!result.accepted()) {
            pendingOtps.remove(normalizedEmail, nextOtp);
        }
        return result;
    }

    public VerificationResult verifyOtpAndResetPassword(String email, String otp, String newPassword) {
        if (!forgotPasswordOtpEnabled) {
            return VerificationResult.success();
        }

        String normalizedEmail = normalizeEmail(email);
        String normalizedOtp = otp == null ? "" : otp.trim();
        if (normalizedOtp.isBlank()) {
            return VerificationResult.invalid("OTP is required.");
        }

        if (newPassword == null || newPassword.isBlank()) {
            return VerificationResult.invalid("New password is required.");
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

        // OTP is valid, now reset the password
        try {
            var user = userService.findByEmail(normalizedEmail);
            if (user.isEmpty()) {
                return VerificationResult.invalid("User not found.");
            }

            User userToUpdate = user.get();
            userToUpdate.setPassword(passwordEncoder.encode(newPassword));
            userService.updateUser(userToUpdate);
            
            pendingOtps.remove(normalizedEmail, pendingOtp);
            return VerificationResult.success();
        } catch (Exception e) {
            return VerificationResult.invalid("Failed to reset password: " + e.getMessage());
        }
    }

    private String generateOtp() {
        int bound = (int) Math.pow(10, OTP_LENGTH);
        int value = secureRandom.nextInt(bound);
        return String.format(Locale.ROOT, "%0" + OTP_LENGTH + "d", value);
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private record PendingOtp(String otp, Instant expiresAt, Instant canResendAt) {
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
            return new IssueResult(false, false, false, null, null, 0L, "Password reset is currently disabled.");
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
            return new VerificationResult(true, "Password reset successfully.");
        }

        static VerificationResult invalid(String message) {
            return new VerificationResult(false, message);
        }
    }
}
