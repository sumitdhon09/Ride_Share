package com.example.backend.config;

import com.example.backend.security.WebSocketAuthChannelInterceptor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@ConditionalOnProperty(prefix = "app.websocket", name = "enabled", havingValue = "true", matchIfMissing = true)
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketAuthChannelInterceptor webSocketAuthChannelInterceptor;
    private final AppSecurityProperties appSecurityProperties;

    public WebSocketConfig(
            WebSocketAuthChannelInterceptor webSocketAuthChannelInterceptor,
            AppSecurityProperties appSecurityProperties
    ) {
        this.webSocketAuthChannelInterceptor = webSocketAuthChannelInterceptor;
        this.appSecurityProperties = appSecurityProperties;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(appSecurityProperties.getNormalizedCorsAllowedOriginPatterns().toArray(String[]::new));
        registry.addEndpoint("/ws-sockjs")
                .setAllowedOriginPatterns(appSecurityProperties.getNormalizedCorsAllowedOriginPatterns().toArray(String[]::new))
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/topic", "/queue");
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registry) {
        registry.setMessageSizeLimit(64 * 1024);
        registry.setSendBufferSizeLimit(512 * 1024);
        registry.setSendTimeLimit(10_000);
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(webSocketAuthChannelInterceptor);
    }
}
