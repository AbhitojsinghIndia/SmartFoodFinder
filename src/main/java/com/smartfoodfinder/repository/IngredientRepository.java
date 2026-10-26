
package com.smartfoodfinder.repository;

import com.smartfoodfinder.model.Ingredient;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public class IngredientRepository {

    private final JdbcTemplate jdbcTemplate;

    public IngredientRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<Ingredient> ingredientRowMapper = (rs, rowNum) -> {
        Ingredient ingredient = new Ingredient();

        ingredient.setId(rs.getLong("id"));
        ingredient.setIngredientName(rs.getString("ingredient_name"));
        ingredient.setQuantity(rs.getBigDecimal("quantity"));
        ingredient.setUnit(rs.getString("unit"));
        ingredient.setLowStockThreshold(
                rs.getBigDecimal("low_stock_threshold"));

        return ingredient;
    };

    public List<Ingredient> findAll() {
        String sql = """
                SELECT id, ingredient_name, quantity, unit,
                       low_stock_threshold
                FROM kitchen_inventory
                ORDER BY ingredient_name
                """;

        return jdbcTemplate.query(sql, ingredientRowMapper);
    }

    public Ingredient addIngredient(Ingredient ingredient) {
        BigDecimal threshold = ingredient.getLowStockThreshold() == null
                ? new BigDecimal("1.00")
                : ingredient.getLowStockThreshold();

        String updateSql = """
                UPDATE kitchen_inventory
                SET quantity = quantity + ?
                WHERE LOWER(TRIM(ingredient_name)) = LOWER(TRIM(?))
                  AND LOWER(TRIM(unit)) = LOWER(TRIM(?))
                """;

        int rowsUpdated = jdbcTemplate.update(
                updateSql,
                ingredient.getQuantity(),
                ingredient.getIngredientName(),
                ingredient.getUnit()
        );

        if (rowsUpdated == 0) {
            String insertSql = """
                    INSERT INTO kitchen_inventory
                        (ingredient_name, quantity, unit, low_stock_threshold)
                    VALUES (?, ?, ?, ?)
                    """;

            jdbcTemplate.update(
                    insertSql,
                    ingredient.getIngredientName().trim(),
                    ingredient.getQuantity(),
                    ingredient.getUnit().trim(),
                    threshold
            );
        }

        return findByNameAndUnit(
                ingredient.getIngredientName().trim(),
                ingredient.getUnit().trim()
        );
    }

    public Ingredient updateIngredient(Long id, Ingredient ingredient) {
        String sql = """
                UPDATE kitchen_inventory
                SET ingredient_name = ?, quantity = ?, unit = ?,
                    low_stock_threshold = ?
                WHERE id = ?
                """;

        int rows = jdbcTemplate.update(
                sql,
                ingredient.getIngredientName(),
                ingredient.getQuantity(),
                ingredient.getUnit(),
                ingredient.getLowStockThreshold() == null
                        ? new BigDecimal("1.00")
                        : ingredient.getLowStockThreshold(),
                id
        );

        if (rows == 0) {
            throw new IllegalArgumentException("Ingredient not found: " + id);
        }

        return jdbcTemplate.queryForObject(
                """
                SELECT id, ingredient_name, quantity, unit,
                       low_stock_threshold
                FROM kitchen_inventory
                WHERE id = ?
                """,
                ingredientRowMapper,
                id
        );
    }

    public void deleteIngredient(Long id) {
        int rows = jdbcTemplate.update(
                "DELETE FROM kitchen_inventory WHERE id = ?", id);

        if (rows == 0) {
            throw new IllegalArgumentException("Ingredient not found: " + id);
        }
    }

    private Ingredient findByNameAndUnit(String name, String unit) {
        return jdbcTemplate.queryForObject(
                """
                SELECT id, ingredient_name, quantity, unit,
                       low_stock_threshold
                FROM kitchen_inventory
                WHERE LOWER(TRIM(ingredient_name)) = LOWER(TRIM(?))
                  AND LOWER(TRIM(unit)) = LOWER(TRIM(?))
                """,
                ingredientRowMapper,
                name,
                unit
        );
    }
}
