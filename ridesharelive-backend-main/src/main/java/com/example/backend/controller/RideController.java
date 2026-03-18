package com.example.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.entity.Ride;
import com.example.backend.entity.User;
import com.example.backend.service.DriverLocationCacheService;
import com.example.backend.service.RidePredictiveInsightsService;
import com.example.backend.service.RideService;
import com.example.backend.service.UserService;

@RestController
@RequestMapping("/rides")
public class RideController {

    @Autowired
    private RideService rideService;
    @Autowired
    private UserService userService;
    @Autowired
    private DriverLocationCacheService driverLocationCacheService;
    @Autowired
    private RidePredictiveInsightsService ridePredictiveInsightsService;

    @PostMapping("/book")
    public ResponseEntity<?> bookRide(@RequestBody Ride ride, @AuthenticationPrincipal UserDetails userDetails) {
        User rider = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        ride.setRiderId(rider.getId());
        ride.setStatus(Ride.Status.REQUESTED);
        try {
            Ride savedRide = rideService.bookRide(ride);
            return ResponseEntity.ok(savedRide);
        } catch (IllegalArgumentException bookingError) {
            return ResponseEntity.badRequest().body(bookingError.getMessage());
        }
    }

    @GetMapping("/estimate")
    public ResponseEntity<?> estimateRide(
            @RequestParam("distanceKm") Double distanceKm,
            @RequestParam(value = "rideType", required = false) String rideType
    ) {
        try {
            return ResponseEntity.ok(rideService.estimateRide(distanceKm, rideType));
        } catch (IllegalArgumentException estimateError) {
            return ResponseEntity.badRequest().body(estimateError.getMessage());
        }
    }

    @PostMapping("/status/{rideId}")
    public ResponseEntity<?> updateStatus(@PathVariable Long rideId, @RequestBody Map<String, String> req) {
        Ride.Status status = Ride.Status.valueOf(req.get("status"));
        String driverId = req.get("driverId");
        String otp = req.get("otp");

        try {
            Ride updated = rideService.updateStatus(rideId, status, driverId, otp);
            return ResponseEntity.ok(updated);
        } catch (IllegalArgumentException statusError) {
            return ResponseEntity.badRequest().body(statusError.getMessage());
        }
    }

    @GetMapping("/history")
    public ResponseEntity<?> rideHistory(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        List<Ride> rides = rideService.getRidesForUser(user);
        return ResponseEntity.ok(rides);
    }

    @GetMapping("/requested")
    public ResponseEntity<?> getRequestedRides() {
        return ResponseEntity.ok(rideService.getRequestedRides());
    }

    @GetMapping("/status/{rideId}")
    public ResponseEntity<?> getRideStatus(@PathVariable Long rideId) {
        Ride ride = rideService.getRideById(rideId);
        if (ride == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(ride);
    }

    @GetMapping("/drivers/nearby")
    public ResponseEntity<?> getNearbyDrivers(
            @RequestParam("lat") Double lat,
            @RequestParam("lon") Double lon,
            @RequestParam(value = "radiusKm", required = false, defaultValue = "5") Double radiusKm,
            @RequestParam(value = "limit", required = false, defaultValue = "10") Integer limit
    ) {
        try {
            return ResponseEntity.ok(driverLocationCacheService.findNearbyDrivers(lat, lon, radiusKm, limit));
        } catch (Exception cacheError) {
            return ResponseEntity.ok(List.of());
        }
    }

    @GetMapping("/insights/predictive")
    public ResponseEntity<?> getPredictiveInsights(@AuthenticationPrincipal UserDetails userDetails) {
        userService.findByEmail(userDetails.getUsername()).orElseThrow();
        return ResponseEntity.ok(ridePredictiveInsightsService.generateInsights());
    }

    @PostMapping("/feedback/{rideId}")
    public ResponseEntity<?> submitFeedback(
            @PathVariable Long rideId,
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();

        Integer rating = null;
        Object ratingValue = req.get("rating");
        if (ratingValue instanceof Number numberValue) {
            rating = numberValue.intValue();
        } else if (ratingValue != null) {
            try {
                rating = Integer.valueOf(ratingValue.toString());
            } catch (NumberFormatException ignored) {
                return ResponseEntity.badRequest().body("Rating must be a number between 1 and 5.");
            }
        }

        String comment = req.get("comment") == null ? "" : req.get("comment").toString();

        try {
            Ride updatedRide = rideService.submitFeedback(rideId, user, rating, comment);
            return ResponseEntity.ok(updatedRide);
        } catch (IllegalArgumentException feedbackError) {
            return ResponseEntity.badRequest().body(feedbackError.getMessage());
        }
    }

    @PostMapping("/location/{rideId}")
    public ResponseEntity<?> updateDriverLocation(
            @PathVariable Long rideId,
            @RequestBody Map<String, Object> req,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        Double lat = parseNumber(req.get("lat"));
        Double lon = parseNumber(req.get("lon"));

        try {
            Ride updatedRide = rideService.submitDriverLocation(rideId, user, lat, lon);
            return ResponseEntity.ok(updatedRide);
        } catch (IllegalArgumentException locationError) {
            return ResponseEntity.badRequest().body(locationError.getMessage());
        }
    }

    @PostMapping("/cancel/{rideId}")
    public ResponseEntity<?> cancelRide(
            @PathVariable Long rideId,
            @RequestBody(required = false) Map<String, Object> req,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        String reason = "";
        if (req != null && req.get("reason") != null) {
            reason = req.get("reason").toString();
        }

        try {
            Ride cancelledRide = rideService.cancelRide(rideId, user, reason);
            return ResponseEntity.ok(cancelledRide);
        } catch (IllegalArgumentException cancelError) {
            return ResponseEntity.badRequest().body(cancelError.getMessage());
        }
    }

    private static Double parseNumber(Object value) {
        if (value instanceof Number numberValue) {
            return numberValue.doubleValue();
        }
        if (value == null) {
            return null;
        }
        try {
            return Double.valueOf(value.toString());
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}

//history - Driver/Rider GetMapping
//UpdateStatus -> Post mapping
//Get getRidesatus
    // Active Rides - List rides that are not complete Get
