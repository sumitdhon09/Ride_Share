package com.example.backend.entity;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "notifications")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;
    private Long rideId;

    @Column(length = 120, nullable = false)
    private String title;

    @Column(length = 800, nullable = false)
    private String message;

    @Column(length = 20, nullable = false)
    private String channel;

    @Column(length = 40, nullable = false)
    private String eventType;

    @Builder.Default
    @Column(name = "is_read", nullable = false)
    private Boolean read = false;

    @Builder.Default
    @Column(nullable = false)
    private Instant createdAt = Instant.now();

    private Instant deliveredAt;

    @Column(length = 20, nullable = false)
    private String status;
}

