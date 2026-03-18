package com.example.backend.dto.auth;

import lombok.Data;

@Data
public class AuthRefreshRequest {

    private String refreshToken;
}
