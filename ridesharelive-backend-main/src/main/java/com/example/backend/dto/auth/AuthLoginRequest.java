package com.example.backend.dto.auth;

import lombok.Data;

@Data
public class AuthLoginRequest {

    private String email;
    private String password;
    private String role;
}
