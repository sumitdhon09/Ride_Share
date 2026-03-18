package com.example.backend.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import javax.crypto.SecretKey;

@Component
public class JwtUtil {

    @Value("${app.jwt.secret:}")
    private String secret;

    @Value("${app.jwt.access-expiration-ms:900000}")
    private long accessExpirationMs;

    @Value("${app.jwt.refresh-expiration-ms:604800000}")
    private long refreshExpirationMs;

    private SecretKey key;

    @PostConstruct
    public void init() {
        if (secret == null || secret.isBlank()) {
            throw new IllegalStateException("APP_JWT_SECRET must be set before starting the backend.");
        }
        if (secret.length() < 32) {
            throw new IllegalStateException("APP_JWT_SECRET must be at least 32 characters long.");
        }
        key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
    }

    public Map<String, Object> buildAuthClaims(Long userId, String role) {
        Map<String, Object> claims = new LinkedHashMap<>();
        claims.put("role", role);
        claims.put("userId", userId);
        return claims;
    }

    public String generateAccessToken(String subject, Map<String, Object> claims) {
        return generateToken(subject, claims, accessExpirationMs, "access");
    }

    public String generateRefreshToken(String subject, Map<String, Object> claims) {
        return generateToken(subject, claims, refreshExpirationMs, "refresh");
    }

    public long getAccessExpirationSeconds() {
        return Math.max(1, accessExpirationMs / 1000);
    }

    public Claims extractAllClaims(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }

    public String extractUsername(String token) {
        return extractAllClaims(token).getSubject();
    }

    public String extractTokenType(String token) {
        return extractAllClaims(token).get("tokenType", String.class);
    }

    public Date extractExpiration(String token) {
        return extractAllClaims(token).getExpiration();
    }

    public boolean isAccessTokenValid(String token) {
        return isTokenValid(token, "access");
    }

    public boolean isRefreshTokenValid(String token) {
        return isTokenValid(token, "refresh");
    }

    public boolean isTokenValid(String token, String expectedTokenType) {
        try {
            Claims claims = extractAllClaims(token);
            String tokenType = claims.get("tokenType", String.class);
            if (expectedTokenType != null && !expectedTokenType.equalsIgnoreCase(tokenType)) {
                return false;
            }
            return !claims.getExpiration().before(new Date());
        } catch (JwtException | IllegalArgumentException e) {
            return false;
        }
    }

    private String generateToken(String subject, Map<String, Object> claims, long expirationMs, String tokenType) {
        Map<String, Object> nextClaims = new LinkedHashMap<>();
        if (claims != null) {
            nextClaims.putAll(claims);
        }
        nextClaims.put("tokenType", tokenType);

        return Jwts.builder()
                .claims(nextClaims)
                .subject(subject)
                .id(UUID.randomUUID().toString())
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(key)
                .compact();
    }
}
