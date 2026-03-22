package com.example.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.mail.internet.MimeMessage;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final HttpClient HTTP_CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Autowired
    private JavaMailSender javaMailSender;

    @Value("${app.mail.provider:auto}")
    private String mailProvider;

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

    @Value("${app.mail.resend.api-key:}")
    private String resendApiKey;

    @Value("${app.mail.resend.base-url:https://api.resend.com}")
    private String resendApiBaseUrl;

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
        DeliveryProvider provider = resolveProvider();
        MailDeliveryResult validationResult = validateConfiguration(provider, toAddress);
        if (validationResult != null) {
            return validationResult;
        }

        if (provider == DeliveryProvider.RESEND) {
            return sendPlainTextEmailViaResend(toAddress, subject, body);
        }

        return sendPlainTextEmailViaSmtp(toAddress, subject, body);
    }

    MailDeliveryResult sendPlainTextEmailViaResend(String toAddress, String subject, String body) {
        try {
            HttpRequest request = buildResendRequest(toAddress, subject, body);
            HttpResponse<String> response =
                    HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                LOGGER.info("OTP email sent successfully to {} via Resend", toAddress);
                return MailDeliveryResult.success("OTP sent to your email address.");
            }

            LOGGER.error(
                    "Resend rejected OTP email to {} with status {} and body {}",
                    toAddress,
                    response.statusCode(),
                    response.body()
            );
            return MailDeliveryResult.failure(resolveResendFailureMessage(response.statusCode(), response.body()));
        } catch (Exception resendError) {
            LOGGER.error("Failed to send OTP email to {} via Resend: {}", toAddress, resendError.getMessage());
            return MailDeliveryResult.failure(resolveResendFailureMessage(resendError));
        }
    }

    HttpRequest buildResendRequest(String toAddress, String subject, String body) throws Exception {
        Map<String, Object> payload = Map.of(
                "from", formatResendFromAddress(),
                "to", List.of(toAddress),
                "subject", subject,
                "text", body
        );

        return HttpRequest.newBuilder()
                .uri(resolveResendEmailsUri())
                .timeout(Duration.ofSeconds(15))
                .header("Authorization", "Bearer " + resendApiKey.trim())
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(
                        OBJECT_MAPPER.writeValueAsString(payload),
                        StandardCharsets.UTF_8
                ))
                .build();
    }

    private MailDeliveryResult sendPlainTextEmailViaSmtp(String toAddress, String subject, String body) {
        try {
            MimeMessage message = javaMailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false);
            helper.setTo(toAddress);
            helper.setSubject(subject);
            helper.setText(body, false);
            helper.setFrom(resolveSmtpFromAddress(), fromName);
            javaMailSender.send(message);
            LOGGER.info("OTP email sent successfully to {}", toAddress);
            return MailDeliveryResult.success("OTP sent to your email address.");
        } catch (Exception mailError) {
            LOGGER.error("Failed to send OTP email to {}: {}", toAddress, mailError.getMessage());
            return MailDeliveryResult.failure(resolveDeliveryFailureMessage(mailError));
        }
    }

    private MailDeliveryResult validateConfiguration(DeliveryProvider provider, String toAddress) {
        if (provider == DeliveryProvider.RESEND) {
            if (configValue(resendApiKey).isBlank()) {
                LOGGER.warn("Skipping OTP email for {}; RESEND_API_KEY is missing.", toAddress);
                return MailDeliveryResult.failure("RESEND_API_KEY is missing.");
            }
            if (resolveExplicitFromAddress().isBlank()) {
                LOGGER.warn("Skipping OTP email for {}; MAIL_FROM_ADDRESS is not configured for Resend.", toAddress);
                return MailDeliveryResult.failure("MAIL_FROM_ADDRESS is missing. For Resend, use a verified sender.");
            }
            return null;
        }

        if (skipWhenNoSmtpHost && configValue(smtpHost).isBlank()) {
            LOGGER.warn("Skipping OTP email for {}; MAIL host is not configured.", toAddress);
            return MailDeliveryResult.failure(
                    "Mail server is not configured. Set MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD and MAIL_FROM_ADDRESS."
            );
        }
        if (smtpAuthEnabled && configValue(fromFallbackAddress).isBlank()) {
            LOGGER.warn("Skipping OTP email for {}; MAIL username is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_USERNAME is missing. For Gmail, use your Gmail address.");
        }
        if (smtpAuthEnabled && configValue(smtpPassword).isBlank()) {
            LOGGER.warn("Skipping OTP email for {}; MAIL password is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_PASSWORD is missing. For Gmail, use a Google App Password.");
        }
        if (resolveSmtpFromAddress().isBlank()) {
            LOGGER.warn("Skipping OTP email for {}; from-address is not configured.", toAddress);
            return MailDeliveryResult.failure("MAIL_FROM_ADDRESS is missing.");
        }
        return null;
    }

    private DeliveryProvider resolveProvider() {
        String configuredProvider = mailProvider == null ? "" : mailProvider.trim().toLowerCase(Locale.ROOT);
        return switch (configuredProvider) {
            case "", "auto" -> resendApiKey == null || resendApiKey.isBlank()
                    ? DeliveryProvider.SMTP
                    : DeliveryProvider.RESEND;
            case "resend" -> DeliveryProvider.RESEND;
            case "smtp" -> DeliveryProvider.SMTP;
            default -> {
                LOGGER.warn("Unknown app.mail.provider '{}'; falling back to auto detection.", mailProvider);
                yield resendApiKey == null || resendApiKey.isBlank()
                        ? DeliveryProvider.SMTP
                        : DeliveryProvider.RESEND;
            }
        };
    }

    private String resolveSmtpFromAddress() {
        if (!configValue(fromAddress).isBlank()) {
            return fromAddress;
        }
        if (!configValue(fromFallbackAddress).isBlank()) {
            return fromFallbackAddress;
        }
        if (configValue(smtpHost).isBlank()) {
            return "noreply@localhost";
        }
        return "noreply@" + smtpHost;
    }

    private String resolveExplicitFromAddress() {
        return fromAddress == null ? "" : fromAddress.trim();
    }

    private String formatResendFromAddress() {
        String explicitFromAddress = resolveExplicitFromAddress();
        String displayName = fromName == null ? "" : fromName.trim();
        if (displayName.isBlank()) {
            return explicitFromAddress;
        }
        return displayName + " <" + explicitFromAddress + ">";
    }

    private URI resolveResendEmailsUri() {
        String normalizedBaseUrl = resendApiBaseUrl == null ? "" : resendApiBaseUrl.trim();
        if (normalizedBaseUrl.isBlank()) {
            normalizedBaseUrl = "https://api.resend.com";
        }
        normalizedBaseUrl = normalizedBaseUrl.replaceAll("/+$", "");
        return URI.create(normalizedBaseUrl + "/emails");
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
        if (configValue(smtpHost).toLowerCase(Locale.ROOT).contains("gmail")) {
            if (rawMessage.contains("authentication") || rawMessage.contains("username and password not accepted")) {
                return "Gmail rejected login. Use a Google App Password in MAIL_PASSWORD.";
            }
        }
        return "Failed to send OTP email. Check your mail server settings and credentials.";
    }

    private String resolveResendFailureMessage(Exception resendError) {
        String rawMessage =
                resendError == null || resendError.getMessage() == null ? "" : resendError.getMessage().toLowerCase(Locale.ROOT);
        if (rawMessage.contains("connect") || rawMessage.contains("timeout")) {
            return "Unable to reach Resend. Check RESEND_API_BASE_URL and outbound HTTPS access.";
        }
        return "Failed to send OTP email through Resend. Check RESEND_API_KEY and sender configuration.";
    }

    private String resolveResendFailureMessage(int statusCode, String responseBody) {
        String rawBody = responseBody == null ? "" : responseBody.trim();
        if (statusCode == 401 || statusCode == 403) {
            return "Resend rejected the API key. Check RESEND_API_KEY.";
        }
        if (statusCode == 422) {
            return extractResendErrorMessage(rawBody,
                    "Resend rejected the sender or payload. Verify MAIL_FROM_ADDRESS and recipient email.");
        }
        if (statusCode >= 500) {
            return "Resend is currently unavailable. Try again in a moment.";
        }
        return extractResendErrorMessage(rawBody,
                "Failed to send OTP email through Resend. Check RESEND_API_KEY and sender configuration.");
    }

    private String extractResendErrorMessage(String responseBody, String fallbackMessage) {
        if (responseBody == null || responseBody.isBlank()) {
            return fallbackMessage;
        }
        try {
            Map<?, ?> parsed = OBJECT_MAPPER.readValue(responseBody, Map.class);
            Object message = parsed.get("message");
            if (message == null && parsed.get("error") instanceof Map<?, ?> errorObject) {
                message = errorObject.get("message");
            }
            if (message instanceof String messageText && !messageText.isBlank()) {
                return messageText;
            }
        } catch (Exception ignored) {
            // Keep the provider-specific fallback if the body is not JSON.
        }
        return fallbackMessage;
    }

    private enum DeliveryProvider {
        SMTP,
        RESEND
    }

    private String configValue(String value) {
        return value == null ? "" : value.trim();
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
