package com.example.backend.service;

import java.util.Locale;
import java.util.Optional;

import com.example.backend.util.ContactPointNormalizer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.example.backend.entity.User;
import com.example.backend.repository.UserRepository;

@Service
public class UserService {

    @Autowired
    UserRepository userRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Value("${app.user.default-country-code:+91}")
    private String defaultCountryCode;

    private String normalizeEmail(String email) {
        return ContactPointNormalizer.normalizeEmail(email);
    }

    private String normalizePhoneNumber(String phoneNumber) {
        return ContactPointNormalizer.normalizePhoneNumber(phoneNumber, defaultCountryCode);
    }

    private String normalizeRole(String role) {
        if (role == null || role.isBlank()) {
            return "RIDER";
        }
        String normalized = role.trim().toUpperCase(Locale.ROOT);
        if ("DRIVER".equals(normalized) || "RIDER".equals(normalized)) {
            return normalized;
        }
        return "RIDER";
    }

    public User registerUser(User user, String confirmPassword) {
        if (user.getPassword() != null && !user.getPassword().equals(confirmPassword)) {
            throw new IllegalArgumentException("Passwords do not match.");
        }

        String normalizedEmail = normalizeEmail(user.getEmail());
        if (normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("Email is required.");
        }

        String normalizedPhoneNumber = normalizePhoneNumber(user.getPhoneNumber());
        if (normalizedPhoneNumber.isBlank()) {
            throw new IllegalArgumentException("Phone number is required.");
        }

        Optional<User> existingEmail = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (existingEmail.isPresent()) {
            throw new IllegalArgumentException("Email is already registered.");
        }

        Optional<User> existingPhone = userRepository.findByPhoneNumber(normalizedPhoneNumber);
        if (existingPhone.isPresent()) {
            throw new IllegalArgumentException("Phone number is already registered.");
        }

        user.setEmail(normalizedEmail);
        user.setPhoneNumber(normalizedPhoneNumber);
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setRole(normalizeRole(user.getRole()));
        
        // Driver verification logic: If role is DRIVER, they are NOT verified by default
        if ("DRIVER".equals(user.getRole())) {
            user.setVerified(false);
            user.setOnline(false);
            user.setAvailable(true);
        } else {
            user.setVerified(true); // Riders are verified by default for simplicity
        }

        return userRepository.save(user);
    }

    public Optional<User> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(normalizeEmail(email));
    }

    public boolean passwordMatches(String rawPassword, String storedPassword) {
        if (rawPassword == null || storedPassword == null) {
            return false;
        }
        try {
            if (passwordEncoder.matches(rawPassword, storedPassword)) {
                return true;
            }
        } catch (Exception ignored) {
            // Fall through to plain-text comparison for legacy rows.
        }
        return rawPassword.equals(storedPassword);
    }

    public boolean validateCredentials(String email, String rawPassword) {
        Optional<User> userOpt = findByEmail(email);
        return userOpt.isPresent() && passwordMatches(rawPassword, userOpt.get().getPassword());
    }

}
