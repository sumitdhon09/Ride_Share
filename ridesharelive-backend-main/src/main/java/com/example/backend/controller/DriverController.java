package com.example.backend.controller;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.service.DriverLocationCacheService;

@RestController
@RequestMapping("/api/drivers")
public class DriverController {

    @Autowired
    private DriverLocationCacheService driverLocationCacheService;

    @GetMapping("/nearby")
    public ResponseEntity<?> getNearbyDrivers(
            @RequestParam("lat") Double lat,
            @RequestParam("lon") Double lon,
            @RequestParam(value = "radiusKm", required = false, defaultValue = "5") Double radiusKm,
            @RequestParam(value = "limit", required = false, defaultValue = "10") Integer limit
    ) {
        try {
            return ResponseEntity.ok(driverLocationCacheService.findNearbyDrivers(lat, lon, radiusKm, limit));
        } catch (Exception e) {
            // Silently return empty list on cache/service errors to keep frontend resilient
            return ResponseEntity.ok(List.of());
        }
    }
}
