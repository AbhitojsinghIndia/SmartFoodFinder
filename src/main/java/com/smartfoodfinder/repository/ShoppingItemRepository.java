
package com.smartfoodfinder.repository;

import com.smartfoodfinder.model.ShoppingItem;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class ShoppingItemRepository {

    private final JdbcTemplate jdbcTemplate;

    public ShoppingItemRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private final RowMapper<ShoppingItem> shoppingItemRowMapper =
            (rs, rowNum) -> {
                ShoppingItem item = new ShoppingItem();

                item.setId(rs.getLong("id"));
                item.setItemName(rs.getString("item_name"));
                item.setQuantity(rs.getBigDecimal("quantity"));
                item.setUnit(rs.getString("unit"));
                item.setPurchased(rs.getBoolean("purchased"));

                return item;
            };

    public List<ShoppingItem> findAll() {
        String sql = """
                SELECT id, item_name, quantity, unit, purchased
                FROM shopping_items
                ORDER BY id DESC
                """;

        return jdbcTemplate.query(sql, shoppingItemRowMapper);
    }

    public ShoppingItem addItem(ShoppingItem item) {
        String sql = """
                INSERT INTO shopping_items
                    (item_name, quantity, unit, purchased)
                VALUES (?, ?, ?, ?)
                """;

        jdbcTemplate.update(
                sql,
                item.getItemName(),
                item.getQuantity() == null
                        ? new java.math.BigDecimal("1.00")
                        : item.getQuantity(),
                item.getUnit() == null ? "pcs" : item.getUnit(),
                item.isPurchased()
        );

        Long id = jdbcTemplate.queryForObject(
                "SELECT LAST_INSERT_ID()", Long.class);

        return findById(id);
    }

    public ShoppingItem updateItem(Long id, ShoppingItem item) {
        String sql = """
                UPDATE shopping_items
                SET item_name = ?, quantity = ?, unit = ?, purchased = ?
                WHERE id = ?
                """;

        int rows = jdbcTemplate.update(
                sql,
                item.getItemName(),
                item.getQuantity(),
                item.getUnit(),
                item.isPurchased(),
                id
        );

        if (rows == 0) {
            throw new IllegalArgumentException("Shopping item not found: " + id);
        }

        return findById(id);
    }

    public void deleteItem(Long id) {
        int rows = jdbcTemplate.update(
                "DELETE FROM shopping_items WHERE id = ?", id);

        if (rows == 0) {
            throw new IllegalArgumentException("Shopping item not found: " + id);
        }
    }

    private ShoppingItem findById(Long id) {
        return jdbcTemplate.queryForObject(
                """
                SELECT id, item_name, quantity, unit, purchased
                FROM shopping_items
                WHERE id = ?
                """,
                shoppingItemRowMapper,
                id
        );
    }
}
