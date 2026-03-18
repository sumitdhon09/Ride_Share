package com.example.backend.service;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.backend.dto.UserSettingsRequest;
import com.example.backend.entity.UserSettings;
import com.example.backend.repository.UserSettingsRepository;

@Service
public class UserSettingsService {

    private static final Set<String> PAYMENT_METHODS = Set.of("upi", "card", "wallet", "cash");
    private static final Set<String> MAP_STYLES = Set.of("standard", "satellite", "terrain");
    private static final Set<String> VEHICLE_TYPES = Set.of("bike", "mini", "sedan", "auto");
    private static final Set<String> AC_PREFERENCES = Set.of("any", "ac", "non-ac");

    @Autowired
    private UserSettingsRepository userSettingsRepository;

    public Map<String, Object> getSettingsPayload(Long userId) {
        UserSettings settings = getOrCreate(userId);
        return toPayload(settings);
    }

    public Map<String, Object> updateSettings(Long userId, UserSettingsRequest request) {
        UserSettings settings = getOrCreate(userId);

        if (request == null) {
            return toPayload(settings);
        }

        if (request.getTripSharingDefault() != null) {
            settings.setTripSharingDefault(request.getTripSharingDefault());
        }
        if (request.getHidePhoneNumber() != null) {
            settings.setHidePhoneNumber(request.getHidePhoneNumber());
        }
        if (request.getEmergencyContact() != null) {
            settings.setEmergencyContact(sanitizeEmergencyContact(request.getEmergencyContact()));
        }
        if (request.getDefaultPaymentMethod() != null) {
            settings.setDefaultPaymentMethod(normalizeAllowed(request.getDefaultPaymentMethod(), PAYMENT_METHODS, "upi"));
        }
        if (request.getAutoTipEnabled() != null) {
            settings.setAutoTipEnabled(request.getAutoTipEnabled());
        }
        if (request.getInvoiceEmailEnabled() != null) {
            settings.setInvoiceEmailEnabled(request.getInvoiceEmailEnabled());
        }
        if (request.getMapStyle() != null) {
            settings.setMapStyle(normalizeAllowed(request.getMapStyle(), MAP_STYLES, "standard"));
        }
        if (request.getAvoidTolls() != null) {
            settings.setAvoidTolls(request.getAvoidTolls());
        }
        if (request.getAvoidHighways() != null) {
            settings.setAvoidHighways(request.getAvoidHighways());
        }
        if (request.getNavigationVoiceLanguage() != null) {
            settings.setNavigationVoiceLanguage(normalizeLanguageCode(request.getNavigationVoiceLanguage()));
        }
        if (request.getPreferredVehicleType() != null) {
            settings.setPreferredVehicleType(normalizeAllowed(request.getPreferredVehicleType(), VEHICLE_TYPES, "mini"));
        }
        if (request.getAcPreference() != null) {
            settings.setAcPreference(normalizeAllowed(request.getAcPreference(), AC_PREFERENCES, "any"));
        }
        if (request.getQuietRide() != null) {
            settings.setQuietRide(request.getQuietRide());
        }
        if (request.getDeleteAccountRequested() != null) {
            settings.setDeleteAccountRequested(request.getDeleteAccountRequested());
        }

        UserSettings saved = userSettingsRepository.save(settings);
        return toPayload(saved);
    }

    private UserSettings getOrCreate(Long userId) {
        return userSettingsRepository.findByUserId(userId).orElseGet(() ->
                userSettingsRepository.save(
                        UserSettings.builder()
                                .userId(userId)
                                .build()
                )
        );
    }

    private static String sanitizeEmergencyContact(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() > 40) {
            normalized = normalized.substring(0, 40);
        }
        return normalized;
    }

    private static String normalizeAllowed(String value, Set<String> allowed, String fallback) {
        String normalized = value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
        if (allowed.contains(normalized)) {
            return normalized;
        }
        return fallback;
    }

    private static String normalizeLanguageCode(String value) {
        String normalized = value == null ? "en" : value.trim().toLowerCase(Locale.ROOT);
        if (normalized.length() < 2 || normalized.length() > 12 || !normalized.matches("^[a-z-]+$")) {
            return "en";
        }
        return normalized;
    }

    private static Map<String, Object> toPayload(UserSettings settings) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tripSharingDefault", settings.getTripSharingDefault());
        payload.put("hidePhoneNumber", settings.getHidePhoneNumber());
        payload.put("emergencyContact", settings.getEmergencyContact());
        payload.put("defaultPaymentMethod", settings.getDefaultPaymentMethod());
        payload.put("autoTipEnabled", settings.getAutoTipEnabled());
        payload.put("invoiceEmailEnabled", settings.getInvoiceEmailEnabled());
        payload.put("mapStyle", settings.getMapStyle());
        payload.put("avoidTolls", settings.getAvoidTolls());
        payload.put("avoidHighways", settings.getAvoidHighways());
        payload.put("navigationVoiceLanguage", settings.getNavigationVoiceLanguage());
        payload.put("preferredVehicleType", settings.getPreferredVehicleType());
        payload.put("acPreference", settings.getAcPreference());
        payload.put("quietRide", settings.getQuietRide());
        payload.put("deleteAccountRequested", settings.getDeleteAccountRequested());
        return payload;
    }
}
