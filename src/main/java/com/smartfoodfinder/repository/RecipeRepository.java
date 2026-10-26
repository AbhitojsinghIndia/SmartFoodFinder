
package com.smartfoodfinder.repository;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Map;

@Repository
public class RecipeRepository {

    private final JdbcTemplate jdbcTemplate;

    public RecipeRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    public List<Map<String, Object>> findAllRecipes() {
        String sql = "SELECT * FROM indian_recipes";
        return jdbcTemplate.queryForList(sql);
    }

    public List<Map<String, Object>> searchRecipesByName(String name) {
        String sql = """
                SELECT *
                FROM indian_recipes
                WHERE recipe_name LIKE ?
                """;

        return jdbcTemplate.queryForList(sql, "%" + name + "%");
    }
}
