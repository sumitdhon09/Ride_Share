package com.example.backend.config;

import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Configuration
public class RateLimitConfig {

    private static final Duration STANDARD_WINDOW = Duration.ofMinutes(1);
    private static final Duration STRICT_WINDOW = Duration.ofMinutes(1);
    private static final int STANDARD_LIMIT = 20;
    private static final int STRICT_LIMIT = 5;

    private final Map<String, SlidingWindowRateLimiter> cache = new ConcurrentHashMap<>();

    public SlidingWindowRateLimiter resolveBucket(String key) {
        return cache.computeIfAbsent(key, ignored -> new SlidingWindowRateLimiter(STANDARD_LIMIT, STANDARD_WINDOW));
    }

    public SlidingWindowRateLimiter resolveStrictBucket(String key) {
        return cache.computeIfAbsent(key + "_strict", ignored -> new SlidingWindowRateLimiter(STRICT_LIMIT, STRICT_WINDOW));
    }

    public static final class SlidingWindowRateLimiter {
        private final int limit;
        private final long windowMillis;
        private final Deque<Long> requestTimes = new ArrayDeque<>();

        public SlidingWindowRateLimiter(int limit, Duration window) {
            this.limit = limit;
            this.windowMillis = window.toMillis();
        }

        public synchronized RateLimitDecision tryConsume() {
            long now = System.currentTimeMillis();
            evictExpired(now);

            if (requestTimes.size() < limit) {
                requestTimes.addLast(now);
                return new RateLimitDecision(true, limit - requestTimes.size(), 0);
            }

            long oldest = requestTimes.peekFirst() == null ? now : requestTimes.peekFirst();
            long retryAfterMillis = Math.max(0, windowMillis - (now - oldest));
            long retryAfterSeconds = Math.max(1, (retryAfterMillis + 999) / 1000);
            return new RateLimitDecision(false, 0, retryAfterSeconds);
        }

        private void evictExpired(long now) {
            while (!requestTimes.isEmpty() && now - requestTimes.peekFirst() >= windowMillis) {
                requestTimes.removeFirst();
            }
        }
    }

    public record RateLimitDecision(boolean allowed, long remainingTokens, long retryAfterSeconds) {
    }
}
