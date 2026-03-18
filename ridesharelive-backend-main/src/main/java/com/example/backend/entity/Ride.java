package com.example.backend.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Column;
import java.time.Instant;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Ride {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String pickupLocation;
    private String dropLocation;
    private Double fare;

    private Long driverId;
    private Long riderId;

    private String paymentMode;
    private String paymentReference;
    private String paymentStatus;

    private String startOtp;
    private String endOtp;
    private Instant createdAt;
    private Instant acceptedAt;

    private Double driverLat;
    private Double driverLon;
    private Instant driverLocationUpdatedAt;

    @Column(length = 600)
    private String cancellationReason;

    private String cancelledBy;
    private Double cancellationFee;

    private Integer riderRating;

    @Column(length = 600)
    private String riderFeedback;

    private Integer driverRating;

    @Column(length = 600)
    private String driverFeedback;

    @Enumerated(EnumType.STRING)
    private Status status;

    public enum Status {
        REQUESTED, ACCEPTED, PICKED, COMPLETED, CANCELLED
    }

}
