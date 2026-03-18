package com.example.backend.service;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.example.backend.entity.Ride;
import com.example.backend.repository.RideRepository;

@Service
public class RidePredictiveInsightsService {

    private static final int HISTORY_DAYS = 14;
    private static final int ACTIVE_DRIVER_LOOKBACK_HOURS = 6;
    private static final int RECENT_DEMAND_LOOKBACK_HOURS = 3;
    private static final double DRIVER_CAPACITY_PER_HOUR = 1.35;
    private static final int DEFAULT_BASELINE_PICKUP_MINUTES = 12;

    private final RideRepository rideRepository;
    private final Clock clock;

    @Autowired
    public RidePredictiveInsightsService(RideRepository rideRepository) {
        this(rideRepository, Clock.systemUTC());
    }

    RidePredictiveInsightsService(RideRepository rideRepository, Clock clock) {
        this.rideRepository = rideRepository;
        this.clock = clock;
    }

    public PredictiveInsights generateInsights() {
        Instant now = Instant.now(clock);
        ZoneId zoneId = clock.getZone();
        ZonedDateTime nowZoned = now.atZone(zoneId);
        List<Ride> rides = rideRepository.findAll();

        int currentOpenRequests = (int) rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.REQUESTED)
                .count();

        Set<Long> busyDriverIds = new HashSet<>();
        Set<Long> activeDriverIds = new HashSet<>();
        List<Ride> demandHistory = rides.stream()
                .filter(ride -> ride.getCreatedAt() != null)
                .filter(ride -> ride.getCreatedAt().isAfter(now.minus(Duration.ofDays(HISTORY_DAYS))))
                .toList();

        rides.forEach(ride -> {
            if (ride.getDriverId() == null) {
                return;
            }

            if (ride.getStatus() == Ride.Status.ACCEPTED || ride.getStatus() == Ride.Status.PICKED) {
                busyDriverIds.add(ride.getDriverId());
            }

            Instant driverSignal = resolveDriverSignalTime(ride);
            if (driverSignal != null && driverSignal.isAfter(now.minus(Duration.ofHours(ACTIVE_DRIVER_LOOKBACK_HOURS)))) {
                activeDriverIds.add(ride.getDriverId());
            }
        });
        activeDriverIds.addAll(busyDriverIds);

        double recentDemandRate = demandHistory.stream()
                .filter(ride -> ride.getCreatedAt().isAfter(now.minus(Duration.ofHours(RECENT_DEMAND_LOOKBACK_HOURS))))
                .count() / (double) RECENT_DEMAND_LOOKBACK_HOURS;

        double currentHourHistorical = averageDemandForHour(demandHistory, now, nowZoned.getHour(), zoneId);
        double nextHourHistorical = averageDemandForHour(demandHistory, now, nowZoned.plusHours(1).getHour(), zoneId);
        double secondHourHistorical = averageDemandForHour(demandHistory, now, nowZoned.plusHours(2).getHour(), zoneId);

        int nextHourDemand = Math.max(
                currentOpenRequests,
                (int) Math.round((nextHourHistorical * 0.65) + (recentDemandRate * 0.35) + (currentOpenRequests * 0.40))
        );
        int secondHourDemand = Math.max(
                0,
                (int) Math.round((secondHourHistorical * 0.70) + (recentDemandRate * 0.30) + (currentOpenRequests * 0.15))
        );
        int nextTwoHoursDemand = nextHourDemand + secondHourDemand;

        int activeDriversEstimate = activeDriverIds.size();
        int busyDrivers = busyDriverIds.size();
        double demandPressure = (currentOpenRequests + (nextHourDemand * 0.75)) / Math.max(1.0, activeDriversEstimate);

        double suggestedMultiplier = surgeMultiplierForPressure(demandPressure);
        String surgeIntensity = surgeIntensityForMultiplier(suggestedMultiplier);

        double acceptanceDelayMinutes = averageAcceptanceDelayMinutes(rides, now);
        int baselinePickupMinutes = Math.max(
                DEFAULT_BASELINE_PICKUP_MINUTES,
                (int) Math.round(Math.max(4.0, acceptanceDelayMinutes + 5.0))
        );
        int etaPenaltyMinutes = Math.max(
                0,
                (int) Math.round(Math.max(0.0, demandPressure - 1.0) * 4.0 + ("RISING".equals(demandTrend(recentDemandRate, currentHourHistorical)) ? 1.0 : 0.0))
        );
        int predictedPickupMinutes = baselinePickupMinutes + etaPenaltyMinutes;

        int recommendedOnlineDrivers;
        if (nextHourDemand == 0 && busyDrivers == 0 && activeDriversEstimate == 0) {
            recommendedOnlineDrivers = 0;
        } else {
            recommendedOnlineDrivers = Math.max(
                    busyDrivers,
                    (int) Math.ceil((nextHourDemand + (currentOpenRequests * 0.50)) / DRIVER_CAPACITY_PER_HOUR)
            );
        }
        int additionalDriversNeeded = Math.max(0, recommendedOnlineDrivers - activeDriversEstimate);

        String confidence = confidenceForSampleSize(demandHistory.size());
        String demandTrend = demandTrend(recentDemandRate, currentHourHistorical);
        String peakWindow = peakDemandWindow(demandHistory, zoneId);

        return new PredictiveInsights(
                "demand-heuristics-v1",
                now,
                confidence,
                demandHistory.size(),
                new DemandForecast(
                        demandTrend,
                        currentOpenRequests,
                        nextHourDemand,
                        nextTwoHoursDemand,
                        peakWindow
                ),
                new SurgeRecommendation(
                        suggestedMultiplier,
                        surgeIntensity,
                        surgeReason(suggestedMultiplier, currentOpenRequests, activeDriversEstimate)
                ),
                new EtaGuidance(
                        baselinePickupMinutes,
                        predictedPickupMinutes,
                        Math.max(0, predictedPickupMinutes - baselinePickupMinutes),
                        etaReason(etaPenaltyMinutes, demandTrend)
                ),
                new DriverSupplyPlan(
                        activeDriversEstimate,
                        busyDrivers,
                        recommendedOnlineDrivers,
                        additionalDriversNeeded,
                        supplyAction(additionalDriversNeeded)
                )
        );
    }

    private static Instant resolveDriverSignalTime(Ride ride) {
        if (ride.getDriverLocationUpdatedAt() != null) {
            return ride.getDriverLocationUpdatedAt();
        }
        if (ride.getAcceptedAt() != null) {
            return ride.getAcceptedAt();
        }
        return ride.getCreatedAt();
    }

    private static double averageDemandForHour(List<Ride> rides, Instant referenceTime, int targetHour, ZoneId zoneId) {
        if (rides.isEmpty()) {
            return 0;
        }

        double weightedCount = 0;
        for (Ride ride : rides) {
            if (ride.getCreatedAt() == null) {
                continue;
            }

            ZonedDateTime createdAt = ride.getCreatedAt().atZone(zoneId);
            if (createdAt.getHour() != targetHour) {
                continue;
            }

            long ageDays = Math.max(0, Duration.between(ride.getCreatedAt(), referenceTime).toDays());
            double weight = ageDays <= 2 ? 1.0 : ageDays <= 7 ? 0.8 : 0.6;
            weightedCount += weight;
        }

        return weightedCount / HISTORY_DAYS;
    }

    private static double averageAcceptanceDelayMinutes(List<Ride> rides, Instant now) {
        double totalDelayMinutes = 0;
        int sampleCount = 0;

        for (Ride ride : rides) {
            if (ride.getCreatedAt() == null || ride.getAcceptedAt() == null) {
                continue;
            }
            if (ride.getAcceptedAt().isBefore(now.minus(Duration.ofDays(7)))) {
                continue;
            }

            long delayMinutes = Math.max(0, Duration.between(ride.getCreatedAt(), ride.getAcceptedAt()).toMinutes());
            totalDelayMinutes += delayMinutes;
            sampleCount += 1;
        }

        if (sampleCount == 0) {
            return 4;
        }

        return totalDelayMinutes / sampleCount;
    }

    private static double surgeMultiplierForPressure(double demandPressure) {
        if (demandPressure < 0.9) {
            return 1.0;
        }
        if (demandPressure < 1.2) {
            return 1.1;
        }
        if (demandPressure < 1.5) {
            return 1.25;
        }
        if (demandPressure < 2.0) {
            return 1.4;
        }
        return 1.6;
    }

    private static String surgeIntensityForMultiplier(double multiplier) {
        if (multiplier >= 1.6) {
            return "SEVERE";
        }
        if (multiplier >= 1.4) {
            return "HIGH";
        }
        if (multiplier > 1.0) {
            return "MODERATE";
        }
        return "NORMAL";
    }

    private static String confidenceForSampleSize(int sampleSize) {
        if (sampleSize >= 60) {
            return "HIGH";
        }
        if (sampleSize >= 20) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private static String demandTrend(double recentDemandRate, double currentHourHistorical) {
        if (recentDemandRate > currentHourHistorical * 1.2 && recentDemandRate >= 1.0) {
            return "RISING";
        }
        if (currentHourHistorical > 0 && recentDemandRate < currentHourHistorical * 0.8) {
            return "SOFT";
        }
        return "STABLE";
    }

    private static String peakDemandWindow(List<Ride> rides, ZoneId zoneId) {
        if (rides.isEmpty()) {
            return "Insufficient history";
        }

        int[] hourlyCounts = new int[24];
        for (Ride ride : rides) {
            if (ride.getCreatedAt() == null) {
                continue;
            }
            hourlyCounts[ride.getCreatedAt().atZone(zoneId).getHour()] += 1;
        }

        int bestHour = 0;
        int bestWindowVolume = -1;
        for (int hour = 0; hour < hourlyCounts.length; hour += 1) {
            int nextHour = (hour + 1) % hourlyCounts.length;
            int volume = hourlyCounts[hour] + hourlyCounts[nextHour];
            if (volume > bestWindowVolume) {
                bestWindowVolume = volume;
                bestHour = hour;
            }
        }

        return String.format(Locale.ROOT, "%02d:00-%02d:00", bestHour, (bestHour + 2) % 24);
    }

    private static String surgeReason(double multiplier, int currentOpenRequests, int activeDriversEstimate) {
        if (multiplier <= 1.0) {
            return "Supply is covering demand without surcharge pressure.";
        }
        return String.format(
                Locale.ROOT,
                "%d open requests versus %d active drivers is pushing marketplace pressure above baseline.",
                currentOpenRequests,
                activeDriversEstimate
        );
    }

    private static String etaReason(int etaPenaltyMinutes, String demandTrend) {
        if (etaPenaltyMinutes <= 0) {
            return "Pickup timing is close to baseline right now.";
        }
        if ("RISING".equals(demandTrend)) {
            return "Demand is rising, so pickup ETA is likely to stretch beyond the normal baseline.";
        }
        return "Current marketplace pressure is slowing pickup times slightly.";
    }

    private static String supplyAction(int additionalDriversNeeded) {
        if (additionalDriversNeeded <= 0) {
            return "Current driver supply is sufficient for the next hour forecast.";
        }
        return String.format(Locale.ROOT, "Bring %d more drivers online to absorb forecasted demand.", additionalDriversNeeded);
    }

    public record PredictiveInsights(
            String model,
            Instant generatedAt,
            String confidence,
            int sampleSize,
            DemandForecast demandForecast,
            SurgeRecommendation surgeRecommendation,
            EtaGuidance etaGuidance,
            DriverSupplyPlan driverSupplyPlan
    ) {
    }

    public record DemandForecast(
            String trend,
            int currentOpenRequests,
            int nextHourDemand,
            int nextTwoHoursDemand,
            String peakWindow
    ) {
    }

    public record SurgeRecommendation(
            double suggestedMultiplier,
            String intensity,
            String reason
    ) {
    }

    public record EtaGuidance(
            int baselinePickupMinutes,
            int predictedPickupMinutes,
            int deltaMinutes,
            String reason
    ) {
    }

    public record DriverSupplyPlan(
            int activeDriversEstimate,
            int busyDrivers,
            int recommendedOnlineDrivers,
            int additionalDriversNeeded,
            String action
    ) {
    }
}
