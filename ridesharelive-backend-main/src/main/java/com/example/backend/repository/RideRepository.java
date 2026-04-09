package com.example.backend.repository;

import java.time.Instant;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.example.backend.entity.Ride;

public interface RideRepository extends JpaRepository<Ride, Long> {

    List<Ride> findByRiderIdAndStatusIn(Long riderId, Collection<Ride.Status> statuses);

    List<Ride> findByRiderIdOrDriverIdOrderByCreatedAtDesc(Long riderId, Long driverId);

    List<Ride> findByStatusNotInOrderByCreatedAtDesc(Collection<Ride.Status> statuses);

    @Query("""
            select r from Ride r
            where r.status in :activeStatuses
               or (r.createdAt is not null and r.createdAt >= :historyCutoff)
               or (r.acceptedAt is not null and r.acceptedAt >= :driverSignalCutoff)
               or (r.driverLocationUpdatedAt is not null and r.driverLocationUpdatedAt >= :driverSignalCutoff)
            """)
    List<Ride> findRelevantForPredictiveInsights(
            @Param("activeStatuses") Collection<Ride.Status> activeStatuses,
            @Param("historyCutoff") Instant historyCutoff,
            @Param("driverSignalCutoff") Instant driverSignalCutoff
    );
}
