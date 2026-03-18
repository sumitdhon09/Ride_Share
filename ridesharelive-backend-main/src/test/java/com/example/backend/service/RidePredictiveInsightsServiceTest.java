package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import com.example.backend.entity.Ride;
import com.example.backend.repository.RideRepository;

class RidePredictiveInsightsServiceTest {

    private RideRepository rideRepository;
    private Clock clock;
    private RidePredictiveInsightsService predictiveInsightsService;

    @BeforeEach
    void setUp() {
        rideRepository = Mockito.mock(RideRepository.class);
        clock = Clock.fixed(Instant.parse("2026-03-19T12:00:00Z"), ZoneOffset.UTC);
        predictiveInsightsService = new RidePredictiveInsightsService(rideRepository, clock);
    }

    @Test
    void generateInsightsElevatesSurgeWhenDemandOutrunsDriverSupply() {
        List<Ride> rides = new ArrayList<>();
        for (int day = 1; day <= 10; day += 1) {
            rides.add(completedRide(day, 13, 5, 101L + day));
            rides.add(completedRide(day, 13, 20, 201L + day));
            rides.add(completedRide(day, 13, 40, 301L + day));
        }

        rides.add(requestedRide(5));
        rides.add(requestedRide(15));
        rides.add(requestedRide(25));
        rides.add(requestedRide(35));

        rides.add(activeRide(401L, Ride.Status.ACCEPTED, 18));
        rides.add(activeRide(402L, Ride.Status.PICKED, 22));

        when(rideRepository.findAll()).thenReturn(rides);

        RidePredictiveInsightsService.PredictiveInsights insights = predictiveInsightsService.generateInsights();

        assertEquals("MEDIUM", insights.confidence());
        assertEquals(4, insights.demandForecast().currentOpenRequests());
        assertTrue(insights.demandForecast().nextHourDemand() >= 4);
        assertTrue(insights.demandForecast().nextTwoHoursDemand() >= insights.demandForecast().nextHourDemand());
        assertTrue(insights.surgeRecommendation().suggestedMultiplier() >= 1.4);
        assertTrue(insights.etaGuidance().predictedPickupMinutes() >= insights.etaGuidance().baselinePickupMinutes());
        assertTrue(insights.driverSupplyPlan().additionalDriversNeeded() > 0);
    }

    @Test
    void generateInsightsReturnsNeutralDefaultsWhenHistoryIsEmpty() {
        when(rideRepository.findAll()).thenReturn(List.of());

        RidePredictiveInsightsService.PredictiveInsights insights = predictiveInsightsService.generateInsights();

        assertEquals("LOW", insights.confidence());
        assertEquals(0, insights.demandForecast().currentOpenRequests());
        assertEquals(0, insights.demandForecast().nextHourDemand());
        assertEquals(0, insights.driverSupplyPlan().recommendedOnlineDrivers());
        assertEquals(1.0, insights.surgeRecommendation().suggestedMultiplier());
        assertEquals("Insufficient history", insights.demandForecast().peakWindow());
    }

    private Ride completedRide(int daysAgo, int hour, int minute, Long driverId) {
        ZonedDateTime createdAt = Instant.now(clock)
                .atZone(ZoneOffset.UTC)
                .minusDays(daysAgo)
                .withHour(hour)
                .withMinute(minute)
                .withSecond(0)
                .withNano(0);

        return Ride.builder()
                .driverId(driverId)
                .status(Ride.Status.COMPLETED)
                .fare(160.0)
                .createdAt(createdAt.toInstant())
                .acceptedAt(createdAt.plusMinutes(6).toInstant())
                .build();
    }

    private Ride requestedRide(int minutesAgo) {
        return Ride.builder()
                .status(Ride.Status.REQUESTED)
                .fare(120.0)
                .createdAt(Instant.now(clock).minusSeconds(minutesAgo * 60L))
                .build();
    }

    private Ride activeRide(Long driverId, Ride.Status status, int minutesAgo) {
        Instant createdAt = Instant.now(clock).minusSeconds((minutesAgo + 8L) * 60L);
        Instant acceptedAt = Instant.now(clock).minusSeconds(minutesAgo * 60L);

        return Ride.builder()
                .driverId(driverId)
                .status(status)
                .fare(180.0)
                .createdAt(createdAt)
                .acceptedAt(acceptedAt)
                .build();
    }
}
