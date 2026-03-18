package com.example.backend.service;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import com.example.backend.entity.Notification;
import com.example.backend.entity.Ride;
import com.example.backend.entity.User;
import com.example.backend.repository.NotificationRepository;
import com.example.backend.repository.UserRepository;

@Service
public class NotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationService.class);
    private static final String CHANNEL_IN_APP = "IN_APP";

    @Autowired
    private NotificationRepository notificationRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OtpEmailService otpEmailService;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    public void notifyRideEvent(Ride ride) {
        if (ride == null || ride.getStatus() == null) {
            return;
        }

        String eventType = "RIDE_" + ride.getStatus().name();
        String title = buildRideTitle(ride.getStatus());
        String message = buildRideMessage(ride);

        if (ride.getRiderId() != null) {
            createInApp(ride.getRiderId(), ride.getId(), title, message, eventType);
            dispatchOutboundMock(ride.getRiderId(), title, message, eventType, "EMAIL");
            dispatchOutboundMock(ride.getRiderId(), title, message, eventType, "SMS");
        }
        if (ride.getDriverId() != null) {
            createInApp(ride.getDriverId(), ride.getId(), title, message, eventType);
            dispatchOutboundMock(ride.getDriverId(), title, message, eventType, "EMAIL");
            dispatchOutboundMock(ride.getDriverId(), title, message, eventType, "SMS");
        }
    }

    public void sendRideOtpEmails(Ride ride) {
        if (ride == null || ride.getRiderId() == null && ride.getDriverId() == null) {
            return;
        }

        if (ride.getStartOtp() != null && !ride.getStartOtp().isBlank()) {
            sendOtpEmailToUser(ride.getRiderId(), ride.getId(), "Start Pickup", ride.getStartOtp());
            sendOtpEmailToUser(ride.getDriverId(), ride.getId(), "Start Pickup", ride.getStartOtp());
        }

        if (ride.getEndOtp() != null && !ride.getEndOtp().isBlank()) {
            sendOtpEmailToUser(ride.getRiderId(), ride.getId(), "End Drop-off", ride.getEndOtp());
            sendOtpEmailToUser(ride.getDriverId(), ride.getId(), "End Drop-off", ride.getEndOtp());
        }
    }

    public Map<String, Object> getInAppNotificationPayload(Long userId) {
        seedDummyInAppNotificationsIfEmpty(userId);

        List<Notification> items = notificationRepository
                .findTop100ByUserIdAndChannelOrderByCreatedAtDesc(userId, CHANNEL_IN_APP);
        long unreadCount = notificationRepository.countByUserIdAndChannelAndReadFalse(userId, CHANNEL_IN_APP);

        return Map.of(
                "items", items,
                "unreadCount", unreadCount
        );
    }

    public Notification sendTestInAppNotification(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("User id is required.");
        }

        String title = "Live notification test";
        String message = "This notification was pushed through WebSocket in real time.";
        return createInApp(userId, null, title, message, "TEST_WEBSOCKET");
    }

    private void seedDummyInAppNotificationsIfEmpty(Long userId) {
        if (userId == null) {
            return;
        }

        List<Notification> existing = notificationRepository
                .findTop100ByUserIdAndChannelOrderByCreatedAtDesc(userId, CHANNEL_IN_APP);
        if (!existing.isEmpty()) {
            return;
        }

        Instant now = Instant.now();
        List<Notification> demoNotifications = List.of(
                Notification.builder()
                        .userId(userId)
                        .title("Welcome to RideShare Live")
                        .message("Your account is ready. Book your first ride in seconds.")
                        .channel(CHANNEL_IN_APP)
                        .eventType("WELCOME")
                        .read(false)
                        .status("DELIVERED")
                        .createdAt(now.minusSeconds(2_700))
                        .deliveredAt(now.minusSeconds(2_700))
                        .build(),
                Notification.builder()
                        .userId(userId)
                        .title("Promo unlocked")
                        .message("Use code FIRST50 to get 50% off on your next ride.")
                        .channel(CHANNEL_IN_APP)
                        .eventType("PROMO")
                        .read(false)
                        .status("DELIVERED")
                        .createdAt(now.minusSeconds(1_800))
                        .deliveredAt(now.minusSeconds(1_800))
                        .build(),
                Notification.builder()
                        .userId(userId)
                        .title("Safety tip")
                        .message("Verify your driver details before starting the trip.")
                        .channel(CHANNEL_IN_APP)
                        .eventType("SAFETY")
                        .read(true)
                        .status("READ")
                        .createdAt(now.minusSeconds(900))
                        .deliveredAt(now.minusSeconds(900))
                        .build());

        notificationRepository.saveAll(demoNotifications);
    }

    public void markRead(Long notificationId, Long userId) {
        Optional<Notification> target = notificationRepository.findByIdAndUserId(notificationId, userId);
        if (target.isEmpty()) {
            return;
        }
        Notification notification = target.get();
        if (Boolean.TRUE.equals(notification.getRead())) {
            return;
        }
        notification.setRead(true);
        notification.setStatus("READ");
        notificationRepository.save(notification);
        pushUnreadSync(userId);
    }

    public void markAllRead(Long userId) {
        List<Notification> items = notificationRepository
                .findTop100ByUserIdAndChannelOrderByCreatedAtDesc(userId, CHANNEL_IN_APP);
        boolean changed = false;
        for (Notification notification : items) {
            if (!Boolean.TRUE.equals(notification.getRead())) {
                notification.setRead(true);
                notification.setStatus("READ");
                changed = true;
            }
        }
        if (changed) {
            notificationRepository.saveAll(items);
            pushUnreadSync(userId);
        }
    }

    private Notification createInApp(Long userId, Long rideId, String title, String message, String eventType) {
        Notification notification = Notification.builder()
                .userId(userId)
                .rideId(rideId)
                .title(title)
                .message(message)
                .channel(CHANNEL_IN_APP)
                .eventType(eventType)
                .read(false)
                .status("DELIVERED")
                .createdAt(Instant.now())
                .deliveredAt(Instant.now())
                .build();
        notificationRepository.save(notification);
        pushCreatedNotification(notification);
        return notification;
    }

    private void sendOtpEmailToUser(Long userId, Long rideId, String otpPurpose, String otp) {
        if (userId == null) {
            return;
        }

        Optional<User> targetUser = userRepository.findById(userId);
        if (targetUser.isEmpty()) {
            return;
        }

        User user = targetUser.get();
        boolean sent = otpEmailService.sendOtpEmail(user, rideId, otpPurpose, otp);
        String eventType = "RIDE_OTP_" + otpPurpose.replace(" ", "_").toUpperCase(Locale.ROOT);
        String title = otpPurpose + " OTP";
        String message = String.format("OTP for ride #%s: %s", rideId == null ? "N/A" : rideId, otp);
        String status = sent ? "EMAIL_SENT" : "EMAIL_NOT_SENT";

        Notification outboundNotification = Notification.builder()
                .userId(userId)
                .rideId(rideId)
                .title(title)
                .message(message)
                .channel("EMAIL")
                .eventType(eventType)
                .read(true)
                .status(status)
                .createdAt(Instant.now())
                .deliveredAt(sent ? Instant.now() : null)
                .build();
        notificationRepository.save(outboundNotification);
    }

    private void dispatchOutboundMock(Long userId, String title, String message, String eventType, String channel) {
        Optional<User> targetUser = userRepository.findById(userId);
        if (targetUser.isEmpty()) {
            return;
        }

        User user = targetUser.get();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("userId", userId);
        payload.put("email", user.getEmail());
        payload.put("channel", channel);
        payload.put("eventType", eventType);
        payload.put("title", title);
        payload.put("message", message);
        LOGGER.info("Mock notification dispatch: {}", payload);

        Notification outboundNotification = Notification.builder()
                .userId(userId)
                .title(title)
                .message(message)
                .channel(channel.toUpperCase(Locale.ROOT))
                .eventType(eventType)
                .read(true)
                .status("MOCK_SENT")
                .createdAt(Instant.now())
                .deliveredAt(Instant.now())
                .build();
        notificationRepository.save(outboundNotification);
    }

    private static String buildRideTitle(Ride.Status status) {
        return switch (status) {
            case REQUESTED -> "Ride requested";
            case ACCEPTED -> "Driver assigned";
            case PICKED -> "Ride picked up";
            case COMPLETED -> "Ride completed";
            case CANCELLED -> "Ride cancelled";
        };
    }

    private static String buildRideMessage(Ride ride) {
        String pickup = ride.getPickupLocation() == null ? "-" : ride.getPickupLocation();
        String drop = ride.getDropLocation() == null ? "-" : ride.getDropLocation();
        return "Ride " + ride.getStatus().name() + " from " + pickup + " to " + drop + ".";
    }

    private void pushCreatedNotification(Notification notification) {
        if (notification == null || notification.getUserId() == null) {
            return;
        }

        Optional<User> targetUser = userRepository.findById(notification.getUserId());
        if (targetUser.isEmpty()) {
            return;
        }

        long unreadCount = notificationRepository.countByUserIdAndChannelAndReadFalse(
                notification.getUserId(),
                CHANNEL_IN_APP
        );

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION_CREATED");
        payload.put("notification", notification);
        payload.put("unreadCount", unreadCount);

        messagingTemplate.convertAndSendToUser(
                targetUser.get().getEmail(),
                "/queue/notifications",
                payload
        );
    }

    private void pushUnreadSync(Long userId) {
        if (userId == null) {
            return;
        }

        Optional<User> targetUser = userRepository.findById(userId);
        if (targetUser.isEmpty()) {
            return;
        }

        List<Notification> items = notificationRepository
                .findTop100ByUserIdAndChannelOrderByCreatedAtDesc(userId, CHANNEL_IN_APP);
        long unreadCount = notificationRepository.countByUserIdAndChannelAndReadFalse(userId, CHANNEL_IN_APP);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("type", "NOTIFICATION_SYNC");
        payload.put("items", items);
        payload.put("unreadCount", unreadCount);

        messagingTemplate.convertAndSendToUser(
                targetUser.get().getEmail(),
                "/queue/notifications",
                payload
        );
    }
}
