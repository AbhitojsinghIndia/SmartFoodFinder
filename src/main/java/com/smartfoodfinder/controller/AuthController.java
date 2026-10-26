
package com.smartfoodfinder.controller;

import com.smartfoodfinder.model.User;
import com.smartfoodfinder.repository.UserRepository;
import jakarta.validation.constraints.Email;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;


import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    public AuthController(
            UserRepository userRepository,
            PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    public record RegistrationRequest(
            @NotBlank
            @Size(max = 100)
            String fullName,

            @NotBlank
            @Email
            @Size(max = 255)
            String email,

            @NotBlank
            @Size(min = 8, max = 72)
            String password
    ) {}

    @PostMapping("/register")
    public ResponseEntity<?> register(
            @Valid @RequestBody RegistrationRequest request) {

        String fullName = request.fullName().trim();
        String email = request.email().trim().toLowerCase();

        if (userRepository.findByEmail(email).isPresent()) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "An account with this email already exists."
                    ));
        }

        String passwordHash =
                passwordEncoder.encode(request.password());

        try {
            User user = userRepository.saveLocalUser(
                    fullName,
                    email,
                    passwordHash
            );

            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(Map.of(
                            "message", "Registration successful.",
                            "id", user.getId(),
                            "fullName", user.getFullName(),
                            "email", user.getEmail()
                    ));

        } catch (DuplicateKeyException exception) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(Map.of(
                            "message",
                            "An account with this email already exists."
                    ));
        }
    }
}
