package com.example.backend.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.backend.entity.Notification;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    List<Notification> findTop100ByUserIdAndChannelOrderByCreatedAtDesc(Long userId, String channel);

    long countByUserIdAndChannelAndReadFalse(Long userId, String channel);

    Optional<Notification> findByIdAndUserId(Long id, Long userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Notification n
            set n.read = true, n.status = :status
            where n.userId = :userId and n.channel = :channel and n.read = false
            """)
    int markAllReadByUserIdAndChannel(
            @Param("userId") Long userId,
            @Param("channel") String channel,
            @Param("status") String status
    );
}
