package com.example.backend.util;

public class LocationValidator {

    // Approximate bounding box for India
    private static final double MIN_LAT = 8.4;
    private static final double MAX_LAT = 37.6;
    private static final double MIN_LON = 68.7;
    private static final double MAX_LON = 97.25;

    public static boolean isInsideIndia(Double lat, Double lon) {
        if (lat == null || lon == null) {
            return false;
        }
        return lat >= MIN_LAT && lat <= MAX_LAT && lon >= MIN_LON && lon <= MAX_LON;
    }

    public static boolean isValidCoordinate(Double lat, Double lon) {
        if (lat == null || lon == null) {
            return false;
        }
        return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
    }
}
