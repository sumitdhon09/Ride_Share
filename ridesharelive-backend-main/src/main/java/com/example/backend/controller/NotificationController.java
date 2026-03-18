package com.example.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.entity.User;
import com.example.backend.service.NotificationService;
import com.example.backend.service.UserService;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    @Autowired
    private UserService userService;

    @GetMapping("/history")
    public ResponseEntity<?> getHistory(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        Map<String, Object> payload = notificationService.getInAppNotificationPayload(user.getId());
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/mark-read/{notificationId}")
    public ResponseEntity<?> markRead(
            @PathVariable Long notificationId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.markRead(notificationId, user.getId());
        return ResponseEntity.ok(Map.of("message", "Notification marked as read."));
    }

    @PostMapping("/mark-all-read")
    public ResponseEntity<?> markAllRead(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.markAllRead(user.getId());
        return ResponseEntity.ok(Map.of("message", "All notifications marked as read."));
    }

    @PostMapping("/test")
    public ResponseEntity<?> sendTestNotification(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        notificationService.sendTestInAppNotification(user.getId());
        return ResponseEntity.ok(Map.of("message", "Test notification queued."));
    }
}
