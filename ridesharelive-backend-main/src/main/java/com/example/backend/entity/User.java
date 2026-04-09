package com.example.backend.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users", indexes = {
        @Index(name = "idx_user_email", columnList = "email"),
        @Index(name = "idx_user_phone", columnList = "phoneNumber"),
        @Index(name = "idx_user_role", columnList = "role")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank(message = "Name is required")
    @Size(min = 2, max = 100, message = "Name must be between 2 and 100 characters")
    private String name;

    @Email(message = "Invalid email format")
    @NotBlank(message = "Email is required")
    @Column(unique = true, nullable = false)
    private String email;

    @Pattern(regexp = "^[+]?[0-9\\s\\-()]{10,20}$", message = "Invalid phone number format")
    @Column(unique = true, length = 20)
    private String phoneNumber;

    @Size(min = 8, message = "Password must be at least 8 characters")
    private String password;

    @Pattern(regexp = "^(RIDER|DRIVER|ADMIN)$", message = "Role must be RIDER, DRIVER, or ADMIN")
    @Column(length = 20)
    private String role;

    @Column(length = 50)
    private String licenseNumber;

    @Column(length = 20)
    private String vehicleNumber;

    @Column(length = 50)
    private String vehicleModel;

    @Builder.Default
    private boolean isVerified = false;

    @Builder.Default
    private boolean isOnline = false;

    @Builder.Default
    private boolean isAvailable = true;
}
