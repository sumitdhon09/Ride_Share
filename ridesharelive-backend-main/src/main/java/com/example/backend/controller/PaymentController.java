package com.example.backend.controller;

import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.backend.dto.payment.CreateCheckoutSessionRequest;
import com.example.backend.entity.User;
import com.example.backend.service.PaymentService;
import com.example.backend.service.UserService;
import com.stripe.exception.StripeException;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private UserService userService;

    @PostMapping("/checkout-session")
    public ResponseEntity<?> createCheckoutSession(
            @RequestBody CreateCheckoutSessionRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        if (request == null || request.getAmountInInr() == null || request.getAmountInInr() <= 0) {
            return ResponseEntity.badRequest().body("amountInInr must be a positive number.");
        }

        User user = userService.findByEmail(userDetails.getUsername()).orElseThrow();
        try {
            Map<String, Object> response = paymentService.createCheckoutSession(
                    request.getAmountInInr(),
                    request.getRideSummary(),
                    user.getId(),
                    request.getPaymentMode()
            );
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException validationError) {
            return ResponseEntity.badRequest().body(validationError.getMessage());
        } catch (IllegalStateException configurationError) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(configurationError.getMessage());
        } catch (StripeException stripeError) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Unable to start payment session.");
        }
    }

    @GetMapping("/verify-session/{sessionId}")
    public ResponseEntity<?> verifyCheckoutSession(@PathVariable String sessionId) {
        try {
            return ResponseEntity.ok(paymentService.verifyCheckoutSession(sessionId));
        } catch (IllegalArgumentException validationError) {
            return ResponseEntity.badRequest().body(validationError.getMessage());
        } catch (IllegalStateException configurationError) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(configurationError.getMessage());
        } catch (StripeException stripeError) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body("Unable to verify payment session.");
        }
    }
}
