FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

COPY mvnw .
COPY pom.xml .
COPY src src

RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre

WORKDIR /

COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]