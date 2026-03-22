package com.example.backend.config;

import java.util.ArrayList;
import java.util.List;

import lombok.Getter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Component
@ConfigurationProperties(prefix = "app.security")
public class AppSecurityProperties {

    private List<String> corsAllowedOriginPatterns = new ArrayList<>(
            List.of("*")
    );

    private boolean swaggerEnabled = true;

    public void setCorsAllowedOriginPatterns(List<String> corsAllowedOriginPatterns) {
        this.corsAllowedOriginPatterns = corsAllowedOriginPatterns;
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
            normalizedPatterns.add("*");
        }
        return normalizedPatterns;
    }
}
