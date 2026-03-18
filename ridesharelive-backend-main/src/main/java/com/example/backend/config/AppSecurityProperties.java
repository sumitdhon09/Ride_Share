package com.example.backend.config;

import java.util.ArrayList;
import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

    private List<String> corsAllowedOriginPatterns = new ArrayList<>(
            List.of("http://localhost:5173", "http://127.0.0.1:5173")
    );

    private boolean swaggerEnabled = true;

    public List<String> getCorsAllowedOriginPatterns() {
        return corsAllowedOriginPatterns;
    }

    public void setCorsAllowedOriginPatterns(List<String> corsAllowedOriginPatterns) {
        this.corsAllowedOriginPatterns = corsAllowedOriginPatterns;
    }

    public boolean isSwaggerEnabled() {
        return swaggerEnabled;
    }

    public void setSwaggerEnabled(boolean swaggerEnabled) {
        this.swaggerEnabled = swaggerEnabled;
    }

    public List<String> getNormalizedCorsAllowedOriginPatterns() {
        List<String> normalizedPatterns = new ArrayList<>();
        for (String originPattern : corsAllowedOriginPatterns) {
            if (originPattern == null) {
                continue;
            }
            String trimmedPattern = originPattern.trim();
            if (!trimmedPattern.isEmpty()) {
                normalizedPatterns.add(trimmedPattern);
            }
        }
        if (normalizedPatterns.isEmpty()) {
            throw new IllegalStateException(
                    "APP_CORS_ALLOWED_ORIGINS must contain at least one frontend origin."
            );
        }
        return normalizedPatterns;
    }
}
