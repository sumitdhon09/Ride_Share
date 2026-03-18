package com.example.backend.controller;

import java.util.Locale;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.auth.AuthLoginRequest;
import com.example.backend.dto.auth.AuthRefreshRequest;
import com.example.backend.dto.auth.AuthResponse;
import com.example.backend.dto.auth.AuthSignupRequest;
import com.example.backend.dto.auth.AuthSignupOtpRequest;
import com.example.backend.entity.User;
import com.example.backend.security.JwtUtil;
import com.example.backend.service.RefreshTokenService;
import com.example.backend.service.SignupOtpService;
import com.example.backend.service.UserService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@RestController
@RequestMapping("/auth")
@Tag(name = "Authentication", description = "Signup, login, refresh and logout endpoints")
public class AuthController {

    @Autowired
    private UserService userService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private RefreshTokenService refreshTokenService;

    @Autowired
    private SignupOtpService signupOtpService;

    @PostMapping("/signup/request-otp")
    @Operation(summary = "Generate and send a signup OTP")
    @ApiResponse(responseCode = "200", description = "OTP generated")
    public ResponseEntity<?> requestSignupOtp(@RequestBody AuthSignupOtpRequest request) {
        if (request == null || request.getEmail() == null || request.getEmail().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "email is required."));
        }

        SignupOtpService.IssueResult result = signupOtpService.issueOtp(request.getName(), request.getEmail());
        if (!result.accepted()) {
            if (result.rateLimited()) {
                return ResponseEntity.status(429).body(
                        Map.of(
                                "message", result.message(),
                                "retryAfterSeconds", result.retryAfterSeconds()
                        )
                );
            }
            return ResponseEntity.badRequest().body(Map.of("message", result.message()));
        }

        return ResponseEntity.ok(
                Map.of(
                        "message", result.message(),
                        "emailSent", result.emailSent(),
                        "expiresAt", result.expiresAt() == null ? "" : result.expiresAt().toString()
                )
        );
    }

    @PostMapping("/signup")
    @Operation(summary = "Create or update an account")
    @ApiResponse(responseCode = "200", description = "Account created")
    public ResponseEntity<?> register(@RequestBody AuthSignupRequest request) {
        if (request == null || request.getEmail() == null || request.getPassword() == null || request.getName() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "name, email and password are required."));
        }
        if (request.getOtp() == null || request.getOtp().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "otp is required."));
        }

        SignupOtpService.VerificationResult verificationResult = signupOtpService.verifyOtp(request.getEmail(), request.getOtp());
        if (!verificationResult.valid()) {
            return ResponseEntity.badRequest().body(Map.of("message", verificationResult.message()));
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .password(request.getPassword())
                .role(request.getRole())
                .build();
        userService.registerUser(user);
        return ResponseEntity.ok(Map.of("message", "Account created/updated successfully."));
    }

    @PostMapping("/login")
    @Operation(summary = "Login with email/password and issue JWT access + refresh tokens")
    @ApiResponse(responseCode = "200", description = "Login successful")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public ResponseEntity<?> login(@RequestBody AuthLoginRequest request) {
        if (request == null || request.getEmail() == null || request.getPassword() == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "email and password are required."));
        }

        User user = userService.findByEmail(request.getEmail()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(401).body("Account not found. Please sign up first.");
        }

        boolean valid = userService.passwordMatches(request.getPassword(), user.getPassword());
        if (!valid) {
            return ResponseEntity.status(401).body("Incorrect password.");
        }

        String effectiveRole = resolveLoginRole(request.getRole(), user.getRole());
        String accessToken = jwtUtil.generateAccessToken(
                user.getEmail(),
                jwtUtil.buildAuthClaims(user.getId(), effectiveRole)
        );
        String refreshToken = refreshTokenService.createToken(user, effectiveRole);

        return ResponseEntity.ok(
                AuthResponse.builder()
                        .token(accessToken)
                        .accessToken(accessToken)
                        .refreshToken(refreshToken)
                        .tokenType("Bearer")
                        .expiresIn(jwtUtil.getAccessExpirationSeconds())
                        .name(user.getName())
                        .role(effectiveRole)
                        .id(user.getId())
                        .build()
        );
    }

    @PostMapping("/refresh")
    @Operation(summary = "Rotate refresh token and issue a new access token")
    @ApiResponse(responseCode = "200", description = "Token refreshed")
    @ApiResponse(responseCode = "401", description = "Invalid refresh token")
    public ResponseEntity<?> refresh(@RequestBody AuthRefreshRequest request) {
        if (request == null || request.getRefreshToken() == null || request.getRefreshToken().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "refreshToken is required."));
        }

        String incomingRefreshToken = request.getRefreshToken().trim();
        if (!jwtUtil.isRefreshTokenValid(incomingRefreshToken)) {
            return ResponseEntity.status(401).body(Map.of("message", "Invalid refresh token."));
        }

        String email = jwtUtil.extractUsername(incomingRefreshToken);
        Optional<User> userOpt = userService.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Account not found."));
        }

        User user = userOpt.get();
        Optional<RefreshTokenService.RefreshRotationResult> rotatedOpt = refreshTokenService.rotate(incomingRefreshToken, user);
        if (rotatedOpt.isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Refresh token revoked or expired."));
        }

        String role = rotatedOpt.get().role();
        if (role == null || role.isBlank()) {
            role = user.getRole();
        }

        String nextAccessToken = jwtUtil.generateAccessToken(
                user.getEmail(),
                jwtUtil.buildAuthClaims(user.getId(), role)
        );

        return ResponseEntity.ok(
                AuthResponse.builder()
                        .token(nextAccessToken)
                        .accessToken(nextAccessToken)
                        .refreshToken(rotatedOpt.get().refreshToken())
                        .tokenType("Bearer")
                        .expiresIn(jwtUtil.getAccessExpirationSeconds())
                        .name(user.getName())
                        .role(role)
                        .id(user.getId())
                        .build()
        );
    }

    private String resolveLoginRole(String requestedRole, String defaultRole) {
        if (requestedRole == null || requestedRole.isBlank()) {
            return defaultRole;
        }
        String normalized = requestedRole.trim().toUpperCase(Locale.ROOT);
        if ("RIDER".equals(normalized) || "DRIVER".equals(normalized)) {
            return normalized;
        }
        return defaultRole;
    }

    @PostMapping("/logout")
    @Operation(summary = "Revoke refresh token")
    @ApiResponse(responseCode = "200", description = "Logged out")
    public ResponseEntity<?> logout(@RequestBody(required = false) AuthRefreshRequest request) {
        if (request != null && request.getRefreshToken() != null && !request.getRefreshToken().isBlank()) {
            refreshTokenService.revoke(request.getRefreshToken().trim());
        }
        return ResponseEntity.ok(Map.of("message", "Logged out."));
    }
}
