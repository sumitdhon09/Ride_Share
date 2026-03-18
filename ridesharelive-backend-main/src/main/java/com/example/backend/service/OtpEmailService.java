package com.example.backend.service;

import jakarta.mail.internet.MimeMessage;
import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import com.example.backend.entity.User;

@Service
public class OtpEmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(OtpEmailService.class);

    @Autowired
    private JavaMailSender javaMailSender;

    @Value("${spring.mail.host:}")
    private String smtpHost;

    @Value("${spring.mail.username:}")
    private String fromFallbackAddress;

    @Value("${spring.mail.password:}")
    private String smtpPassword;

    @Value("${spring.mail.properties.mail.smtp.auth:true}")
    private boolean smtpAuthEnabled;

    @Value("${app.mail.otp.from-address:noreply@ridesharelive.local}")
    private String fromAddress;

    @Value("${app.mail.otp.from-name:RideShare Live}")
    private String fromName;

    @Value("${app.mail.otp.enabled:false}")
    private boolean otpEmailEnabled;

    @Value("${app.mail.otp.skip-if-no-smtp-host:false}")
    private boolean skipWhenNoSmtpHost;

    public boolean sendOtpEmail(User user, Long rideId, String otpPurpose, String otp) {
        if (!otpEmailEnabled) {
            LOGGER.debug("OTP email disabled; skipping send for rideId={}", rideId);
            return false;
        }

        if (user == null || user.getId() == null) {
            LOGGER.debug("Skipping OTP email; user is missing.");
            return false;
        }

        String toAddress = normalizeEmail(user.getEmail());
        if (toAddress.isBlank()) {
            LOGGER.warn("Skipping OTP email for userId={}; no email address available.", user.getId());
            return false;
        }

        if (skipWhenNoSmtpHost && smtpHost.isBlank()) {
            LOGGER.warn(
                    "Skipping OTP email for userId={} and rideId={}; MAIL host is not configured.",
                    user.getId(),
                    rideId
            );
            return false;
        }

        String normalizedPurpose = otpPurpose == null ? "verification" : otpPurpose.trim();
        String subject = String.format(
                "RideShare OTP for Ride #%d (%s)",
                rideId == null ? 0L : rideId,
                normalizedPurpose
        );

        String name = user.getName() == null || user.getName().isBlank() ? "Rider" : user.getName().trim();
        String body = buildOtpBody(name, rideId, normalizedPurpose, otp == null ? "" : otp.trim());

        return sendPlainTextEmail(toAddress, subject, body).sent();
    }

    public MailDeliveryResult sendSignupOtpEmail(String recipientName, String recipientEmail, String otp) {
        if (!otpEmailEnabled) {
            LOGGER.debug("Signup OTP email disabled; skipping send for email={}", recipientEmail);
            return MailDeliveryResult.failure("Email OTP is disabled on backend.");
        }

        String toAddress = normalizeEmail(recipientEmail);
        if (toAddress.isBlank()) {
            LOGGER.warn("Skipping signup OTP email; email address is missing.");
            return MailDeliveryResult.failure("Recipient email address is missing.");
        }

        if (skipWhenNoSmtpHost && smtpHost.isBlank()) {
            LOGGER.warn("Skipping signup OTP email for {}; MAIL host is not configured.", toAddress);
            return MailDeliveryResult.failure("Mail server is not configured. Set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM_ADDRESS.");
        }

        if (smtpAuthEnabled && fromFallbackAddress.isBlank()) {
            LOGGER.warn("Skipping signup OTP email for {}; MAIL username is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_USERNAME is missing. For Gmail, use your Gmail address.");
        }

        if (smtpAuthEnabled && smtpPassword.isBlank()) {
            LOGGER.warn("Skipping signup OTP email for {}; MAIL password is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_PASSWORD is missing. For Gmail, use a Google App Password.");
        }

        if (resolveFromAddress().isBlank()) {
            LOGGER.warn("Skipping signup OTP email for {}; from-address is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_FROM_ADDRESS is missing.");
        }

        String name = recipientName == null || recipientName.isBlank() ? "Rider" : recipientName.trim();
        String body = String.format(
                "Hi %s,\n\n"
                        + "Your RideShare Live signup OTP is: %s\n\n"
                        + "This code expires soon. Please do not share it with anyone.\n\n"
                        + "RideShare Live Team",
                name,
                otp == null ? "" : otp.trim()
        );

        return sendPlainTextEmail(toAddress, "RideShare Live signup OTP", body);
    }

    private MailDeliveryResult sendPlainTextEmail(String toAddress, String subject, String body) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false);
            helper.setTo(toAddress);
            helper.setSubject(subject);
            helper.setText(body, false);
            helper.setFrom(resolveFromAddress(), fromName);
            javaMailSender.send(message);
            LOGGER.info("OTP email sent successfully to {}", toAddress);
            return MailDeliveryResult.success("OTP sent to your email address.");
        } catch (Exception mailError) {
            LOGGER.error("Failed to send OTP email to {}: {}", toAddress, mailError.getMessage());
            return MailDeliveryResult.failure(resolveDeliveryFailureMessage(mailError));
        }
    }

    private String resolveFromAddress() {
        if (!fromAddress.isBlank()) {
            return fromAddress;
        }
        if (!fromFallbackAddress.isBlank()) {
            return fromFallbackAddress;
        }
        if (smtpHost.isBlank()) {
            return "noreply@localhost";
        }
        return "noreply@" + smtpHost;
    }

    private String buildOtpBody(String name, Long rideId, String otpPurpose, String otp) {
        return String.format(
                "Hi %s,\n\n"
                        + "Your %s OTP for ride #%s is: %s\n\n"
                        + "Please do not share this OTP with anyone.\n\n"
                        + "RideShare Live Team",
                name,
                otpPurpose.toLowerCase(Locale.ROOT),
                rideId == null ? "-" : String.valueOf(rideId),
                otp
        );
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String resolveDeliveryFailureMessage(Exception mailError) {
        String rawMessage = mailError == null || mailError.getMessage() == null ? "" : mailError.getMessage().toLowerCase(Locale.ROOT);
        if (smtpHost.toLowerCase(Locale.ROOT).contains("gmail")) {
            if (rawMessage.contains("authentication") || rawMessage.contains("username and password not accepted")) {
                return "Gmail rejected login. Use a Google App Password in MAIL_PASSWORD.";
            }
        }
        return "Failed to send OTP email. Check your mail server settings and credentials.";
    }

    public record MailDeliveryResult(boolean sent, String message) {

        static MailDeliveryResult success(String message) {
            return new MailDeliveryResult(true, message);
        }

        static MailDeliveryResult failure(String message) {
            return new MailDeliveryResult(false, message);
        }
    }
}
