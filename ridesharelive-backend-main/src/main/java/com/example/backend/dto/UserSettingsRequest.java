package com.example.backend.dto;

import lombok.Data;

@Data
public class UserSettingsRequest {

    private Boolean tripSharingDefault;
    private Boolean hidePhoneNumber;
    private String emergencyContact;
    private String defaultPaymentMethod;
    private Boolean autoTipEnabled;
    private Boolean invoiceEmailEnabled;
    private String mapStyle;
    private Boolean avoidTolls;
    private Boolean avoidHighways;
    private String navigationVoiceLanguage;
    private String preferredVehicleType;
    private String acPreference;
    private Boolean quietRide;
    private Boolean deleteAccountRequested;
}
