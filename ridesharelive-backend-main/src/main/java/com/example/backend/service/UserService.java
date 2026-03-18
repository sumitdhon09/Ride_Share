package com.example.backend.service;

import java.util.Locale;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
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

    private String normalizeEmail(String email) {
        if (email == null) {
            return "";
        }
        return email.trim().toLowerCase(Locale.ROOT);
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
        Optional<User> existing = userRepository.findByEmailIgnoreCase(normalizedEmail);

        User target = existing.orElseGet(User::new);
        target.setName(user.getName());
        target.setEmail(normalizedEmail);
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
