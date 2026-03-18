package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.test.util.ReflectionTestUtils;

class SignupOtpServiceTest {

    private SignupOtpService signupOtpService;
    private OtpEmailService otpEmailService;

    @BeforeEach
    void setUp() {
        otpEmailService = Mockito.mock(OtpEmailService.class);
        when(otpEmailService.sendSignupOtpEmail(anyString(), anyString(), anyString()))
                .thenReturn(OtpEmailService.MailDeliveryResult.failure("mail unavailable"));

        signupOtpService = new SignupOtpService();
        ReflectionTestUtils.setField(signupOtpService, "otpEmailService", otpEmailService);
        ReflectionTestUtils.setField(signupOtpService, "signupOtpEnabled", true);
        ReflectionTestUtils.setField(signupOtpService, "otpTtlSeconds", 300L);
        ReflectionTestUtils.setField(signupOtpService, "resendDelaySeconds", 30L);
        ReflectionTestUtils.setField(signupOtpService, "exposeDevOtp", true);
    }

    @Test
    void issueOtpReturnsDevOtpAndVerificationConsumesIt() {
        SignupOtpService.IssueResult issueResult = signupOtpService.issueOtp("Test Rider", "rider@example.com");

        assertTrue(issueResult.accepted());
        assertFalse(issueResult.emailSent());
        assertNotNull(issueResult.devOtp());
        assertEquals(6, issueResult.devOtp().length());

        SignupOtpService.VerificationResult verificationResult =
                signupOtpService.verifyOtp("rider@example.com", issueResult.devOtp());

        assertTrue(verificationResult.valid());

        SignupOtpService.VerificationResult reusedVerification =
                signupOtpService.verifyOtp("rider@example.com", issueResult.devOtp());

        assertFalse(reusedVerification.valid());
    }

    @Test
    void issueOtpIsRateLimitedWithinCooldownWindow() {
        SignupOtpService.IssueResult firstIssue = signupOtpService.issueOtp("Test Rider", "rider@example.com");
        SignupOtpService.IssueResult secondIssue = signupOtpService.issueOtp("Test Rider", "rider@example.com");

        assertTrue(firstIssue.accepted());
        assertFalse(secondIssue.accepted());
        assertTrue(secondIssue.rateLimited());
    }

    @Test
    void issueOtpAcceptsWhenSmtpDeliverySucceedsEvenWithoutDevOtp() {
        ReflectionTestUtils.setField(signupOtpService, "exposeDevOtp", false);
        when(otpEmailService.sendSignupOtpEmail(anyString(), anyString(), anyString()))
                .thenReturn(OtpEmailService.MailDeliveryResult.success("OTP sent to your email address."));

        SignupOtpService.IssueResult issueResult = signupOtpService.issueOtp("Test Rider", "rider@example.com");

        assertTrue(issueResult.accepted());
        assertTrue(issueResult.emailSent());
        assertEquals("", issueResult.devOtp() == null ? "" : issueResult.devOtp());
        verify(otpEmailService, times(1)).sendSignupOtpEmail(anyString(), anyString(), anyString());
    }
}
