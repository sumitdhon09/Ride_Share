package com.example.backend.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.io.InputStream;
import java.util.Properties;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.MutablePropertySources;
import org.springframework.core.env.PropertiesPropertySource;
import org.springframework.core.env.PropertySourcesPropertyResolver;
import org.springframework.core.env.StandardEnvironment;

class AiPropertyAliasTest {

    @Test
    void openRouterPropertiesResolveToExistingAnthropicConfiguration() throws IOException {
        Properties applicationProperties = new Properties();
        try (InputStream inputStream = getClass().getClassLoader().getResourceAsStream("application.properties")) {
            applicationProperties.load(inputStream);
        }

        StandardEnvironment environment = new StandardEnvironment();
        MutablePropertySources propertySources = environment.getPropertySources();
        propertySources.addFirst(new MapPropertySource("testOverrides", java.util.Map.of(
                "OPENROUTER_API_KEY", "sk-or-v1-test",
                "OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"
        )));
        propertySources.addLast(new PropertiesPropertySource("applicationProperties", applicationProperties));

        PropertySourcesPropertyResolver resolver = new PropertySourcesPropertyResolver(propertySources);
        String apiKeyExpression = applicationProperties.getProperty("app.ai.anthropic.api-key");
        String baseUrlExpression = applicationProperties.getProperty("app.ai.anthropic.base-url");

        assertThat(resolver.resolveRequiredPlaceholders(apiKeyExpression)).isEqualTo("sk-or-v1-test");
        assertThat(resolver.resolveRequiredPlaceholders(baseUrlExpression)).isEqualTo("https://openrouter.ai/api/v1");
    }
}
