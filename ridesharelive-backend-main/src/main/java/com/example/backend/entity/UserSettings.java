package com.example.backend.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "user_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private Long userId;

    @Builder.Default
    @Column(nullable = false)
    private Boolean tripSharingDefault = true;

    @Builder.Default
    @Column(nullable = false)
    private Boolean hidePhoneNumber = false;

    @Builder.Default
    @Column(length = 40, nullable = false)
    private String emergencyContact = "";

    @Builder.Default
    @Column(length = 20, nullable = false)
    private String defaultPaymentMethod = "upi";

    @Builder.Default
    @Column(nullable = false)
    private Boolean autoTipEnabled = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean invoiceEmailEnabled = true;

    @Builder.Default
    @Column(length = 20, nullable = false)
    private String mapStyle = "standard";

    @Builder.Default
    @Column(nullable = false)
    private Boolean avoidTolls = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean avoidHighways = false;

    @Builder.Default
    @Column(length = 12, nullable = false)
    private String navigationVoiceLanguage = "en";

    @Builder.Default
    @Column(length = 20, nullable = false)
    private String preferredVehicleType = "mini";

    @Builder.Default
    @Column(length = 20, nullable = false)
    private String acPreference = "any";

    @Builder.Default
    @Column(nullable = false)
    private Boolean quietRide = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean deleteAccountRequested = false;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    public void onCreate() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    public void onUpdate() {
        updatedAt = Instant.now();
    }
}
