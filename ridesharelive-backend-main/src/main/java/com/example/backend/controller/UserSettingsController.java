package com.example.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.UserSettingsRequest;
import com.example.backend.entity.User;
import com.example.backend.service.UserService;
import com.example.backend.service.UserSettingsService;

@RestController
@RequestMapping("/user-settings")
public class UserSettingsController {

    @Autowired
    private UserSettingsService userSettingsService;

    @Autowired
    private UserService userService;

    @GetMapping
    public ResponseEntity<?> getSettings(@AuthenticationPrincipal UserDetails userDetails) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        Map<String, Object> payload = userSettingsService.getSettingsPayload(user.getId());
        return ResponseEntity.ok(payload);
    }

    @PutMapping
    public ResponseEntity<?> updateSettings(
            @RequestBody(required = false) UserSettingsRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        Map<String, Object> payload = userSettingsService.updateSettings(user.getId(), request);
        return ResponseEntity.ok(payload);
    }
}
