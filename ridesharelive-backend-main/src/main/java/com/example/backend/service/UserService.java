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

    public User registerUser(User user) {
        String normalizedEmail = normalizeEmail(user.getEmail());
        if (normalizedEmail.isBlank()) {
            throw new IllegalArgumentException("email is required.");
        }

        String normalizedPhoneNumber = normalizePhoneNumber(user.getPhoneNumber());
        Optional<User> existing = userRepository.findByEmailIgnoreCase(normalizedEmail);
        if (!normalizedPhoneNumber.isBlank()) {
            Optional<User> phoneOwner = userRepository.findByPhoneNumber(normalizedPhoneNumber);
            if (phoneOwner.isPresent()
                    && existing.map(User::getId).map(id -> !id.equals(phoneOwner.get().getId())).orElse(true)) {
                throw new IllegalArgumentException("This mobile number is already linked to another account.");
            }
        }

        User target = existing.orElseGet(User::new);
        target.setName(user.getName());
        target.setEmail(normalizedEmail);
        if (!normalizedPhoneNumber.isBlank()) {
            target.setPhoneNumber(normalizedPhoneNumber);
        } else if (target.getPhoneNumber() == null || target.getPhoneNumber().isBlank()) {
            target.setPhoneNumber(null);
        }
        target.setPassword(passwordEncoder.encode(user.getPassword()));
        target.setRole(normalizeRole(user.getRole()));

        return userRepository.save(target);
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
