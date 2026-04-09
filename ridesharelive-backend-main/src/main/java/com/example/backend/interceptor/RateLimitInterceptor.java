package com.example.backend.interceptor;

import com.example.backend.config.RateLimitConfig;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class RateLimitInterceptor implements HandlerInterceptor {

    @Autowired
    private RateLimitConfig rateLimitConfig;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String clientIP = getClientIP(request);
        String requestURI = request.getRequestURI();

        RateLimitConfig.SlidingWindowRateLimiter rateLimiter;
        if (requestURI.contains("/auth/")) {
            rateLimiter = rateLimitConfig.resolveStrictBucket(clientIP);
        } else {
            rateLimiter = rateLimitConfig.resolveBucket(clientIP);
        }

        RateLimitConfig.RateLimitDecision decision = rateLimiter.tryConsume();
        if (decision.allowed()) {
            response.addHeader("X-Rate-Limit-Remaining", String.valueOf(decision.remainingTokens()));
            return true;
        } else {
            response.addHeader("X-Rate-Limit-Retry-After-Seconds", String.valueOf(decision.retryAfterSeconds()));
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.getWriter().write("{\"error\":\"Rate limit exceeded. Please try again later.\"}");
            return false;
        }
    }

    private String getClientIP(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}
