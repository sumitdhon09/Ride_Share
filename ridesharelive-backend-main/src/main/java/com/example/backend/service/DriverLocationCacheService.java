package com.example.backend.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.GeoResults;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.redis.connection.RedisGeoCommands.GeoLocation;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.GeoOperations;
import org.springframework.data.redis.domain.geo.GeoReference;
import org.springframework.data.redis.connection.RedisGeoCommands.GeoSearchCommandArgs;
import org.springframework.stereotype.Service;

import com.example.backend.repository.UserRepository;

@Service
public class DriverLocationCacheService {

    private static final String DRIVER_GEO_KEY = "drivers:geo";
    private static final String DRIVER_HASH_PREFIX = "driver:location:";

    private final StringRedisTemplate redisTemplate;
    private final UserRepository userRepository;

    public DriverLocationCacheService(StringRedisTemplate redisTemplate, UserRepository userRepository) {
        this.redisTemplate = redisTemplate;
        this.userRepository = userRepository;
    }

    public void upsertDriverLocation(Long driverId, Double lat, Double lon) {
        if (driverId == null || lat == null || lon == null) {
            return;
        }
        if (!Double.isFinite(lat) || !Double.isFinite(lon)) {
            return;
        }

        String member = String.valueOf(driverId);
        Point point = new Point(lon, lat);
        GeoOperations<String, String> geoOps = redisTemplate.opsForGeo();
        geoOps.add(DRIVER_GEO_KEY, point, member);

        String hashKey = DRIVER_HASH_PREFIX + member;
        redisTemplate.opsForHash().put(hashKey, "driverId", member);
        redisTemplate.opsForHash().put(hashKey, "lat", String.valueOf(lat));
        redisTemplate.opsForHash().put(hashKey, "lon", String.valueOf(lon));
        redisTemplate.opsForHash().put(hashKey, "updatedAt", Instant.now().toString());
    }

    public List<Map<String, Object>> findNearbyDrivers(Double lat, Double lon, Double radiusKm, Integer limit) {
        if (lat == null || lon == null || radiusKm == null) {
            return List.of();
        }
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || !Double.isFinite(radiusKm) || radiusKm <= 0) {
            return List.of();
        }

        int safeLimit = (limit == null || limit <= 0) ? 10 : Math.min(limit, 100);
        Distance searchDistance = new Distance(radiusKm, Metrics.KILOMETERS);
        GeoSearchCommandArgs args = GeoSearchCommandArgs.newGeoSearchArgs().includeCoordinates().sortAscending().limit(50); // Fetch more to filter online

        GeoOperations<String, String> geoOps = redisTemplate.opsForGeo();
        GeoResults<GeoLocation<String>> results =
                geoOps.search(DRIVER_GEO_KEY, GeoReference.fromCoordinate(lon, lat), searchDistance, args);
        if (results == null || results.getContent().isEmpty()) {
            return List.of();
        }

        List<Map<String, Object>> nearby = new ArrayList<>();
        for (GeoResult<GeoLocation<String>> result : results) {
            GeoLocation<String> content = result.getContent();
            if (content == null || content.getName() == null) {
                continue;
            }

            String driverIdStr = content.getName();
            Long driverId = Long.valueOf(driverIdStr);
            
            // Fetch driver details and check if online
            var driverOpt = userRepository.findById(driverId);
            if (driverOpt.isEmpty()) continue;
            var driver = driverOpt.get();
            
            // Only show online drivers who are actually drivers
            if (!Boolean.TRUE.equals(driver.getOnline()) || !"DRIVER".equalsIgnoreCase(driver.getRole())) {
                continue;
            }

            Map<String, Object> entry = new LinkedHashMap<>();
            entry.put("id", driver.getId());
            entry.put("name", driver.getName());
            entry.put("vehicleType", driver.getVehicleLabel() == null ? "AUTO" : driver.getVehicleLabel());
            entry.put("rating", driver.getRatingAverage() == null ? 4.5 : driver.getRatingAverage());
            entry.put("vehicleNumber", "TN-" + (1000 + driver.getId() % 9000));
            
            if (result.getDistance() != null) {
                double dist = result.getDistance().getValue();
                entry.put("distanceKm", roundTo3(dist));
                // Estimate ETA: 2 mins per km + 2 mins base
                entry.put("etaMinutes", (int) Math.round(dist * 2.0 + 2.0));
            }
            
            if (content.getPoint() != null) {
                entry.put("lon", roundTo6(content.getPoint().getX()));
                entry.put("lat", roundTo6(content.getPoint().getY()));
            }
            
            nearby.add(entry);
            if (nearby.size() >= safeLimit) break;
        }
        return nearby;
    }

    private static double roundTo3(double value) {
        return Math.round(value * 1000.0) / 1000.0;
    }

    private static double roundTo6(double value) {
        return Math.round(value * 1_000_000.0) / 1_000_000.0;
    }
}
