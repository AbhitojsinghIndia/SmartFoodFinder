
package com.smartfoodfinder.repository;

import com.smartfoodfinder.model.User;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class UserRepository {

    private final JdbcTemplate jdbcTemplate;

    public UserRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<User> userRowMapper = (rs, rowNum) ->
        new User(
            rs.getLong("id"),
            rs.getString("full_name"),
            rs.getString("email"),
            rs.getString("password_hash"),
            rs.getString("provider")
        );

    public Optional<User> findByEmail(String email) {
        String sql = """
            SELECT id, full_name, email, password_hash, provider
            FROM users
            WHERE LOWER(email) = LOWER(?)
            LIMIT 1
            """;

        return jdbcTemplate.query(
            sql,
            userRowMapper,
            email.trim()
        ).stream().findFirst();
    }

    public User saveLocalUser(
            String fullName,
            String email,
            String passwordHash) {

        String sql = """
            INSERT INTO users
                (full_name, email, password_hash, provider)
            VALUES (?, ?, ?, 'LOCAL')
            """;

        jdbcTemplate.update(
            sql,
            fullName.trim(),
            email.trim().toLowerCase(),
            passwordHash
        );

        return findByEmail(email)
            .orElseThrow(() ->
                new IllegalStateException(
                    "User was saved but could not be retrieved."
                )
            );
    }
}
