package com.example.backend.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.RefreshToken;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenAndRevokedFalseAndExpiresAtAfter(String token, Instant now);

    List<RefreshToken> findByUserIdAndRevokedFalse(Long userId);
}
