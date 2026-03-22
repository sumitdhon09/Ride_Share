package com.example.backend.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.http.HttpRequest;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Flow;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class OtpEmailServiceTest {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    @Test
    void sendSignupOtpEmailUsesResendWhenApiKeyConfigured() {
        OtpEmailService otpEmailService = spy(new OtpEmailService());
        ReflectionTestUtils.setField(otpEmailService, "javaMailSender", mock(JavaMailSender.class));
        ReflectionTestUtils.setField(otpEmailService, "otpEmailEnabled", true);
        ReflectionTestUtils.setField(otpEmailService, "mailProvider", "auto");
        ReflectionTestUtils.setField(otpEmailService, "resendApiKey", "re_test_key");
        ReflectionTestUtils.setField(otpEmailService, "fromAddress", "onboarding@resend.dev");
        ReflectionTestUtils.setField(otpEmailService, "fromName", "RideShare Live");

        doReturn(OtpEmailService.MailDeliveryResult.success("OTP sent to your email address."))
                .when(otpEmailService)
                .sendPlainTextEmailViaResend(anyString(), anyString(), anyString());

        OtpEmailService.MailDeliveryResult result =
                otpEmailService.sendSignupOtpEmail("Test Rider", "rider@example.com", "123456");

        assertTrue(result.sent());
        assertEquals("OTP sent to your email address.", result.message());

        ArgumentCaptor<String> bodyCaptor = ArgumentCaptor.forClass(String.class);
        verify(otpEmailService, times(1)).sendPlainTextEmailViaResend(
                org.mockito.ArgumentMatchers.eq("rider@example.com"),
                org.mockito.ArgumentMatchers.eq("RideShare Live signup OTP"),
                bodyCaptor.capture()
        );
        assertTrue(bodyCaptor.getValue().contains("123456"));
    }

    @Test
    void buildResendRequestIncludesExpectedHeadersAndPayload() throws Exception {
        OtpEmailService otpEmailService = new OtpEmailService();
        ReflectionTestUtils.setField(otpEmailService, "resendApiKey", "re_test_key");
        ReflectionTestUtils.setField(otpEmailService, "resendApiBaseUrl", "https://api.resend.com/");
        ReflectionTestUtils.setField(otpEmailService, "fromAddress", "onboarding@resend.dev");
        ReflectionTestUtils.setField(otpEmailService, "fromName", "RideShare Live");

        HttpRequest request = otpEmailService.buildResendRequest("rider@example.com", "OTP subject", "OTP body");

        assertEquals("https://api.resend.com/emails", request.uri().toString());
        assertEquals("Bearer re_test_key", request.headers().firstValue("Authorization").orElse(""));
        assertEquals("application/json", request.headers().firstValue("Content-Type").orElse(""));

        Map<?, ?> payload = OBJECT_MAPPER.readValue(readRequestBody(request), Map.class);
        assertEquals("RideShare Live <onboarding@resend.dev>", payload.get("from"));
        assertEquals("OTP subject", payload.get("subject"));
        assertEquals("OTP body", payload.get("text"));
        assertEquals(List.of("rider@example.com"), payload.get("to"));
    }

    @Test
    void sendSignupOtpEmailFailsWhenResendProviderMissingApiKey() {
        OtpEmailService otpEmailService = new OtpEmailService();
        ReflectionTestUtils.setField(otpEmailService, "javaMailSender", mock(JavaMailSender.class));
        ReflectionTestUtils.setField(otpEmailService, "otpEmailEnabled", true);
        ReflectionTestUtils.setField(otpEmailService, "mailProvider", "resend");
        ReflectionTestUtils.setField(otpEmailService, "fromAddress", "onboarding@resend.dev");
        ReflectionTestUtils.setField(otpEmailService, "fromName", "RideShare Live");

        OtpEmailService.MailDeliveryResult result =
                otpEmailService.sendSignupOtpEmail("Test Rider", "rider@example.com", "123456");

        assertFalse(result.sent());
        assertEquals("RESEND_API_KEY is missing.", result.message());
    }

    private static String readRequestBody(HttpRequest request) throws Exception {
        HttpRequest.BodyPublisher bodyPublisher = request.bodyPublisher().orElseThrow();
        BodyCollector collector = new BodyCollector();
        bodyPublisher.subscribe(collector);
        return collector.await();
    }

    private static final class BodyCollector implements Flow.Subscriber<ByteBuffer> {

        private final StringBuilder builder = new StringBuilder();
        private final CompletableFuture<String> completion = new CompletableFuture<>();
        private Flow.Subscription subscription;

        @Override
        public void onSubscribe(Flow.Subscription subscription) {
            this.subscription = subscription;
            subscription.request(Long.MAX_VALUE);
        }

        @Override
        public void onNext(ByteBuffer item) {
            builder.append(StandardCharsets.UTF_8.decode(item.duplicate()));
        }

        @Override
        public void onError(Throwable throwable) {
            completion.completeExceptionally(throwable);
        }

        @Override
        public void onComplete() {
            completion.complete(builder.toString());
            if (subscription != null) {
                subscription.cancel();
            }
        }

        String await() throws Exception {
            return completion.get();
        }
    }
}
