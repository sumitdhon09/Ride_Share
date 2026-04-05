package com.example.backend.service;

import java.util.Locale;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.example.backend.entity.User;
import com.resend.Resend;
import com.resend.core.exception.ResendException;
import com.resend.services.emails.model.CreateEmailOptions;

@Service
public class ResendOtpEmailService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ResendOtpEmailService.class);

    @Value("${app.mail.resend.api-key:}")
    private String resendApiKey;

    @Value("${app.mail.resend.from-address:onboarding@resend.dev}")
    private String fromAddress;

    @Value("${app.mail.otp.from-name:RideShare Live}")
    private String fromName;

    @Value("${app.mail.otp.enabled:false}")
    private boolean otpEmailEnabled;

    public boolean sendOtpEmail(User user, Long rideId, String otpPurpose, String otp) {
        if (!otpEmailEnabled) {
            LOGGER.debug("OTP email disabled; skipping send for rideId={}", rideId);
            return false;
        }

        if (!isResendConfigured()) {
            LOGGER.warn("Resend API key not configured; skipping OTP email");
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

        String normalizedPurpose = otpPurpose == null ? "verification" : otpPurpose.trim();
        String subject = String.format(
                "RideShare OTP for Ride #%d (%s)",
                rideId == null ? 0L : rideId,
                normalizedPurpose
        );

        String name = user.getName() == null || user.getName().isBlank() ? "Rider" : user.getName().trim();
        String body = buildOtpBody(name, rideId, normalizedPurpose, otp == null ? "" : otp.trim());

        return sendEmailViaResend(toAddress, subject, body);
    }

    public MailDeliveryResult sendSignupOtpEmail(String recipientName, String recipientEmail, String otp) {
        if (!otpEmailEnabled) {
            LOGGER.debug("Signup OTP email disabled; skipping send for email={}", recipientEmail);
            return MailDeliveryResult.failure("Email OTP is disabled on backend.");
        }

        if (!isResendConfigured()) {
            LOGGER.warn("Resend API key not configured; cannot send signup OTP");
            return MailDeliveryResult.failure("Email service is not configured properly. Please contact support.");
        }

        String toAddress = normalizeEmail(recipientEmail);
        if (toAddress.isBlank()) {
            LOGGER.warn("Skipping signup OTP email; email address is missing.");
            return MailDeliveryResult.failure("Recipient email address is missing.");
        }

        String name = recipientName == null || recipientName.isBlank() ? "User" : recipientName.trim();
        
        String htmlBody = buildSignupOtpHtmlBody(name, otp);
        String textBody = buildSignupOtpTextBody(name, otp);

        return sendHtmlEmailViaResend(toAddress, "RideShare Live Signup OTP", textBody, htmlBody);
    }

    public MailDeliveryResult sendForgotPasswordOtpEmail(String recipientEmail, String otp) {
        if (!otpEmailEnabled) {
            LOGGER.debug("Forgot password OTP email disabled; skipping send for email={}", recipientEmail);
            return MailDeliveryResult.failure("Email OTP is disabled on backend.");
        }

        if (!isResendConfigured()) {
            LOGGER.warn("Resend API key not configured; cannot send forgot password OTP");
            return MailDeliveryResult.failure("Email service is not configured properly. Please contact support.");
        }

        String toAddress = normalizeEmail(recipientEmail);
        if (toAddress.isBlank()) {
            LOGGER.warn("Skipping forgot password OTP email; email address is missing.");
            return MailDeliveryResult.failure("Recipient email address is missing.");
        }

        String htmlBody = buildForgotPasswordOtpHtmlBody(otp);
        String textBody = buildForgotPasswordOtpTextBody(otp);

        return sendHtmlEmailViaResend(toAddress, "RideShare Live Password Reset OTP", textBody, htmlBody);
    }

    private boolean sendEmailViaResend(String toAddress, String subject, String body) {
        try {
            Resend resend = new Resend(resendApiKey);
            var response = resend.emails().send(
                    CreateEmailOptions.builder()
                            .from(formatFromAddress())
                            .to(toAddress)
                            .subject(subject)
                            .html(wrapInHtml(body))
                            .build()
            );

            if (response.getId() != null) {
                LOGGER.info("OTP email sent successfully via Resend to {}. Message ID: {}", toAddress, response.getId());
                return true;
            } else {
                LOGGER.error("Failed to send OTP email via Resend to {}: No message ID returned", toAddress);
                return false;
            }
        } catch (ResendException e) {
            LOGGER.error("Failed to send OTP email via Resend to {}: {}", toAddress, e.getMessage(), e);
            return false;
        } catch (Exception e) {
            LOGGER.error("Unexpected error sending OTP email via Resend to {}: {}", toAddress, e.getMessage(), e);
            return false;
        }
    }

    private MailDeliveryResult sendHtmlEmailViaResend(String toAddress, String subject, String textBody, String htmlBody) {
        try {
            Resend resend = new Resend(resendApiKey);
            var response = resend.emails().send(
                    CreateEmailOptions.builder()
                            .from(formatFromAddress())
                            .to(toAddress)
                            .subject(subject)
                            .html(htmlBody)
                            .text(textBody)
                            .build()
            );

            if (response.getId() != null) {
                LOGGER.info("Signup OTP email sent successfully via Resend to {}. Message ID: {}", toAddress, response.getId());
                return MailDeliveryResult.success("OTP sent to your email address.");
            } else {
                LOGGER.error("Failed to send signup OTP email via Resend to {}: No message ID returned", toAddress);
                return MailDeliveryResult.failure("Failed to send OTP email. Please try again.");
            }
        } catch (ResendException e) {
            LOGGER.error("Failed to send signup OTP email via Resend to {}: {}", toAddress, e.getMessage(), e);
            return MailDeliveryResult.failure("Email service error. Please try again later.");
        } catch (Exception e) {
            LOGGER.error("Unexpected error sending signup OTP email via Resend to {}: {}", toAddress, e.getMessage(), e);
            return MailDeliveryResult.failure("Unexpected error. Please try again later.");
        }
    }

    private String buildSignupOtpHtmlBody(String name, String otp) {
        return String.format(
                "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "  <style>\n" +
                "    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }\n" +
                "    .container { max-width: 600px; margin: 20px auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n" +
                "    .header { color: #333; margin-bottom: 20px; }\n" +
                "    .otp-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }\n" +
                "    .otp-code { font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; }\n" +
                "    .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"container\">\n" +
                "    <div class=\"header\">\n" +
                "      <h2>Welcome to RideShare Live, %s!</h2>\n" +
                "    </div>\n" +
                "    <p>Your signup OTP is:</p>\n" +
                "    <div class=\"otp-box\">\n" +
                "      <div class=\"otp-code\">%s</div>\n" +
                "    </div>\n" +
                "    <p>This code expires in 5 minutes. Please do not share it with anyone.</p>\n" +
                "    <div class=\"footer\">\n" +
                "      <p>RideShare Live Team<br>Need help? Contact support@ridesharelive.com</p>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "</body>\n" +
                "</html>",
                name, otp
        );
    }

    private String buildSignupOtpTextBody(String name, String otp) {
        return String.format(
                "Hi %s,\n\n" +
                "Your RideShare Live signup OTP is: %s\n\n" +
                "This code expires in 5 minutes. Please do not share it with anyone.\n\n" +
                "RideShare Live Team",
                name, otp
        );
    }

    private String buildForgotPasswordOtpHtmlBody(String otp) {
        return String.format(
                "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<head>\n" +
                "  <style>\n" +
                "    body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }\n" +
                "    .container { max-width: 600px; margin: 20px auto; background-color: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }\n" +
                "    .header { color: #333; margin-bottom: 20px; }\n" +
                "    .otp-box { background-color: #f0f0f0; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0; }\n" +
                "    .otp-code { font-size: 32px; font-weight: bold; color: #ff6b6b; letter-spacing: 5px; }\n" +
                "    .footer { color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px; }\n" +
                "  </style>\n" +
                "</head>\n" +
                "<body>\n" +
                "  <div class=\"container\">\n" +
                "    <div class=\"header\">\n" +
                "      <h2>Password Reset Request</h2>\n" +
                "    </div>\n" +
                "    <p>You requested to reset your RideShare Live password. Use the code below:</p>\n" +
                "    <div class=\"otp-box\">\n" +
                "      <div class=\"otp-code\">%s</div>\n" +
                "    </div>\n" +
                "    <p>This code expires in 10 minutes. If you did not request this, please ignore this email.</p>\n" +
                "    <div class=\"footer\">\n" +
                "      <p>RideShare Live Team<br>Need help? Contact support@ridesharelive.com</p>\n" +
                "    </div>\n" +
                "  </div>\n" +
                "</body>\n" +
                "</html>",
                otp
        );
    }

    private String buildForgotPasswordOtpTextBody(String otp) {
        return String.format(
                "Hi,\n\n" +
                "Your RideShare Live password reset OTP is: %s\n\n" +
                "This code expires in 10 minutes. If you did not request this, please ignore this email.\n\n" +
                "RideShare Live Team",
                otp
        );
    }

    private String buildOtpBody(String name, Long rideId, String otpPurpose, String otp) {
        return String.format(
                "Hi %s,\n\n" +
                "Your %s OTP for ride #%s is: %s\n\n" +
                "Please do not share this OTP with anyone.\n\n" +
                "RideShare Live Team",
                name,
                otpPurpose.toLowerCase(Locale.ROOT),
                rideId == null ? "-" : String.valueOf(rideId),
                otp
        );
    }

    private String wrapInHtml(String text) {
        return String.format(
                "<!DOCTYPE html>\n" +
                "<html>\n" +
                "<body style=\"font-family: Arial, sans-serif; line-height: 1.6; color: #333;\">\n" +
                "  <pre style=\"white-space: pre-wrap; word-wrap: break-word;\">%s</pre>\n" +
                "</body>\n" +
                "</html>",
                text
        );
    }

    private String formatFromAddress() {
        return String.format("%s <%s>", fromName, fromAddress);
    }

    private boolean isResendConfigured() {
        return resendApiKey != null && !resendApiKey.isBlank();
    }

    private static String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
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
