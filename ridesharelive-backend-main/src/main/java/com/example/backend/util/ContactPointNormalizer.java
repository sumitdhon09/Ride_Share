package com.example.backend.util;

import java.util.Locale;

public final class ContactPointNormalizer {

    private ContactPointNormalizer() {
    }

    public static String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
    }

    public static String normalizePhoneNumber(String phoneNumber, String defaultCountryCode) {
        if (phoneNumber == null) {
            return "";
        }

        String trimmed = phoneNumber.trim();
        if (trimmed.isBlank()) {
            return "";
        }

        String compact = trimmed.replaceAll("[\\s()\\-]", "");
        if (compact.startsWith("00")) {
            compact = "+" + compact.substring(2);
        }

        if (compact.startsWith("+")) {
            String digits = compact.substring(1).replaceAll("\\D", "");
            return isValidInternationalDigits(digits) ? "+" + digits : "";
        }

        String digits = compact.replaceAll("\\D", "");
        if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (digits.length() == 10) {
            return normalizeCountryCode(defaultCountryCode) + digits;
        }
        if (isValidInternationalDigits(digits)) {
            return "+" + digits;
        }
        return "";
    }

    private static String normalizeCountryCode(String defaultCountryCode) {
        String normalized = defaultCountryCode == null ? "" : defaultCountryCode.trim();
        if (normalized.isBlank()) {
            normalized = "+91";
        }
        if (normalized.startsWith("00")) {
            normalized = "+" + normalized.substring(2);
        }
        if (!normalized.startsWith("+")) {
            normalized = "+" + normalized;
        }
        String digits = normalized.substring(1).replaceAll("\\D", "");
        return digits.isBlank() ? "+91" : "+" + digits;
    }

    private static boolean isValidInternationalDigits(String digits) {
        return digits.length() >= 10 && digits.length() <= 15;
    }
}
