package com.example.backend.dto.auth;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AuthResponse {

    private String token;
    private String accessToken;
    private String refreshToken;
    private String tokenType;
    private long expiresIn;
    private Long id;
    private String name;
    private String role;
}
