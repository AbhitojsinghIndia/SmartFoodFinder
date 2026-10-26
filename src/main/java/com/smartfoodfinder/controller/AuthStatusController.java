
package com.smartfoodfinder.controller;

import com.smartfoodfinder.repository.UserRepository;
import com.smartfoodfinder.model.User;

import java.util.Map;
import java.util.Optional;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthStatusController {

    private final UserRepository userRepository;

    public AuthStatusController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @GetMapping("/me")
    public Map<String, Object> getCurrentUser(
            Authentication authentication) {

        if (authentication == null
                || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {

            return Map.of("authenticated", false);
        }

        Optional<User> user =
                userRepository.findByEmail(authentication.getName());

        if (user.isEmpty()) {
            return Map.of("authenticated", false);
        }

        User currentUser = user.get();

        return Map.of(
                "authenticated", true,
                "fullName", currentUser.getFullName(),
                "email", currentUser.getEmail()
        );
    }
}
