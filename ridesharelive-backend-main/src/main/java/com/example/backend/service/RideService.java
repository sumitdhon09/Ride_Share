package com.example.backend.service;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import java.time.Instant;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.backend.entity.Ride;
import com.example.backend.entity.User;
import com.example.backend.repository.RideRepository;

@Service
public class RideService {

    private static final double BASE_FARE_INR = 60;
    private static final double FARE_STEP_KM = 40;
    private static final double FARE_STEP_INR = 50;
    private static final double PLATFORM_SURCHARGE_INR = 50;
    private static final double ECONOMY_MAX_DISTANCE_KM = 80;
    private static final Map<String, Integer> RIDE_SURCHARGES = Map.of(
            "ECONOMY", 0,
            "COMFORT", 50,
            "XL", 150,
            "PREMIUM", 200,
            "BIKE", -20,
            "MINI", 0,
            "SEDAN", 120
    );

    @Autowired
    private RideRepository rideRepository;

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private DriverLocationCacheService driverLocationCacheService;

    public Ride bookRide(Ride ride) {
        normalizePaymentState(ride);
        if (ride.getCreatedAt() == null) {
            ride.setCreatedAt(Instant.now());
        }
        Ride savedRide = rideRepository.save(ride);
        notificationService.notifyRideEvent(savedRide);
        return savedRide;
    }

    public Ride updateStatus(Long rideId, Ride.Status status, String driverId, String otp) {
        Ride ride = rideRepository.findById(rideId).orElseThrow();
        if (ride.getStatus() == Ride.Status.COMPLETED || ride.getStatus() == Ride.Status.CANCELLED) {
            throw new IllegalArgumentException("Ride is already closed.");
        }

        boolean otpGenerated = false;

        if (status == Ride.Status.ACCEPTED && driverId != null) {
            ride.setDriverId(Long.valueOf(driverId.trim()));
            if (ride.getAcceptedAt() == null) {
                ride.setAcceptedAt(Instant.now());
            }
            if (ride.getStartOtp() == null || ride.getStartOtp().isBlank()) {
                ride.setStartOtp(generateOtp());
                otpGenerated = true;
            }
            if (ride.getEndOtp() == null || ride.getEndOtp().isBlank()) {
                ride.setEndOtp(generateOtp());
                otpGenerated = true;
            }
        } else if (status == Ride.Status.PICKED) {
            if (ride.getStatus() != Ride.Status.ACCEPTED) {
                throw new IllegalArgumentException("Ride must be accepted before pickup.");
            }
            validateOtp(ride.getStartOtp(), otp, "Invalid start OTP.");
        } else if (status == Ride.Status.COMPLETED) {
            if (ride.getStatus() != Ride.Status.PICKED) {
                throw new IllegalArgumentException("Ride must be picked before completion.");
            }
            validateOtp(ride.getEndOtp(), otp, "Invalid end OTP.");
        }

        ride.setStatus(status);
        Ride updatedRide = rideRepository.save(ride);
        if (status == Ride.Status.ACCEPTED && otpGenerated) {
            notificationService.sendRideOtpEmails(updatedRide);
        }
        notificationService.notifyRideEvent(updatedRide);
        return updatedRide;
    }

    public List<Ride> getRidesForUser(User user) {
        return rideRepository.findAll().stream()
                .filter(r -> (r.getRiderId() != null && r.getRiderId().equals(user.getId()))
                || (r.getDriverId() != null && r.getDriverId().equals(user.getId())))
                .toList();
    }

    public List<Ride> getRequestedRides() {
        return rideRepository.findAll().stream()
                .filter(r -> r.getStatus() != Ride.Status.COMPLETED && r.getStatus() != Ride.Status.CANCELLED)
                .toList();
    }

    public Ride getRideById(Long rideId) {
        return rideRepository.findById(rideId).orElse(null);
    }

    public Ride submitFeedback(Long rideId, User user, Integer rating, String comment) {
        if (rating == null || rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5.");
        }

        Ride ride = rideRepository.findById(rideId).orElseThrow();
        if (ride.getStatus() != Ride.Status.COMPLETED) {
            throw new IllegalArgumentException("Feedback can only be submitted after ride completion.");
        }

        String role = (user.getRole() == null ? "" : user.getRole()).trim().toUpperCase(Locale.ROOT);
        String normalizedComment = comment == null ? "" : comment.trim();

        if ("DRIVER".equals(role)) {
            if (ride.getDriverId() == null || !ride.getDriverId().equals(user.getId())) {
                throw new IllegalArgumentException("Driver is not assigned to this ride.");
            }
            ride.setDriverRating(rating);
            ride.setDriverFeedback(normalizedComment);
        } else {
            if (ride.getRiderId() == null || !ride.getRiderId().equals(user.getId())) {
                throw new IllegalArgumentException("Rider does not own this ride.");
            }
            ride.setRiderRating(rating);
            ride.setRiderFeedback(normalizedComment);
        }

        return rideRepository.save(ride);
    }

    public Ride submitDriverLocation(Long rideId, User user, Double lat, Double lon) {
        if (lat == null || lon == null || !Double.isFinite(lat) || !Double.isFinite(lon)) {
            throw new IllegalArgumentException("Invalid coordinates.");
        }

        Ride ride = rideRepository.findById(rideId).orElseThrow();
        if (ride.getStatus() != Ride.Status.ACCEPTED && ride.getStatus() != Ride.Status.PICKED) {
            throw new IllegalArgumentException("Live location can only be updated for active rides.");
        }
        if (ride.getDriverId() == null || !ride.getDriverId().equals(user.getId())) {
            throw new IllegalArgumentException("Driver is not assigned to this ride.");
        }

        ride.setDriverLat(lat);
        ride.setDriverLon(lon);
        ride.setDriverLocationUpdatedAt(Instant.now());
        Ride savedRide = rideRepository.save(ride);
        try {
            driverLocationCacheService.upsertDriverLocation(user.getId(), lat, lon);
        } catch (Exception ignored) {
            // Keep ride flow resilient even when Redis is temporarily unavailable.
        }
        return savedRide;
    }

    public Ride cancelRide(Long rideId, User user, String reason) {
        Ride ride = rideRepository.findById(rideId).orElseThrow();
        if (ride.getStatus() == Ride.Status.COMPLETED || ride.getStatus() == Ride.Status.CANCELLED) {
            throw new IllegalArgumentException("Ride cannot be cancelled.");
        }

        String role = (user.getRole() == null ? "" : user.getRole()).trim().toUpperCase(Locale.ROOT);
        boolean isRider = ride.getRiderId() != null && ride.getRiderId().equals(user.getId());
        boolean isDriver = ride.getDriverId() != null && ride.getDriverId().equals(user.getId());
        if (!isRider && !isDriver) {
            throw new IllegalArgumentException("You are not allowed to cancel this ride.");
        }

        String cancelledBy = isDriver && "DRIVER".equals(role) ? "DRIVER" : "RIDER";
        double fee = calculateCancellationFee(ride, cancelledBy);

        String normalizedReason = reason == null ? "" : reason.trim();
        if (normalizedReason.isBlank()) {
            normalizedReason = cancelledBy.equals("DRIVER") ? "Driver cancelled the ride." : "Rider cancelled the ride.";
        }

        ride.setStatus(Ride.Status.CANCELLED);
        ride.setCancelledBy(cancelledBy);
        ride.setCancellationReason(normalizedReason);
        ride.setCancellationFee(fee);
        Ride cancelledRide = rideRepository.save(ride);
        notificationService.notifyRideEvent(cancelledRide);
        return cancelledRide;
    }

    public Map<String, Object> estimateRide(Double distanceKm, String rideType) {
        if (distanceKm == null || !Double.isFinite(distanceKm) || distanceKm <= 0) {
            throw new IllegalArgumentException("distanceKm must be a positive number.");
        }

        String normalizedType = normalizeRideType(rideType);
        double safeDistance = Math.max(0, distanceKm);
        String effectiveType =
                ("ECONOMY".equals(normalizedType) && safeDistance > ECONOMY_MAX_DISTANCE_KM) ? "COMFORT" : normalizedType;

        int surcharge = RIDE_SURCHARGES.getOrDefault(effectiveType, 0);
        double slabs = Math.floor(safeDistance / FARE_STEP_KM);
        double fare = BASE_FARE_INR + slabs * FARE_STEP_INR + PLATFORM_SURCHARGE_INR + surcharge;
        int roundedFare = (int) Math.max(49, Math.round(fare));

        int etaMin = Math.max(6, (int) Math.round((safeDistance / speedForRideType(effectiveType)) * 60) + 4);
        int etaMax = etaMin + 5;

        return Map.of(
                "distanceKm", Math.round(safeDistance * 10.0) / 10.0,
                "rideType", effectiveType.toLowerCase(Locale.ROOT),
                "estimatedFare", roundedFare,
                "fareMin", Math.max(49, roundedFare - 20),
                "fareMax", roundedFare + 35,
                "etaMinMinutes", etaMin,
                "etaMaxMinutes", etaMax,
                "currency", "INR"
        );
    }

    private static String generateOtp() {
        int value = ThreadLocalRandom.current().nextInt(1000, 10000);
        return String.valueOf(value);
    }

    private static String normalizeRideType(String rideType) {
        if (rideType == null || rideType.isBlank()) {
            return "ECONOMY";
        }
        return rideType.trim().toUpperCase(Locale.ROOT);
    }

    private static double speedForRideType(String rideType) {
        return switch (rideType) {
            case "BIKE" -> 32;
            case "SEDAN", "PREMIUM", "XL" -> 24;
            default -> 28;
        };
    }

    private static void validateOtp(String expectedOtp, String providedOtp, String errorMessage) {
        if (expectedOtp == null || expectedOtp.isBlank()) {
            throw new IllegalArgumentException("OTP is not generated for this ride.");
        }
        String normalized = providedOtp == null ? "" : providedOtp.trim();
        if (!expectedOtp.equals(normalized)) {
            throw new IllegalArgumentException(errorMessage);
        }
    }

    private static double calculateCancellationFee(Ride ride, String cancelledBy) {
        if ("DRIVER".equals(cancelledBy)) {
            return 0;
        }

        double fare = ride.getFare() == null ? 0 : Math.max(0, ride.getFare());
        if (ride.getStatus() == Ride.Status.REQUESTED) {
            return 0;
        }
        if (ride.getStatus() == Ride.Status.ACCEPTED) {
            return Math.min(60, Math.max(20, fare * 0.20));
        }
        if (ride.getStatus() == Ride.Status.PICKED) {
            return Math.min(180, Math.max(50, fare * 0.40));
        }
        return 0;
    }

    private void normalizePaymentState(Ride ride) {
        String mode = ride.getPaymentMode() == null ? "" : ride.getPaymentMode().trim().toUpperCase(Locale.ROOT);
        if (mode.isBlank()) {
            mode = "CASH";
        }
        ride.setPaymentMode(mode);

        if ("CARD".equals(mode) || "WALLET".equals(mode) || "UPI".equals(mode)) {
            String paymentReference = ride.getPaymentReference() == null ? "" : ride.getPaymentReference().trim();
            if (paymentReference.isBlank()) {
                throw new IllegalArgumentException("Online payment reference is required.");
            }

            try {
                Map<String, Object> verification = paymentService.verifyCheckoutSession(paymentReference);
                boolean paid = Boolean.TRUE.equals(verification.get("paid"));
                if (!paid) {
                    throw new IllegalArgumentException("Online payment is not completed.");
                }
                ride.setPaymentReference(paymentReference);
                ride.setPaymentStatus("PAID");
            } catch (IllegalArgumentException validationError) {
                throw validationError;
            } catch (Exception paymentError) {
                throw new IllegalArgumentException("Unable to verify online payment.");
            }
            return;
        }

        if ("CASH".equals(mode)) {
            ride.setPaymentStatus("PAY_AT_END");
            if (ride.getPaymentReference() == null || ride.getPaymentReference().isBlank()) {
                ride.setPaymentReference("CASH");
            }
            return;
        }

        if (ride.getPaymentStatus() == null || ride.getPaymentStatus().isBlank()) {
            ride.setPaymentStatus("PENDING");
        }
    }
}
