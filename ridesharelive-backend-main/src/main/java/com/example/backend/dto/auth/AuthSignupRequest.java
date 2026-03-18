package com.example.backend.dto.auth;

import lombok.Data;

@Data
public class AuthSignupRequest {

    private String name;
    private String email;
    private String password;
    private String role;
    private String otp;
}
