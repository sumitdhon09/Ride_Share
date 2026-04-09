package com.example.backend.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class RideBookingRequest {

    @NotBlank(message = "Pickup location is required")
    private String pickupLocation;

    @NotNull(message = "Pickup latitude is required")
    private Double pickupLat;

    @NotNull(message = "Pickup longitude is required")
    private Double pickupLon;

    @NotBlank(message = "Drop location is required")
    private String dropLocation;

    @NotNull(message = "Drop latitude is required")
    private Double dropLat;

    @NotNull(message = "Drop longitude is required")
    private Double dropLon;

    @NotNull(message = "Fare is required")
    private Double fare;

    @NotBlank(message = "Ride type is required")
    private String rideType;
}
