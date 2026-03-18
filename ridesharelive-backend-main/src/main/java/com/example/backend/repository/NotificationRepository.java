package com.example.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop100ByUserIdAndChannelOrderByCreatedAtDesc(Long userId, String channel);

    long countByUserIdAndChannelAndReadFalse(Long userId, String channel);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);
}

