package com.example.backend.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.backend.dto.admin.AdminActionRequest;
import com.example.backend.dto.admin.AdminAlertsResponse;
import com.example.backend.dto.admin.AdminAnalyticsResponse;
import com.example.backend.dto.admin.AdminComplaintsResponse;
import com.example.backend.dto.admin.AdminDriversResponse;
import com.example.backend.dto.admin.AdminLiveMapResponse;
import com.example.backend.dto.admin.AdminOverviewResponse;
import com.example.backend.dto.admin.AdminPaymentsResponse;
import com.example.backend.dto.admin.AdminPricingResponse;
import com.example.backend.dto.admin.AdminPricingUpdateRequest;
import com.example.backend.dto.admin.AdminRidesResponse;
import com.example.backend.dto.admin.AdminSettingsResponse;
import com.example.backend.dto.admin.AdminSettingsUpdateRequest;
import com.example.backend.dto.admin.AdminUsersResponse;
import com.example.backend.dto.admin.AdminZoneUpdateRequest;
import com.example.backend.dto.admin.AdminZonesResponse;
import com.example.backend.entity.AdminComplaint;
import com.example.backend.entity.AdminPricingConfig;
import com.example.backend.entity.AdminSetting;
import com.example.backend.entity.AdminZone;
import com.example.backend.entity.Ride;
import com.example.backend.entity.User;
import com.example.backend.repository.AdminComplaintRepository;
import com.example.backend.repository.AdminPricingConfigRepository;
import com.example.backend.repository.AdminSettingRepository;
import com.example.backend.repository.AdminZoneRepository;
import com.example.backend.repository.RideRepository;
import com.example.backend.repository.UserRepository;

@Service
@Transactional
public class AdminOpsService {

    private static final DateTimeFormatter HOUR_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");
    private static final Set<String> RESOLVED_COMPLAINT_STATUSES = Set.of("RESOLVED", "CLOSED");

    private final UserRepository userRepository;
    private final RideRepository rideRepository;
    private final AdminPricingConfigRepository pricingRepository;
    private final AdminComplaintRepository complaintRepository;
    private final AdminSettingRepository settingRepository;
    private final AdminZoneRepository zoneRepository;
    private final AdminLiveUpdateService adminLiveUpdateService;

    public AdminOpsService(
            UserRepository userRepository,
            RideRepository rideRepository,
            AdminPricingConfigRepository pricingRepository,
            AdminComplaintRepository complaintRepository,
            AdminSettingRepository settingRepository,
            AdminZoneRepository zoneRepository,
            AdminLiveUpdateService adminLiveUpdateService
    ) {
        this.userRepository = userRepository;
        this.rideRepository = rideRepository;
        this.pricingRepository = pricingRepository;
        this.complaintRepository = complaintRepository;
        this.settingRepository = settingRepository;
        this.zoneRepository = zoneRepository;
        this.adminLiveUpdateService = adminLiveUpdateService;
    }

    @Transactional(readOnly = true)
    public AdminOverviewResponse getOverview() {
        ensureAdminSeedData();

        List<User> users = userRepository.findAll();
        List<Ride> rides = rideRepository.findAll();
        List<AdminComplaint> complaints = complaintRepository.findAll();
        List<AdminZone> zones = zoneRepository.findAll();

        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        long totalUsers = users.stream().filter(user -> !isRole(user, "DRIVER") && !isRole(user, "ADMIN")).count();
        long totalDrivers = users.stream().filter(user -> isRole(user, "DRIVER")).count();
        long activeDrivers = users.stream().filter(user -> isRole(user, "DRIVER") && Boolean.TRUE.equals(user.getOnline())).count();
        long ongoingRides = rides.stream().filter(ride -> !isClosedRide(ride)).count();
        long completedToday = rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .filter(ride -> isOnDate(ride.getCreatedAt(), today))
                .count();
        BigDecimal revenueToday = rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .filter(ride -> isOnDate(ride.getCreatedAt(), today))
                .map(this::rideAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        double cancelledPercentage = rides.isEmpty()
                ? 0D
                : roundTwoDecimals(rides.stream().filter(ride -> ride.getStatus() == Ride.Status.CANCELLED).count() * 100D / rides.size());
        long pendingComplaints = complaints.stream().filter(complaint -> !isComplaintResolved(complaint)).count();

        AdminOverviewResponse.OverviewKpis kpis = new AdminOverviewResponse.OverviewKpis(
                totalUsers,
                totalDrivers,
                activeDrivers,
                ongoingRides,
                completedToday,
                revenueToday,
                cancelledPercentage,
                pendingComplaints
        );

        return new AdminOverviewResponse(
                kpis,
                buildRidesPerHour(rides),
                buildRevenueTrend(rides),
                buildDriverActivityTrend(rides),
                buildRideCompletionTrend(rides),
                buildZoneHeatmap(zones),
                buildLiveAlerts(complaints, rides),
                Instant.now()
        );
    }

    @Transactional(readOnly = true)
    public AdminUsersResponse getUsers(String search, String city, String state) {
        ensureAdminSeedData();
        String normalizedSearch = normalize(search);
        String normalizedCity = normalize(city);
        String normalizedState = normalize(state);

        List<Ride> rides = rideRepository.findAll();
        List<AdminComplaint> complaints = complaintRepository.findAll();

        List<AdminUsersResponse.UserRow> items = userRepository.findAll().stream()
                .filter(user -> !isRole(user, "DRIVER") && !isRole(user, "ADMIN"))
                .filter(user -> matchesUser(user, normalizedSearch, normalizedCity, normalizedState))
                .map(user -> mapUserRow(user, rides, complaints))
                .sorted(Comparator.comparing(AdminUsersResponse.UserRow::lastActive, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return new AdminUsersResponse(items, items.size());
    }

    public AdminUsersResponse.UserRow handleUserAction(Long userId, AdminActionRequest request) {
        ensureAdminSeedData();
        User user = userRepository.findById(userId).orElseThrow();
        String action = normalize(request == null ? null : request.action());

        switch (action) {
            case "SUSPEND", "BLOCK" -> {
                user.setBlocked(true);
                user.setActive(false);
            }
            case "ACTIVATE", "UNBLOCK", "VIEW" -> {
                user.setBlocked(false);
                user.setActive(true);
            }
            case "REFUND" -> user.setWalletBalance(safeMoney(user.getWalletBalance()).add(BigDecimal.valueOf(150)));
            case "DELETE" -> {
                AdminUsersResponse.UserRow row = mapUserRow(user, rideRepository.findAll(), complaintRepository.findAll());
                userRepository.delete(user);
                adminLiveUpdateService.publishOverviewSnapshot();
                return row;
            }
            default -> {
            }
        }

        user.setLastActiveAt(Instant.now());
        User saved = userRepository.save(user);
        adminLiveUpdateService.publishOverviewSnapshot();
        return mapUserRow(saved, rideRepository.findAll(), complaintRepository.findAll());
    }

    @Transactional(readOnly = true)
    public AdminRidesResponse getUserTrips(Long userId) {
        List<AdminRidesResponse.RideRow> items = mapRideRows(rideRepository.findAll().stream()
                .filter(ride -> userId.equals(ride.getRiderId()))
                .toList());
        return new AdminRidesResponse(items, items.size());
    }

    @Transactional(readOnly = true)
    public AdminDriversResponse getDrivers(String search, String status, String zone) {
        ensureAdminSeedData();
        String normalizedSearch = normalize(search);
        String normalizedStatus = normalize(status);
        String normalizedZone = normalize(zone);
        List<Ride> rides = rideRepository.findAll();

        List<AdminDriversResponse.DriverRow> items = userRepository.findAll().stream()
                .filter(user -> isRole(user, "DRIVER"))
                .filter(user -> matchesDriver(user, normalizedSearch, normalizedStatus, normalizedZone))
                .map(user -> mapDriverRow(user, rides))
                .sorted(Comparator.comparing(AdminDriversResponse.DriverRow::lastActive, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList();

        return new AdminDriversResponse(items, items.size());
    }

    public AdminDriversResponse.DriverRow handleDriverAction(Long driverId, AdminActionRequest request) {
        ensureAdminSeedData();
        User driver = userRepository.findById(driverId).orElseThrow();
        if (!isRole(driver, "DRIVER")) {
            throw new IllegalArgumentException("User is not a driver.");
        }

        String action = normalize(request == null ? null : request.action());
        switch (action) {
            case "APPROVE" -> {
                driver.setKycStatus("APPROVED");
                driver.setBlocked(false);
                driver.setActive(true);
            }
            case "REJECT" -> driver.setKycStatus("REJECTED");
            case "SUSPEND" -> {
                driver.setBlocked(true);
                driver.setActive(false);
                driver.setOnline(false);
            }
            case "ASSIGN_ZONE" -> driver.setAssignedZone(request == null ? null : request.zoneName());
            case "VIEW_ROUTE" -> driver.setLastActiveAt(Instant.now());
            default -> {
            }
        }

        driver.setLastActiveAt(Instant.now());
        User saved = userRepository.save(driver);
        adminLiveUpdateService.publishDriverUpdate(saved);
        adminLiveUpdateService.publishZoneUpdate(zoneRepository.findAll());
        return mapDriverRow(saved, rideRepository.findAll());
    }

    @Transactional(readOnly = true)
    public AdminRidesResponse getRides(String status, String paymentMode, String search) {
        ensureAdminSeedData();
        String normalizedStatus = normalize(status);
        String normalizedPaymentMode = normalize(paymentMode);
        String normalizedSearch = normalize(search);

        List<AdminRidesResponse.RideRow> items = mapRideRows(rideRepository.findAll().stream()
                .filter(ride -> normalizedStatus.isBlank() || ride.getStatus().name().equalsIgnoreCase(normalizedStatus))
                .filter(ride -> normalizedPaymentMode.isBlank() || safe(ride.getPaymentMode()).equalsIgnoreCase(normalizedPaymentMode))
                .filter(ride -> normalizedSearch.isBlank() || matchesRideSearch(ride, normalizedSearch))
                .sorted(Comparator.comparing(Ride::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .toList());

        return new AdminRidesResponse(items, items.size());
    }

    public AdminRidesResponse.RideRow handleRideAction(Long rideId, AdminActionRequest request) {
        ensureAdminSeedData();
        Ride ride = rideRepository.findById(rideId).orElseThrow();
        String action = normalize(request == null ? null : request.action());

        switch (action) {
            case "FORCE_ASSIGN_DRIVER" -> {
                if (request == null || request.driverId() == null) {
                    throw new IllegalArgumentException("driverId is required.");
                }
                ride.setDriverId(request.driverId());
                ride.setStatus(Ride.Status.ACCEPTED);
                if (ride.getAcceptedAt() == null) {
                    ride.setAcceptedAt(Instant.now());
                }
            }
            case "CANCEL_RIDE" -> {
                ride.setStatus(Ride.Status.CANCELLED);
                ride.setCancellationReason(request == null || request.note() == null ? "Cancelled by admin." : request.note());
                ride.setCancelledBy("ADMIN");
            }
            case "MANUAL_COMPLETE" -> {
                ride.setStatus(Ride.Status.COMPLETED);
                if (ride.getPaymentStatus() == null || ride.getPaymentStatus().isBlank()) {
                    ride.setPaymentStatus("COMPLETED");
                }
            }
            case "REFUND" -> {
                ride.setPaymentStatus("REFUNDED");
                creditRideRefundToRider(ride);
            }
            case "TRACK_LIVE" -> {
            }
            default -> {
            }
        }

        Ride saved = rideRepository.save(ride);
        adminLiveUpdateService.publishRideUpdate(saved);
        if ("REFUND".equals(action)) {
            adminLiveUpdateService.publishPaymentUpdate(saved);
        }
        return mapRideRows(List.of(saved)).get(0);
    }

    @Transactional(readOnly = true)
    public AdminPricingResponse getPricing() {
        ensureAdminSeedData();
        List<AdminPricingResponse.PricingRow> items = pricingRepository.findAll().stream()
                .sorted(Comparator.comparing(AdminPricingConfig::getRideType))
                .map(this::mapPricingRow)
                .toList();
        Instant updatedAt = items.stream()
                .map(AdminPricingResponse.PricingRow::updatedAt)
                .filter(value -> value != null)
                .max(Comparator.naturalOrder())
                .orElse(Instant.now());
        return new AdminPricingResponse(items, updatedAt);
    }

    public AdminPricingResponse updatePricing(AdminPricingUpdateRequest request) {
        ensureAdminSeedData();
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Pricing payload is required.");
        }

        for (AdminPricingUpdateRequest.PricingInput input : request.items()) {
            if (input == null || input.rideType() == null || input.rideType().isBlank()) {
                continue;
            }
            AdminPricingConfig config = pricingRepository.findByRideTypeIgnoreCase(input.rideType())
                    .orElseGet(() -> AdminPricingConfig.builder().rideType(input.rideType().trim().toUpperCase(Locale.ROOT)).build());
            config.setBaseFare(requireMoney(input.baseFare(), config.getBaseFare()));
            config.setPerKmRate(requireMoney(input.perKmRate(), config.getPerKmRate()));
            config.setPerMinuteRate(requireMoney(input.perMinuteRate(), config.getPerMinuteRate()));
            config.setRuralMultiplier(requireMoney(input.ruralMultiplier(), config.getRuralMultiplier()));
            config.setCityTierMultiplier(requireMoney(input.cityTierMultiplier(), config.getCityTierMultiplier()));
            config.setNightChargeMultiplier(requireMoney(input.nightChargeMultiplier(), config.getNightChargeMultiplier()));
            config.setPeakMultiplier(requireMoney(input.peakMultiplier(), config.getPeakMultiplier()));
            config.setMaxSurgeMultiplier(requireMoney(input.maxSurgeMultiplier(), config.getMaxSurgeMultiplier()));
            config.setTollFee(requireMoney(input.tollFee(), config.getTollFee()));
            config.setBookingFee(requireMoney(input.bookingFee(), config.getBookingFee()));
            pricingRepository.save(config);
        }

        List<AdminPricingConfig> configs = pricingRepository.findAll();
        adminLiveUpdateService.publishPricingUpdate(configs);
        return getPricing();
    }

    @Transactional(readOnly = true)
    public AdminComplaintsResponse getComplaints(String status, String severity, String search) {
        ensureAdminSeedData();
        String normalizedStatus = normalize(status);
        String normalizedSeverity = normalize(severity);
        String normalizedSearch = normalize(search);

        List<AdminComplaintsResponse.ComplaintRow> items = complaintRepository.findAll().stream()
                .filter(complaint -> normalizedStatus.isBlank() || safe(complaint.getStatus()).equalsIgnoreCase(normalizedStatus))
                .filter(complaint -> normalizedSeverity.isBlank() || safe(complaint.getSeverity()).equalsIgnoreCase(normalizedSeverity))
                .filter(complaint -> normalizedSearch.isBlank() || matchesComplaintSearch(complaint, normalizedSearch))
                .sorted(Comparator.comparing(AdminComplaint::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapComplaintRow)
                .toList();
        return new AdminComplaintsResponse(items, items.size());
    }

    public AdminComplaintsResponse.ComplaintRow handleComplaintAction(Long complaintId, AdminActionRequest request) {
        ensureAdminSeedData();
        AdminComplaint complaint = complaintRepository.findById(complaintId).orElseThrow();
        String action = normalize(request == null ? null : request.action());
        switch (action) {
            case "RESOLVE" -> complaint.setStatus("RESOLVED");
            case "ESCALATE" -> complaint.setStatus("ESCALATED");
            case "BLOCK_USER" -> updateUserBlockState(complaint.getUserId(), true);
            case "SUSPEND_DRIVER" -> updateUserBlockState(complaint.getDriverId(), true);
            case "REFUND_RIDER" -> {
                complaint.setResolutionCode("REFUNDED");
                Optional.ofNullable(complaint.getRideId()).ifPresent(this::refundRideById);
            }
            case "ASSIGN_SUPPORT_TICKET" -> complaint.setAssignedTo(request == null ? "support" : safe(request.note()));
            default -> {
            }
        }
        AdminComplaint saved = complaintRepository.save(complaint);
        adminLiveUpdateService.publishSafetyUpdate(saved);
        return mapComplaintRow(saved);
    }

    @Transactional(readOnly = true)
    public AdminPaymentsResponse getPayments(String status, String mode) {
        ensureAdminSeedData();
        String normalizedStatus = normalize(status);
        String normalizedMode = normalize(mode);
        List<AdminPaymentsResponse.PaymentRow> items = rideRepository.findAll().stream()
                .filter(ride -> ride.getPaymentMode() != null && !ride.getPaymentMode().isBlank())
                .filter(ride -> normalizedStatus.isBlank() || safe(ride.getPaymentStatus()).equalsIgnoreCase(normalizedStatus))
                .filter(ride -> normalizedMode.isBlank() || safe(ride.getPaymentMode()).equalsIgnoreCase(normalizedMode))
                .sorted(Comparator.comparing(Ride::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::mapPaymentRow)
                .toList();
        return new AdminPaymentsResponse(items, items.size());
    }

    public AdminPaymentsResponse.PaymentRow handlePaymentAction(Long rideId, AdminActionRequest request) {
        ensureAdminSeedData();
        Ride ride = rideRepository.findById(rideId).orElseThrow();
        String action = normalize(request == null ? null : request.action());
        switch (action) {
            case "MANUAL_REFUND" -> {
                ride.setPaymentStatus("REFUNDED");
                creditRideRefundToRider(ride);
            }
            case "RETRY_FAILED" -> ride.setPaymentStatus("RETRY_PENDING");
            case "APPROVE_PAYOUT" -> ride.setPaymentStatus("PAYOUT_APPROVED");
            case "SETTLEMENT_LOG" -> ride.setPaymentStatus("SETTLED");
            default -> {
            }
        }
        Ride saved = rideRepository.save(ride);
        adminLiveUpdateService.publishPaymentUpdate(saved);
        return mapPaymentRow(saved);
    }

    @Transactional(readOnly = true)
    public AdminZonesResponse getZones() {
        ensureAdminSeedData();
        List<AdminZonesResponse.ZoneRow> items = zoneRepository.findAll().stream()
                .sorted(Comparator.comparing(AdminZone::getName))
                .map(this::mapZoneRow)
                .toList();
        return new AdminZonesResponse(items, items.size());
    }

    public AdminZonesResponse.ZoneRow updateZone(Long zoneId, AdminZoneUpdateRequest request) {
        ensureAdminSeedData();
        AdminZone zone = zoneRepository.findById(zoneId).orElseThrow();
        if (request == null) {
            throw new IllegalArgumentException("Zone payload is required.");
        }
        if (request.demandLevel() != null) {
            zone.setDemandLevel(request.demandLevel());
        }
        if (request.serviceable() != null) {
            zone.setServiceable(request.serviceable());
        }
        if (request.ruralRouteSupport() != null) {
            zone.setRuralRouteSupport(request.ruralRouteSupport());
        }
        if (request.activeDrivers() != null) {
            zone.setActiveDrivers(Math.max(0, request.activeDrivers()));
        }
        if (request.ongoingRides() != null) {
            zone.setOngoingRides(Math.max(0, request.ongoingRides()));
        }
        if (request.blockedRoads() != null) {
            zone.setBlockedRoads(request.blockedRoads());
        }
        if (request.boundaryLabel() != null) {
            zone.setBoundaryLabel(request.boundaryLabel());
        }
        AdminZone saved = zoneRepository.save(zone);
        adminLiveUpdateService.publishZoneUpdate(zoneRepository.findAll());
        return mapZoneRow(saved);
    }

    @Transactional(readOnly = true)
    public AdminAlertsResponse getAlerts() {
        AdminOverviewResponse overview = getOverview();
        List<AdminAlertsResponse.AlertRow> items = overview.liveAlerts().stream()
                .map(alert -> new AdminAlertsResponse.AlertRow(
                        alert.id(),
                        alert.type(),
                        alert.severity(),
                        alert.title(),
                        alert.subtitle(),
                        "OPEN",
                        alert.createdAt()
                ))
                .toList();
        return new AdminAlertsResponse(items, items.size());
    }

    public AdminAlertsResponse.AlertRow acknowledgeAlert(String alertId, String resolution) {
        ensureAdminSeedData();
        if (alertId == null || alertId.isBlank()) {
            throw new IllegalArgumentException("alertId is required.");
        }
        String normalizedResolution = resolution == null || resolution.isBlank() ? "ACKNOWLEDGED" : resolution.trim().toUpperCase(Locale.ROOT);
        if (alertId.startsWith("complaint-")) {
            Long complaintId = Long.valueOf(alertId.substring("complaint-".length()));
            AdminComplaint complaint = complaintRepository.findById(complaintId).orElseThrow();
            complaint.setStatus(normalizedResolution);
            AdminComplaint saved = complaintRepository.save(complaint);
            adminLiveUpdateService.publishSafetyUpdate(saved);
            return new AdminAlertsResponse.AlertRow(alertId, saved.getCategory(), saved.getSeverity(), saved.getSubject(), safe(saved.getCity()), saved.getStatus(), saved.getUpdatedAt());
        }
        return new AdminAlertsResponse.AlertRow(alertId, "RIDE_REQUEST", "MEDIUM", "Ride alert acknowledged", "Tracked by admin", normalizedResolution, Instant.now());
    }

    @Transactional(readOnly = true)
    public AdminAnalyticsResponse getAnalytics() {
        AdminOverviewResponse overview = getOverview();
        List<Ride> rides = rideRepository.findAll();
        List<AdminOverviewResponse.TrendPoint> cancellations = buildDailyPoints(7, day -> {
            long total = rides.stream().filter(ride -> isOnDate(ride.getCreatedAt(), day)).count();
            if (total == 0) {
                return 0D;
            }
            long cancelled = rides.stream().filter(ride -> isOnDate(ride.getCreatedAt(), day)).filter(ride -> ride.getStatus() == Ride.Status.CANCELLED).count();
            return roundTwoDecimals(cancelled * 100D / total);
        });
        return new AdminAnalyticsResponse(
                overview.ridesPerHour(),
                overview.revenueTrend(),
                overview.zoneDemandHeatmap(),
                cancellations,
                overview.driverActivityTrend()
        );
    }

    @Transactional(readOnly = true)
    public AdminLiveMapResponse getLiveMap() {
        ensureAdminSeedData();
        List<User> drivers = userRepository.findAll().stream()
                .filter(user -> isRole(user, "DRIVER"))
                .filter(user -> user.getLatitude() != null && user.getLongitude() != null)
                .toList();
        List<Ride> rides = rideRepository.findAll().stream()
                .filter(ride -> !isClosedRide(ride))
                .toList();
        List<AdminLiveMapResponse.DriverMarker> driverMarkers = drivers.stream()
                .map(driver -> new AdminLiveMapResponse.DriverMarker(
                        driver.getId(),
                        driver.getName(),
                        driver.getLatitude(),
                        driver.getLongitude(),
                        Boolean.TRUE.equals(driver.getOnline()),
                        safe(driver.getAssignedZone())
                ))
                .toList();
        List<AdminLiveMapResponse.RideMarker> rideMarkers = rides.stream()
                .map(ride -> new AdminLiveMapResponse.RideMarker(
                        ride.getId(),
                        ride.getStatus() == null ? "" : ride.getStatus().name(),
                        safe(ride.getPickupLocation()),
                        safe(ride.getDropLocation()),
                        ride.getDriverLat(),
                        ride.getDriverLon()
                ))
                .toList();
        List<AdminLiveMapResponse.ZoneMarker> zoneMarkers = zoneRepository.findAll().stream()
                .map(zone -> new AdminLiveMapResponse.ZoneMarker(zone.getId(), zone.getName(), zone.getCity(), zone.getDemandLevel(), zone.getActiveDrivers(), zone.getOngoingRides()))
                .toList();
        List<AdminLiveMapResponse.SosMarker> sosMarkers = complaintRepository.findAll().stream()
                .filter(complaint -> "SOS".equalsIgnoreCase(safe(complaint.getCategory())))
                .filter(complaint -> !isComplaintResolved(complaint))
                .map(complaint -> new AdminLiveMapResponse.SosMarker("complaint-" + complaint.getId(), complaint.getSubject(), complaint.getSeverity(), complaint.getCity(), complaint.getCreatedAt()))
                .toList();
        return new AdminLiveMapResponse(driverMarkers, rideMarkers, zoneMarkers, sosMarkers, Instant.now());
    }

    @Transactional(readOnly = true)
    public AdminSettingsResponse getSettings() {
        ensureAdminSeedData();
        List<AdminSettingsResponse.SettingRow> items = settingRepository.findAll().stream()
                .sorted(Comparator.comparing(AdminSetting::getSettingKey))
                .map(setting -> new AdminSettingsResponse.SettingRow(setting.getId(), setting.getSettingKey(), safe(setting.getSettingValue()), safe(setting.getCategory()), setting.getUpdatedAt()))
                .toList();
        Instant updatedAt = items.stream().map(AdminSettingsResponse.SettingRow::updatedAt).filter(value -> value != null).max(Comparator.naturalOrder()).orElse(Instant.now());
        return new AdminSettingsResponse(items, updatedAt);
    }

    public AdminSettingsResponse updateSettings(AdminSettingsUpdateRequest request) {
        ensureAdminSeedData();
        if (request == null || request.items() == null || request.items().isEmpty()) {
            throw new IllegalArgumentException("Settings payload is required.");
        }
        for (AdminSettingsUpdateRequest.SettingInput input : request.items()) {
            if (input == null || input.key() == null || input.key().isBlank()) {
                continue;
            }
            AdminSetting setting = settingRepository.findBySettingKeyIgnoreCase(input.key())
                    .orElseGet(() -> AdminSetting.builder().settingKey(input.key().trim()).build());
            setting.setSettingValue(input.value());
            setting.setCategory(input.category());
            settingRepository.save(setting);
        }
        adminLiveUpdateService.publishOverviewSnapshot();
        return getSettings();
    }

    private void ensureAdminSeedData() {
        seedDemoUsers();
        seedDemoRides();

        if (pricingRepository.count() == 0) {
            pricingRepository.saveAll(List.of(
                    buildPricing("BIKE", 25, 3.5, 0.8),
                    buildPricing("AUTO", 35, 5.0, 1.2),
                    buildPricing("MINI", 50, 6.5, 1.5),
                    buildPricing("SEDAN", 70, 8.5, 2.0),
                    buildPricing("SUV", 90, 10.5, 2.4)
            ));
        }

        if (zoneRepository.count() == 0) {
            zoneRepository.saveAll(List.of(
                    AdminZone.builder().name("Central Core").city("Pune").demandLevel("HIGH").activeDrivers(18).ongoingRides(11).blockedRoads("MG Road lane repair").boundaryLabel("Zone A").build(),
                    AdminZone.builder().name("Airport Belt").city("Pune").demandLevel("MEDIUM").activeDrivers(9).ongoingRides(5).blockedRoads("Airport approach diversion").boundaryLabel("Zone B").build(),
                    AdminZone.builder().name("Rural Edge").city("Pune").demandLevel("SURGE").activeDrivers(4).ongoingRides(3).blockedRoads("Bridge access limited").boundaryLabel("Zone C").build()
            ));
        }

        if (complaintRepository.count() == 0) {
            List<User> users = userRepository.findAll();
            Long riderId = users.stream().filter(user -> isRole(user, "RIDER") || isRole(user, "USER")).map(User::getId).findFirst().orElse(null);
            Long driverId = users.stream().filter(user -> isRole(user, "DRIVER")).map(User::getId).findFirst().orElse(null);
            Long rideId = rideRepository.findAll().stream().map(Ride::getId).findFirst().orElse(null);
            complaintRepository.saveAll(List.of(
                    AdminComplaint.builder().userId(riderId).driverId(driverId).rideId(rideId).category("SOS").severity("CRITICAL").status("OPEN").city("Pune").subject("Emergency alert in ongoing trip").description("Rider tapped SOS during late-night trip.").assignedTo("ops-1").build(),
                    AdminComplaint.builder().userId(riderId).driverId(driverId).rideId(rideId).category("FARE_DISPUTE").severity("MEDIUM").status("ESCALATED").city("Pune").subject("Fare mismatch after route change").description("Rider reported higher fare than estimate.").assignedTo("support-3").build()
            ));
        }

        if (settingRepository.count() == 0) {
            settingRepository.saveAll(List.of(
                    AdminSetting.builder().settingKey("pricing.surgeCap").settingValue("2.2").category("pricing").build(),
                    AdminSetting.builder().settingKey("pricing.nightCharge").settingValue("1.25").category("pricing").build(),
                    AdminSetting.builder().settingKey("routing.ruralRate").settingValue("1.15").category("routing").build(),
                    AdminSetting.builder().settingKey("mail.smtpHost").settingValue("smtp.resend.com").category("mail").build(),
                    AdminSetting.builder().settingKey("maintenance.enabled").settingValue("false").category("ops").build()
            ));
        }
    }

    private void seedDemoUsers() {
        List<User> existingUsers = userRepository.findAll();
        long riderCount = existingUsers.stream().filter(user -> isRole(user, "RIDER") || isRole(user, "USER")).count();
        long driverCount = existingUsers.stream().filter(user -> isRole(user, "DRIVER")).count();
        boolean hasAdmin = existingUsers.stream().anyMatch(user -> isRole(user, "ADMIN"));

        List<User> seedUsers = new ArrayList<>();
        if (riderCount == 0) {
            seedUsers.add(User.builder()
                    .name("Aarav Sharma")
                    .email("aarav.rider@rideshare.demo")
                    .password("demo")
                    .role("RIDER")
                    .city("Pune")
                    .active(true)
                    .blocked(false)
                    .walletBalance(BigDecimal.valueOf(540))
                    .lastActiveAt(Instant.now().minusSeconds(1_200))
                    .build());
            seedUsers.add(User.builder()
                    .name("Meera Joshi")
                    .email("meera.rider@rideshare.demo")
                    .password("demo")
                    .role("RIDER")
                    .city("Mumbai")
                    .active(true)
                    .blocked(false)
                    .walletBalance(BigDecimal.valueOf(120))
                    .lastActiveAt(Instant.now().minusSeconds(2_400))
                    .build());
            seedUsers.add(User.builder()
                    .name("Rohan Patil")
                    .email("rohan.rider@rideshare.demo")
                    .password("demo")
                    .role("USER")
                    .city("Nagpur")
                    .active(true)
                    .blocked(false)
                    .walletBalance(BigDecimal.valueOf(310))
                    .lastActiveAt(Instant.now().minusSeconds(3_600))
                    .build());
        }

        if (driverCount == 0) {
            seedUsers.add(User.builder()
                    .name("Priya Nair")
                    .email("priya.driver@rideshare.demo")
                    .password("demo")
                    .role("DRIVER")
                    .city("Pune")
                    .active(true)
                    .blocked(false)
                    .online(true)
                    .kycStatus("PENDING")
                    .vehicleLabel("Sedan • MH12AB1024")
                    .assignedZone("Central Core")
                    .latitude(18.5204)
                    .longitude(73.8567)
                    .ratingAverage(BigDecimal.valueOf(4.82))
                    .lastActiveAt(Instant.now().minusSeconds(600))
                    .build());
            seedUsers.add(User.builder()
                    .name("Kabir Khan")
                    .email("kabir.driver@rideshare.demo")
                    .password("demo")
                    .role("DRIVER")
                    .city("Mumbai")
                    .active(true)
                    .blocked(false)
                    .online(true)
                    .kycStatus("APPROVED")
                    .vehicleLabel("SUV • MH01XY7788")
                    .assignedZone("Airport Belt")
                    .latitude(19.0760)
                    .longitude(72.8777)
                    .ratingAverage(BigDecimal.valueOf(4.67))
                    .lastActiveAt(Instant.now().minusSeconds(900))
                    .build());
            seedUsers.add(User.builder()
                    .name("Sana Shaikh")
                    .email("sana.driver@rideshare.demo")
                    .password("demo")
                    .role("DRIVER")
                    .city("Nagpur")
                    .active(true)
                    .blocked(false)
                    .online(false)
                    .kycStatus("REJECTED")
                    .vehicleLabel("Auto • MH31AA4411")
                    .assignedZone("Rural Edge")
                    .latitude(21.1458)
                    .longitude(79.0882)
                    .ratingAverage(BigDecimal.valueOf(4.41))
                    .lastActiveAt(Instant.now().minusSeconds(7_200))
                    .build());
        }

        if (!hasAdmin) {
            seedUsers.add(User.builder()
                    .name("Ops Admin")
                    .email("ops.admin@rideshare.demo")
                    .password("demo")
                    .role("ADMIN")
                    .city("Pune")
                    .active(true)
                    .blocked(false)
                    .lastActiveAt(Instant.now().minusSeconds(300))
                    .build());
        }

        if (!seedUsers.isEmpty()) {
            userRepository.saveAll(seedUsers);
        }
    }

    private void seedDemoRides() {
        if (rideRepository.count() > 0) {
            return;
        }

        List<User> riders = userRepository.findAll().stream()
                .filter(user -> isRole(user, "RIDER") || isRole(user, "USER"))
                .toList();
        List<User> drivers = userRepository.findAll().stream()
                .filter(user -> isRole(user, "DRIVER"))
                .toList();
        if (riders.isEmpty() || drivers.isEmpty()) {
            return;
        }

        User riderOne = riders.get(0);
        User riderTwo = riders.size() > 1 ? riders.get(1) : riders.get(0);
        User driverOne = drivers.get(0);
        User driverTwo = drivers.size() > 1 ? drivers.get(1) : drivers.get(0);

        rideRepository.saveAll(List.of(
                Ride.builder()
                        .pickupLocation("Kharadi, Pune")
                        .dropLocation("Viman Nagar, Pune")
                        .pickupLat(18.5512)
                        .pickupLon(73.9381)
                        .dropLat(18.5679)
                        .dropLon(73.9143)
                        .fare(248.0)
                        .driverId(driverOne.getId())
                        .riderId(riderOne.getId())
                        .paymentMode("CARD")
                        .paymentReference("pay_demo_1001")
                        .paymentStatus("PAID")
                        .status(Ride.Status.ACCEPTED)
                        .acceptedAt(Instant.now().minusSeconds(900))
                        .createdAt(Instant.now().minusSeconds(1_500))
                        .driverLat(driverOne.getLatitude())
                        .driverLon(driverOne.getLongitude())
                        .driverLocationUpdatedAt(Instant.now().minusSeconds(120))
                        .startOtp("4567")
                        .endOtp("8921")
                        .build(),
                Ride.builder()
                        .pickupLocation("Baner, Pune")
                        .dropLocation("Hinjewadi Phase 1")
                        .pickupLat(18.5590)
                        .pickupLon(73.7868)
                        .dropLat(18.5912)
                        .dropLon(73.7389)
                        .fare(312.0)
                        .driverId(driverTwo.getId())
                        .riderId(riderTwo.getId())
                        .paymentMode("UPI")
                        .paymentReference("pay_demo_1002")
                        .paymentStatus("PAID")
                        .status(Ride.Status.PICKED)
                        .acceptedAt(Instant.now().minusSeconds(2_700))
                        .createdAt(Instant.now().minusSeconds(3_000))
                        .driverLat(driverTwo.getLatitude())
                        .driverLon(driverTwo.getLongitude())
                        .driverLocationUpdatedAt(Instant.now().minusSeconds(90))
                        .startOtp("1945")
                        .endOtp("3321")
                        .build(),
                Ride.builder()
                        .pickupLocation("Andheri East")
                        .dropLocation("BKC")
                        .pickupLat(19.1136)
                        .pickupLon(72.8697)
                        .dropLat(19.0596)
                        .dropLon(72.8656)
                        .fare(186.0)
                        .driverId(driverOne.getId())
                        .riderId(riderTwo.getId())
                        .paymentMode("CASH")
                        .paymentReference("CASH")
                        .paymentStatus("PAY_AT_END")
                        .status(Ride.Status.REQUESTED)
                        .createdAt(Instant.now().minusSeconds(420))
                        .build(),
                Ride.builder()
                        .pickupLocation("Civil Lines, Nagpur")
                        .dropLocation("Airport, Nagpur")
                        .pickupLat(21.1537)
                        .pickupLon(79.0831)
                        .dropLat(21.0922)
                        .dropLon(79.0472)
                        .fare(420.0)
                        .driverId(driverTwo.getId())
                        .riderId(riderOne.getId())
                        .paymentMode("CARD")
                        .paymentReference("pay_demo_1003")
                        .paymentStatus("COMPLETED")
                        .status(Ride.Status.COMPLETED)
                        .acceptedAt(Instant.now().minusSeconds(9_000))
                        .createdAt(Instant.now().minusSeconds(10_200))
                        .driverLat(driverTwo.getLatitude())
                        .driverLon(driverTwo.getLongitude())
                        .driverLocationUpdatedAt(Instant.now().minusSeconds(8_700))
                        .riderRating(5)
                        .driverRating(5)
                        .build(),
                Ride.builder()
                        .pickupLocation("Aundh, Pune")
                        .dropLocation("Shivaji Nagar")
                        .pickupLat(18.5600)
                        .pickupLon(73.8070)
                        .dropLat(18.5308)
                        .dropLon(73.8475)
                        .fare(95.0)
                        .driverId(driverOne.getId())
                        .riderId(riderTwo.getId())
                        .paymentMode("WALLET")
                        .paymentReference("pay_demo_1004")
                        .paymentStatus("FAILED")
                        .status(Ride.Status.CANCELLED)
                        .cancelledBy("DRIVER")
                        .cancellationReason("Vehicle issue")
                        .createdAt(Instant.now().minusSeconds(6_000))
                        .acceptedAt(Instant.now().minusSeconds(5_700))
                        .build()
        ));
    }

    private AdminPricingConfig buildPricing(String rideType, double baseFare, double perKmRate, double perMinuteRate) {
        return AdminPricingConfig.builder()
                .rideType(rideType)
                .baseFare(BigDecimal.valueOf(baseFare))
                .perKmRate(BigDecimal.valueOf(perKmRate))
                .perMinuteRate(BigDecimal.valueOf(perMinuteRate))
                .ruralMultiplier(BigDecimal.valueOf(1.15))
                .cityTierMultiplier(BigDecimal.ONE)
                .nightChargeMultiplier(BigDecimal.valueOf(1.25))
                .peakMultiplier(BigDecimal.valueOf(1.30))
                .maxSurgeMultiplier(BigDecimal.valueOf(2.20))
                .tollFee(BigDecimal.valueOf(20))
                .bookingFee(BigDecimal.valueOf(8))
                .build();
    }

    private AdminUsersResponse.UserRow mapUserRow(User user, List<Ride> rides, List<AdminComplaint> complaints) {
        List<Ride> userRides = rides.stream().filter(ride -> user.getId().equals(ride.getRiderId())).toList();
        BigDecimal totalSpending = userRides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .map(this::rideAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long complaintsCount = complaints.stream().filter(complaint -> user.getId().equals(complaint.getUserId())).count();
        Instant lastActive = user.getLastActiveAt() != null
                ? user.getLastActiveAt()
                : userRides.stream().map(Ride::getCreatedAt).filter(value -> value != null).max(Comparator.naturalOrder()).orElse(null);

        return new AdminUsersResponse.UserRow(
                user.getId(),
                user.getName(),
                user.getEmail(),
                safe(user.getCity()),
                Boolean.TRUE.equals(user.getActive()),
                Boolean.TRUE.equals(user.getBlocked()),
                safeMoney(user.getWalletBalance()),
                complaintsCount,
                lastActive,
                totalSpending,
                userRides.size()
        );
    }

    private AdminDriversResponse.DriverRow mapDriverRow(User driver, List<Ride> rides) {
        List<Ride> driverRides = rides.stream().filter(ride -> driver.getId().equals(ride.getDriverId())).toList();
        long accepted = driverRides.stream().filter(ride -> ride.getStatus() == Ride.Status.ACCEPTED || ride.getStatus() == Ride.Status.PICKED || ride.getStatus() == Ride.Status.COMPLETED).count();
        long cancelled = driverRides.stream().filter(ride -> ride.getStatus() == Ride.Status.CANCELLED && "DRIVER".equalsIgnoreCase(safe(ride.getCancelledBy()))).count();
        long totalAssigned = driverRides.size();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        BigDecimal earningsToday = driverRides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .filter(ride -> isOnDate(ride.getCreatedAt(), today))
                .map(this::rideAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        double acceptancePercentage = totalAssigned == 0 ? 0D : roundTwoDecimals(accepted * 100D / totalAssigned);
        double cancellationPercentage = totalAssigned == 0 ? 0D : roundTwoDecimals(cancelled * 100D / totalAssigned);
        Instant lastActive = driver.getLastActiveAt() != null
                ? driver.getLastActiveAt()
                : driverRides.stream().map(Ride::getCreatedAt).filter(value -> value != null).max(Comparator.naturalOrder()).orElse(null);

        return new AdminDriversResponse.DriverRow(
                driver.getId(),
                driver.getName(),
                driver.getEmail(),
                safe(driver.getCity()),
                Boolean.TRUE.equals(driver.getOnline()),
                Boolean.TRUE.equals(driver.getBlocked()),
                safe(driver.getKycStatus()).isBlank() ? "PENDING" : driver.getKycStatus(),
                safe(driver.getVehicleLabel()),
                safe(driver.getAssignedZone()),
                safeMoney(driver.getRatingAverage()),
                acceptancePercentage,
                cancellationPercentage,
                earningsToday,
                lastActive,
                driver.getLatitude(),
                driver.getLongitude()
        );
    }

    private List<AdminRidesResponse.RideRow> mapRideRows(List<Ride> rides) {
        Map<Long, User> userMap = userRepository.findAll().stream().collect(Collectors.toMap(User::getId, user -> user));
        return rides.stream().map(ride -> new AdminRidesResponse.RideRow(
                ride.getId(),
                Optional.ofNullable(userMap.get(ride.getRiderId())).map(User::getName).orElse("-"),
                Optional.ofNullable(userMap.get(ride.getDriverId())).map(User::getName).orElse("-"),
                safe(ride.getPickupLocation()),
                safe(ride.getDropLocation()),
                rideAmount(ride),
                safe(ride.getPaymentMode()),
                safe(ride.getPaymentStatus()),
                ride.getStatus() == null ? "" : ride.getStatus().name(),
                buildEtaLabel(ride),
                ride.getCreatedAt()
        )).toList();
    }

    private AdminPricingResponse.PricingRow mapPricingRow(AdminPricingConfig config) {
        return new AdminPricingResponse.PricingRow(
                config.getId(),
                config.getRideType(),
                config.getBaseFare(),
                config.getPerKmRate(),
                config.getPerMinuteRate(),
                config.getRuralMultiplier(),
                config.getCityTierMultiplier(),
                config.getNightChargeMultiplier(),
                config.getPeakMultiplier(),
                config.getMaxSurgeMultiplier(),
                config.getTollFee(),
                config.getBookingFee(),
                config.getUpdatedAt()
        );
    }

    private AdminComplaintsResponse.ComplaintRow mapComplaintRow(AdminComplaint complaint) {
        Map<Long, User> userMap = userRepository.findAll().stream().collect(Collectors.toMap(User::getId, user -> user));
        return new AdminComplaintsResponse.ComplaintRow(
                complaint.getId(),
                complaint.getCategory(),
                complaint.getSeverity(),
                complaint.getStatus(),
                safe(complaint.getCity()),
                complaint.getSubject(),
                Optional.ofNullable(userMap.get(complaint.getUserId())).map(User::getName).orElse("-"),
                Optional.ofNullable(userMap.get(complaint.getDriverId())).map(User::getName).orElse("-"),
                complaint.getRideId(),
                safe(complaint.getAssignedTo()),
                complaint.getCreatedAt(),
                complaint.getUpdatedAt()
        );
    }

    private AdminPaymentsResponse.PaymentRow mapPaymentRow(Ride ride) {
        Map<Long, User> userMap = userRepository.findAll().stream().collect(Collectors.toMap(User::getId, user -> user));
        return new AdminPaymentsResponse.PaymentRow(
                ride.getId(),
                Optional.ofNullable(userMap.get(ride.getRiderId())).map(User::getName).orElse("-"),
                Optional.ofNullable(userMap.get(ride.getDriverId())).map(User::getName).orElse("-"),
                rideAmount(ride),
                safe(ride.getPaymentMode()),
                safe(ride.getPaymentStatus()),
                safe(ride.getPaymentReference()),
                settlementStatusForRide(ride),
                ride.getCreatedAt()
        );
    }

    private AdminZonesResponse.ZoneRow mapZoneRow(AdminZone zone) {
        return new AdminZonesResponse.ZoneRow(
                zone.getId(),
                zone.getName(),
                safe(zone.getCity()),
                safe(zone.getDemandLevel()),
                Boolean.TRUE.equals(zone.getServiceable()),
                Boolean.TRUE.equals(zone.getRuralRouteSupport()),
                zone.getActiveDrivers() == null ? 0 : zone.getActiveDrivers(),
                zone.getOngoingRides() == null ? 0 : zone.getOngoingRides(),
                safe(zone.getBlockedRoads()),
                safe(zone.getBoundaryLabel()),
                zone.getUpdatedAt()
        );
    }

    private List<AdminOverviewResponse.TrendPoint> buildRidesPerHour(List<Ride> rides) {
        Instant now = Instant.now();
        List<AdminOverviewResponse.TrendPoint> points = new ArrayList<>();
        for (int offset = 5; offset >= 0; offset--) {
            Instant bucketStart = now.minusSeconds(offset * 3600L).minusSeconds(now.getEpochSecond() % 3600L);
            Instant bucketEnd = bucketStart.plusSeconds(3600);
            long count = rides.stream()
                    .filter(ride -> ride.getCreatedAt() != null)
                    .filter(ride -> !ride.getCreatedAt().isBefore(bucketStart) && ride.getCreatedAt().isBefore(bucketEnd))
                    .count();
            points.add(new AdminOverviewResponse.TrendPoint(
                    HOUR_FORMATTER.format(bucketStart.atZone(ZoneOffset.UTC).toLocalDateTime()),
                    count
            ));
        }
        return points;
    }

    private List<AdminOverviewResponse.TrendPoint> buildRevenueTrend(List<Ride> rides) {
        return buildDailyPoints(7, day -> rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                .filter(ride -> isOnDate(ride.getCreatedAt(), day))
                .map(this::rideAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .doubleValue());
    }

    private List<AdminOverviewResponse.TrendPoint> buildDriverActivityTrend(List<Ride> rides) {
        return buildDailyPoints(7, day -> rides.stream()
                .filter(ride -> isOnDate(ride.getCreatedAt(), day))
                .filter(ride -> ride.getDriverId() != null)
                .map(Ride::getDriverId)
                .distinct()
                .count());
    }

    private List<AdminOverviewResponse.TrendPoint> buildRideCompletionTrend(List<Ride> rides) {
        return buildDailyPoints(7, day -> {
            long total = rides.stream().filter(ride -> isOnDate(ride.getCreatedAt(), day)).count();
            if (total == 0) {
                return 0D;
            }
            long completed = rides.stream()
                    .filter(ride -> isOnDate(ride.getCreatedAt(), day))
                    .filter(ride -> ride.getStatus() == Ride.Status.COMPLETED)
                    .count();
            return roundTwoDecimals(completed * 100D / total);
        });
    }

    private List<AdminOverviewResponse.ZoneHeatmapPoint> buildZoneHeatmap(List<AdminZone> zones) {
        return zones.stream()
                .map(zone -> new AdminOverviewResponse.ZoneHeatmapPoint(
                        zone.getId(),
                        zone.getName(),
                        zone.getCity(),
                        zone.getDemandLevel(),
                        zone.getActiveDrivers() == null ? 0 : zone.getActiveDrivers(),
                        zone.getOngoingRides() == null ? 0 : zone.getOngoingRides()
                ))
                .toList();
    }

    private List<AdminOverviewResponse.LiveAlert> buildLiveAlerts(List<AdminComplaint> complaints, List<Ride> rides) {
        List<AdminOverviewResponse.LiveAlert> alerts = complaints.stream()
                .filter(complaint -> "CRITICAL".equalsIgnoreCase(safe(complaint.getSeverity())) || !isComplaintResolved(complaint))
                .sorted(Comparator.comparing(AdminComplaint::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(4)
                .map(complaint -> new AdminOverviewResponse.LiveAlert(
                        "complaint-" + complaint.getId(),
                        complaint.getCategory(),
                        complaint.getSeverity(),
                        complaint.getSubject(),
                        safe(complaint.getStatus()) + " • " + safe(complaint.getCity()),
                        complaint.getCreatedAt()
                ))
                .collect(Collectors.toCollection(ArrayList::new));

        rides.stream()
                .filter(ride -> ride.getStatus() == Ride.Status.REQUESTED)
                .sorted(Comparator.comparing(Ride::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(0, 4 - alerts.size()))
                .forEach(ride -> alerts.add(new AdminOverviewResponse.LiveAlert(
                        "ride-" + ride.getId(),
                        "RIDE_REQUEST",
                        "MEDIUM",
                        "Pending ride assignment",
                        safe(ride.getPickupLocation()) + " -> " + safe(ride.getDropLocation()),
                        ride.getCreatedAt()
                )));

        return alerts;
    }

    private List<AdminOverviewResponse.TrendPoint> buildDailyPoints(int days, java.util.function.Function<LocalDate, Number> extractor) {
        List<AdminOverviewResponse.TrendPoint> points = new ArrayList<>();
        LocalDate today = LocalDate.now(ZoneOffset.UTC);
        for (int offset = days - 1; offset >= 0; offset--) {
            LocalDate day = today.minusDays(offset);
            points.add(new AdminOverviewResponse.TrendPoint(day.getMonthValue() + "/" + day.getDayOfMonth(), extractor.apply(day).doubleValue()));
        }
        return points;
    }

    private boolean matchesUser(User user, String search, String city, String state) {
        boolean matchesSearch = search.isBlank()
                || safe(user.getName()).toLowerCase(Locale.ROOT).contains(search)
                || safe(user.getEmail()).toLowerCase(Locale.ROOT).contains(search);
        boolean matchesCity = city.isBlank() || safe(user.getCity()).equalsIgnoreCase(city);
        boolean matchesState = switch (state) {
            case "active" -> Boolean.TRUE.equals(user.getActive()) && !Boolean.TRUE.equals(user.getBlocked());
            case "blocked" -> Boolean.TRUE.equals(user.getBlocked());
            default -> true;
        };
        return matchesSearch && matchesCity && matchesState;
    }

    private boolean matchesDriver(User user, String search, String status, String zone) {
        boolean matchesSearch = search.isBlank()
                || safe(user.getName()).toLowerCase(Locale.ROOT).contains(search)
                || safe(user.getEmail()).toLowerCase(Locale.ROOT).contains(search);
        boolean matchesStatus = switch (status) {
            case "online" -> Boolean.TRUE.equals(user.getOnline());
            case "offline" -> !Boolean.TRUE.equals(user.getOnline());
            case "blocked" -> Boolean.TRUE.equals(user.getBlocked());
            case "pending" -> "PENDING".equalsIgnoreCase(safe(user.getKycStatus()));
            default -> true;
        };
        boolean matchesZone = zone.isBlank() || safe(user.getAssignedZone()).equalsIgnoreCase(zone);
        return matchesSearch && matchesStatus && matchesZone;
    }

    private boolean matchesRideSearch(Ride ride, String search) {
        return safe(ride.getPickupLocation()).toLowerCase(Locale.ROOT).contains(search)
                || safe(ride.getDropLocation()).toLowerCase(Locale.ROOT).contains(search)
                || String.valueOf(ride.getId()).contains(search);
    }

    private boolean matchesComplaintSearch(AdminComplaint complaint, String search) {
        return safe(complaint.getSubject()).toLowerCase(Locale.ROOT).contains(search)
                || safe(complaint.getCategory()).toLowerCase(Locale.ROOT).contains(search)
                || safe(complaint.getCity()).toLowerCase(Locale.ROOT).contains(search);
    }

    private void refundRideById(Long rideId) {
        Ride ride = rideRepository.findById(rideId).orElseThrow();
        ride.setPaymentStatus("REFUNDED");
        creditRideRefundToRider(ride);
        rideRepository.save(ride);
        adminLiveUpdateService.publishPaymentUpdate(ride);
    }

    private void creditRideRefundToRider(Ride ride) {
        if (ride == null || ride.getRiderId() == null) {
            return;
        }
        userRepository.findById(ride.getRiderId()).ifPresent(user -> {
            user.setWalletBalance(safeMoney(user.getWalletBalance()).add(rideAmount(ride)));
            userRepository.save(user);
        });
    }

    private void updateUserBlockState(Long userId, boolean blocked) {
        if (userId == null) {
            return;
        }
        userRepository.findById(userId).ifPresent(user -> {
            user.setBlocked(blocked);
            user.setActive(!blocked);
            userRepository.save(user);
        });
    }

    private BigDecimal rideAmount(Ride ride) {
        return BigDecimal.valueOf(ride == null || ride.getFare() == null ? 0D : ride.getFare()).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal safeMoney(BigDecimal value) {
        return value == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : value.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal requireMoney(BigDecimal input, BigDecimal fallback) {
        return input != null ? input : safeMoney(fallback);
    }

    private String buildEtaLabel(Ride ride) {
        if (ride == null || ride.getCreatedAt() == null) {
            return "-";
        }
        long elapsedMinutes = Math.max(0, (Instant.now().toEpochMilli() - ride.getCreatedAt().toEpochMilli()) / 60000);
        if (ride.getStatus() == Ride.Status.REQUESTED) {
            return Math.max(2, 8 - elapsedMinutes) + " min";
        }
        if (ride.getStatus() == Ride.Status.ACCEPTED) {
            return Math.max(2, 6 - elapsedMinutes) + " min";
        }
        if (ride.getStatus() == Ride.Status.PICKED) {
            return Math.max(3, 14 - elapsedMinutes) + " min";
        }
        return "-";
    }

    private String settlementStatusForRide(Ride ride) {
        String paymentStatus = safe(ride.getPaymentStatus()).toUpperCase(Locale.ROOT);
        if (paymentStatus.contains("REFUND")) {
            return "REFUND";
        }
        if (paymentStatus.contains("PAYOUT")) {
            return "PAYOUT";
        }
        if ("PAID".equals(paymentStatus) || "COMPLETED".equals(paymentStatus)) {
            return "SETTLED";
        }
        return "PENDING";
    }

    private boolean isOnDate(Instant instant, LocalDate date) {
        return instant != null && instant.atZone(ZoneOffset.UTC).toLocalDate().isEqual(date);
    }

    private boolean isComplaintResolved(AdminComplaint complaint) {
        return complaint != null
                && complaint.getStatus() != null
                && RESOLVED_COMPLAINT_STATUSES.contains(complaint.getStatus().trim().toUpperCase(Locale.ROOT));
    }

    private boolean isClosedRide(Ride ride) {
        return ride.getStatus() == Ride.Status.COMPLETED || ride.getStatus() == Ride.Status.CANCELLED;
    }

    private boolean isRole(User user, String role) {
        return user != null && safe(user.getRole()).equalsIgnoreCase(role);
    }

    private double roundTwoDecimals(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
