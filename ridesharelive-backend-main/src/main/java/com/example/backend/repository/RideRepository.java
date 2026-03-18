package com.example.backend.repository;

import org.springframework.data.jpa.repository.JpaRepository;

import com.example.backend.entity.Ride;

public interface RideRepository extends JpaRepository<Ride, Long> {

}
