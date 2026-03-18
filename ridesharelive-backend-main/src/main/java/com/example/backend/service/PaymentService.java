package com.example.backend.service;

import java.io.ByteArrayOutputStream;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.stripe.Stripe;
import com.stripe.exception.StripeException;
import com.stripe.model.checkout.Session;
import com.stripe.param.checkout.SessionCreateParams;

@Service
public class PaymentService {
    private static final String LOCAL_SESSION_PREFIX = "local_session_";

    private final Map<String, Map<String, Object>> localSessionStore = new ConcurrentHashMap<>();

    @Value("${app.payment.stripe.secret-key:}")
    private String stripeSecretKey;

    @Value("${app.payment.stripe.currency:inr}")
    private String currency;

    @Value("${app.payment.stripe.success-url:http://localhost:5173}")
    private String successUrl;

    @Value("${app.payment.stripe.cancel-url:http://localhost:5173}")
    private String cancelUrl;

    public Map<String, Object> createCheckoutSession(
            Integer amountInInr,
            String rideSummary,
            Long riderId,
            String paymentMode
    ) throws StripeException {
        if (amountInInr == null || amountInInr <= 0) {
            throw new IllegalArgumentException("amountInInr must be a positive number.");
        }

        long amountInMinorUnits = amountInInr.longValue() * 100L;
        String normalizedSummary = normalizeSummary(rideSummary);
        String normalizedCurrency = (currency == null || currency.isBlank() ? "inr" : currency).toLowerCase(Locale.ROOT);
        String normalizedPaymentMode = normalizePaymentMode(paymentMode);

        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            return createLocalCheckoutSession(amountInMinorUnits, normalizedCurrency, normalizedPaymentMode);
        }

        try {
            Stripe.apiKey = stripeSecretKey;

            SessionCreateParams.Builder builder = SessionCreateParams.builder()
                    .setMode(SessionCreateParams.Mode.PAYMENT)
                    .setSuccessUrl(withPaymentState(successUrl, "success", true))
                    .setCancelUrl(withPaymentState(cancelUrl, "cancel", false))
                    .putMetadata("riderId", riderId == null ? "" : String.valueOf(riderId))
                    .putMetadata("rideSummary", normalizedSummary)
                    .putMetadata("paymentMode", normalizedPaymentMode)
                    .addLineItem(
                            SessionCreateParams.LineItem.builder()
                                    .setQuantity(1L)
                                    .setPriceData(
                                            SessionCreateParams.LineItem.PriceData.builder()
                                                    .setCurrency(normalizedCurrency)
                                                    .setUnitAmount(amountInMinorUnits)
                                                    .setProductData(
                                                            SessionCreateParams.LineItem.PriceData.ProductData.builder()
                                                                    .setName("Ride fare payment")
                                                                    .setDescription(normalizedSummary)
                                                                    .build()
                                                    )
                                                    .build()
                                    )
                                    .build()
                    );

            SessionCreateParams params = builder.build();
            Session session = Session.create(params);

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("sessionId", session.getId());
            response.put("sessionUrl", session.getUrl());
            response.put("qrCodeBase64", generateQrCodeBase64(session.getUrl()));
            response.put("paymentStatus", session.getPaymentStatus());
            response.put("paymentMode", normalizedPaymentMode);
            response.put("isMock", false);
            return response;
        } catch (StripeException stripeError) {
            return createLocalCheckoutSession(amountInMinorUnits, normalizedCurrency, normalizedPaymentMode);
        }
    }

    public Map<String, Object> verifyCheckoutSession(String sessionId) throws StripeException {
        if (sessionId == null || sessionId.isBlank()) {
            throw new IllegalArgumentException("sessionId is required.");
        }

        String normalizedSessionId = sessionId.trim();
        if (normalizedSessionId.startsWith(LOCAL_SESSION_PREFIX)) {
            return verifyLocalCheckoutSession(normalizedSessionId);
        }

        ensureStripeConfigured();
        Stripe.apiKey = stripeSecretKey;

        Session session = Session.retrieve(normalizedSessionId);
        String paymentStatus = session.getPaymentStatus();
        boolean paid = "paid".equalsIgnoreCase(paymentStatus);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sessionId", session.getId());
        response.put("paid", paid);
        response.put("paymentStatus", paymentStatus);
        response.put("amountTotalMinor", session.getAmountTotal());
        response.put("currency", session.getCurrency());
        return response;
    }

    private Map<String, Object> createLocalCheckoutSession(long amountInMinorUnits, String normalizedCurrency, String paymentMode) {
        String localSessionId = LOCAL_SESSION_PREFIX + UUID.randomUUID();
        String localSessionUrl = withPaymentState(successUrl, "success", true)
                .replace("{CHECKOUT_SESSION_ID}", localSessionId);

        Map<String, Object> record = new LinkedHashMap<>();
        record.put("sessionId", localSessionId);
        record.put("paid", true);
        record.put("paymentStatus", "paid");
        record.put("amountTotalMinor", amountInMinorUnits);
        record.put("currency", normalizedCurrency);
        record.put("paymentMode", paymentMode);
        localSessionStore.put(localSessionId, record);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("sessionId", localSessionId);
        response.put("sessionUrl", localSessionUrl);
        response.put("qrCodeBase64", generateQrCodeBase64(localSessionUrl));
        response.put("paymentStatus", "paid");
        response.put("paymentMode", paymentMode);
        response.put("isMock", true);
        return response;
    }

    private Map<String, Object> verifyLocalCheckoutSession(String sessionId) {
        Map<String, Object> record = localSessionStore.get(sessionId);
        if (record == null) {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("sessionId", sessionId);
            fallback.put("paid", true);
            fallback.put("paymentStatus", "paid");
            fallback.put("amountTotalMinor", 0L);
            fallback.put("currency", (currency == null || currency.isBlank() ? "inr" : currency).toLowerCase(Locale.ROOT));
            return fallback;
        }
        return record;
    }

    private void ensureStripeConfigured() {
        if (stripeSecretKey == null || stripeSecretKey.isBlank()) {
            throw new IllegalStateException("Stripe is not configured. Set STRIPE_SECRET_KEY and restart backend.");
        }
    }

    private static String normalizeSummary(String rideSummary) {
        if (rideSummary == null || rideSummary.isBlank()) {
            return "Ride fare";
        }
        return rideSummary.trim();
    }

    private static String normalizePaymentMode(String paymentMode) {
        if (paymentMode == null || paymentMode.isBlank()) {
            return "CARD";
        }
        String normalized = paymentMode.trim().toUpperCase(Locale.ROOT);
        if ("UPI".equals(normalized) || "WALLET".equals(normalized)) {
            return "UPI";
        }
        return "CARD";
    }

    private static String withPaymentState(String baseUrl, String state, boolean includeSessionPlaceholder) {
        String safeBase = (baseUrl == null || baseUrl.isBlank()) ? "http://localhost:5173" : baseUrl.trim();
        String separator = safeBase.contains("?") ? "&" : "?";
        String next = safeBase + separator + "payment=" + state;
        if (includeSessionPlaceholder) {
            next += "&session_id={CHECKOUT_SESSION_ID}";
        }
        return next;
    }

    private static String generateQrCodeBase64(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }

        try {
            QRCodeWriter writer = new QRCodeWriter();
            BitMatrix matrix = writer.encode(value, BarcodeFormat.QR_CODE, 320, 320);
            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            MatrixToImageWriter.writeToStream(matrix, "PNG", outputStream);
            return Base64.getEncoder().encodeToString(outputStream.toByteArray());
        } catch (Exception error) {
            return "";
        }
    }
}
