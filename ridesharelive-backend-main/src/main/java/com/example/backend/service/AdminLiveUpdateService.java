package com.example.backend.service;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import com.example.backend.dto.admin.AdminLiveUpdatePayload;
import com.example.backend.entity.AdminComplaint;
import com.example.backend.entity.AdminPricingConfig;
import com.example.backend.entity.AdminZone;
import com.example.backend.entity.Ride;
import com.example.backend.entity.User;
import com.example.backend.repository.AdminComplaintRepository;
import com.example.backend.repository.AdminZoneRepository;
import com.example.backend.repository.RideRepository;
import com.example.backend.repository.UserRepository;

@Service
public class AdminLiveUpdateService {

    private final SimpMessagingTemplate messagingTemplate;
    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final AdminComplaintRepository complaintRepository;
    private final AdminZoneRepository zoneRepository;

    public AdminLiveUpdateService(
            SimpMessagingTemplate messagingTemplate,
            UserRepository userRepository,
            RideRepository rideRepository,
            AdminComplaintRepository complaintRepository,
            AdminZoneRepository zoneRepository
    ) {
        this.messagingTemplate = messagingTemplate;
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.complaintRepository = complaintRepository;
        this.zoneRepository = zoneRepository;
    }

    public void publishOverviewSnapshot() {
        List<User> users = userRepository.findAll();
        List<Ride> rides = rideRepository.findAll();
        List<AdminComplaint> complaints = complaintRepository.findAll();

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        BigDecimal revenueToday = rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .filter(ride -> ride.getCreatedAt() != null)
                .filter(ride -> ride.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate().isEqual(today))
                .map(ride -> BigDecimal.valueOf(ride.getFare() == null ? 0D : ride.getFare()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        long totalUsers = users.stream().filter(user -> !isRole(user, "DRIVER") && !isRole(user, "ADMIN")).count();
        long totalDrivers = users.stream().filter(user -> isRole(user, "DRIVER")).count();
        long activeDrivers = users.stream().filter(user -> isRole(user, "DRIVER") && Boolean.TRUE.equals(user.getOnline())).count();
        long ongoingRides = rides.stream().filter(ride -> ride.getStatus() != Ride.Status.COMPLETED && ride.getStatus() != Ride.Status.CANCELLED).count();
        long pendingComplaints = complaints.stream().filter(complaint -> !isComplaintResolved(complaint)).count();

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("totalUsers", totalUsers);
        payload.put("totalDrivers", totalDrivers);
        payload.put("activeDrivers", activeDrivers);
        payload.put("ongoingRides", ongoingRides);
        payload.put("revenueToday", revenueToday);
        payload.put("pendingComplaints", pendingComplaints);
        payload.put("zoneCount", zoneRepository.count());

        messagingTemplate.convertAndSend(
                "/topic/admin/overview",
                new AdminLiveUpdatePayload("ADMIN_OVERVIEW", payload, Instant.now())
        );
    }

    public void publishRideUpdate(Ride ride) {
        if (ride == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("rideId", ride.getId());
        payload.put("status", ride.getStatus() == null ? "" : ride.getStatus().name());
        payload.put("driverId", ride.getDriverId());
        payload.put("riderId", ride.getRiderId());
        payload.put("paymentStatus", ride.getPaymentStatus());

        messagingTemplate.convertAndSend(
                "/topic/admin/rides",
                new AdminLiveUpdatePayload("RIDE_STATUS", payload, Instant.now())
        );
        publishOverviewSnapshot();
    }

    public void publishDriverUpdate(User driver) {
        if (driver == null) {
            return;
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("driverId", driver.getId());
        payload.put("kycStatus", driver.getKycStatus() == null ? "" : driver.getKycStatus());
        payload.put("online", Boolean.TRUE.equals(driver.getOnline()));
        payload.put("assignedZone", driver.getAssignedZone() == null ? "" : driver.getAssignedZone());

        messagingTemplate.convertAndSend(
                "/topic/admin/drivers",
                new AdminLiveUpdatePayload("DRIVER_STATUS", payload, Instant.now())
        );
        publishOverviewSnapshot();
    }

    public void publishSafetyUpdate(AdminComplaint complaint) {
        if (complaint == null) {
            return;
        }

        messagingTemplate.convertAndSend(
                "/topic/admin/safety",
                new AdminLiveUpdatePayload("SAFETY_ALERT", complaint, Instant.now())
        );
        publishOverviewSnapshot();
    }

    public void publishPricingUpdate(List<AdminPricingConfig> configs) {
        messagingTemplate.convertAndSend(
                "/topic/admin/pricing",
                new AdminLiveUpdatePayload("PRICING_UPDATED", configs, Instant.now())
        );
    }

    public void publishZoneUpdate(List<AdminZone> zones) {
        messagingTemplate.convertAndSend(
                "/topic/admin/zones",
                new AdminLiveUpdatePayload("ZONE_UPDATED", zones, Instant.now())
        );
        publishOverviewSnapshot();
    }

    public void publishPaymentUpdate(Ride ride) {
        if (ride == null) {
            return;
        }
        Map<String, Object> payload = Map.of(
                "rideId", ride.getId(),
                "paymentStatus", ride.getPaymentStatus() == null ? "" : ride.getPaymentStatus(),
                "paymentMode", ride.getPaymentMode() == null ? "" : ride.getPaymentMode()
        );
        messagingTemplate.convertAndSend(
                "/topic/admin/payments",
                new AdminLiveUpdatePayload("PAYMENT_UPDATED", payload, Instant.now())
        );
        publishOverviewSnapshot();
    }

    private static boolean isRole(User user, String role) {
        return user != null
                && user.getRole() != null
                && user.getRole().trim().equalsIgnoreCase(role);
    }

    private static boolean isComplaintResolved(AdminComplaint complaint) {
        if (complaint == null || complaint.getStatus() == null) {
            return false;
        }
        return "RESOLVED".equalsIgnoreCase(complaint.getStatus())
                || "CLOSED".equalsIgnoreCase(complaint.getStatus());
    }
}
