FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app

COPY .mvn .mvn
COPY mvnw .
COPY pom.xml .
COPY src src

RUN chmod +x mvnw && ./mvnw -q -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /
EXPOSE 8080
COPY --from=build /app/target/spring-boot-docker.jar /spring-boot-docker.jar
ENTRYPOINT ["java","-jar","/spring-boot-docker.jar"]
