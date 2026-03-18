package com.example.backend.service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.backend.entity.RefreshToken;
import com.example.backend.entity.User;
import com.example.backend.repository.RefreshTokenRepository;
import com.example.backend.security.JwtUtil;

import io.jsonwebtoken.Claims;

@Service
public class RefreshTokenService {

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Transactional
    public String createToken(User user, String role) {
        revokeActiveTokensForUser(user.getId());

        String token = jwtUtil.generateRefreshToken(
                user.getEmail(),
                jwtUtil.buildAuthClaims(user.getId(), role)
        );

        RefreshToken refreshToken = RefreshToken.builder()
                .userId(user.getId())
                .token(token)
                .expiresAt(jwtUtil.extractExpiration(token).toInstant())
                .revoked(false)
                .build();
        refreshTokenRepository.save(refreshToken);
        return token;
    }

    public Optional<RefreshToken> validateStoredToken(String token) {
        if (!jwtUtil.isRefreshTokenValid(token)) {
            return Optional.empty();
        }
        return refreshTokenRepository.findByTokenAndRevokedFalseAndExpiresAtAfter(token, Instant.now());
    }

    @Transactional
    public Optional<RefreshRotationResult> rotate(String token, User user) {
        Optional<RefreshToken> existingOpt = validateStoredToken(token);
        if (existingOpt.isEmpty()) {
            return Optional.empty();
        }

        RefreshToken existing = existingOpt.get();
        if (!existing.getUserId().equals(user.getId())) {
            return Optional.empty();
        }

        Claims claims = jwtUtil.extractAllClaims(token);
        String role = claims.get("role", String.class);
        String nextToken = jwtUtil.generateRefreshToken(user.getEmail(), jwtUtil.buildAuthClaims(user.getId(), role));

        existing.setRevoked(true);
        refreshTokenRepository.save(existing);

        RefreshToken replacement = RefreshToken.builder()
                .userId(user.getId())
                .token(nextToken)
                .expiresAt(jwtUtil.extractExpiration(nextToken).toInstant())
                .revoked(false)
                .build();
        refreshTokenRepository.save(replacement);

        return Optional.of(new RefreshRotationResult(nextToken, role));
    }

    @Transactional
    public void revoke(String token) {
        Optional<RefreshToken> existing = refreshTokenRepository.findByTokenAndRevokedFalseAndExpiresAtAfter(token, Instant.now());
        if (existing.isPresent()) {
            RefreshToken refreshToken = existing.get();
            refreshToken.setRevoked(true);
            refreshTokenRepository.save(refreshToken);
        }
    }

    private void revokeActiveTokensForUser(Long userId) {
        List<RefreshToken> activeTokens = refreshTokenRepository.findByUserIdAndRevokedFalse(userId);
        if (activeTokens.isEmpty()) {
            return;
        }
        for (RefreshToken token : activeTokens) {
            token.setRevoked(true);
        }
        refreshTokenRepository.saveAll(activeTokens);
    }

    public record RefreshRotationResult(String refreshToken, String role) {
    }
}
