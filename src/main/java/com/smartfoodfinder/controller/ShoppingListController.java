
package com.smartfoodfinder.controller;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/shopping")
public class ShoppingListController {

    private final JdbcTemplate jdbcTemplate;

    public ShoppingListController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // =========================================
    // CURRENT SHOPPING LIST
    // =========================================

    @GetMapping("/current")
    public Map<String, Object> getCurrentShoppingList() {
        long listId = getOrCreateCurrentListId();
        return getListWithItems(listId);
    }

    // =========================================
    // SHOPPING HISTORY
    // =========================================

    @GetMapping("/history")
    public List<Map<String, Object>> getShoppingHistory() {
        List<Map<String, Object>> history = jdbcTemplate.queryForList(
            """
            SELECT id,
                   status,
                   created_at AS createdAt,
                   completed_at AS completedAt,
                   total_spent AS totalSpent
            FROM shopping_lists
            WHERE status = 'COMPLETED'
            ORDER BY completed_at DESC, id DESC
            """
        );

        for (Map<String, Object> trip : history) {
            long id = ((Number) trip.get("id")).longValue();
            trip.put("items", getItemsForList(id));
        }

        return history;
    }

    // =========================================
    // ADD ITEM
    // POST /api/shopping/items
    // =========================================

    @PostMapping("/items")
    @Transactional
    public Map<String, Object> addItem(
            @RequestBody Map<String, Object> body) {

        long listId = getOrCreateCurrentListId();

        String name = requiredName(
            body.getOrDefault("itemName", body.get("name"))
        );

        BigDecimal quantity = requiredQuantity(
            body.getOrDefault("plannedQuantity", body.get("quantity"))
        );

        String unit = requiredUnit(body.get("unit"));

        ensureNoDuplicate(listId, name, null);

        jdbcTemplate.update(
            """
            INSERT INTO shopping_list_items
                (shopping_list_id, item_name, planned_quantity, unit)
            VALUES (?, ?, ?, ?)
            """,
            listId, name, quantity, unit
        );

        return findCurrentItem(listId, name);
    }

    // =========================================
    // UPDATE ITEM
    // PUT /api/shopping/items/{itemId}
    // =========================================

    @PutMapping("/items/{itemId}")
    @Transactional
    public Map<String, Object> updateItem(
            @PathVariable long itemId,
            @RequestBody Map<String, Object> body) {

        long listId = getOrCreateCurrentListId();
        findItemInList(listId, itemId);

        String name = requiredName(
            body.getOrDefault("itemName", body.get("name"))
        );

        BigDecimal quantity = requiredQuantity(
            body.getOrDefault("plannedQuantity", body.get("quantity"))
        );

        String unit = requiredUnit(body.get("unit"));

        ensureNoDuplicate(listId, name, itemId);

        jdbcTemplate.update(
            """
            UPDATE shopping_list_items
            SET item_name = ?,
                planned_quantity = ?,
                unit = ?
            WHERE id = ?
              AND shopping_list_id = ?
            """,
            name, quantity, unit, itemId, listId
        );

        return findItemInList(listId, itemId);
    }

    // =========================================
    // DELETE ITEM FROM CURRENT LIST
    // DELETE /api/shopping/items/{itemId}
    // =========================================

    @DeleteMapping("/items/{itemId}")
    @Transactional
    public ResponseEntity<Void> deleteItem(
            @PathVariable long itemId) {

        long listId = getOrCreateCurrentListId();
        findItemInList(listId, itemId);

        jdbcTemplate.update(
            """
            DELETE FROM shopping_list_items
            WHERE id = ?
              AND shopping_list_id = ?
            """,
            itemId, listId
        );

        return ResponseEntity.noContent().build();
    }

    // =========================================
    // MARK ITEM AS PURCHASED
    // PATCH /api/shopping/items/{itemId}/purchased
    // =========================================

    @PatchMapping("/items/{itemId}/purchased")
    @Transactional
    public Map<String, Object> updatePurchasedStatus(
            @PathVariable long itemId,
            @RequestBody Map<String, Object> body) {

        long listId = getOrCreateCurrentListId();
        findItemInList(listId, itemId);

        Object rawValue = body.get("purchased");

        if (!(rawValue instanceof Boolean purchased)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "The purchased field must be true or false."
            );
        }

        jdbcTemplate.update(
            """
            UPDATE shopping_list_items
            SET purchased = ?
            WHERE id = ?
              AND shopping_list_id = ?
            """,
            purchased, itemId, listId
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", itemId);
        result.put("purchased", purchased);
        return result;
    }

    // =========================================
    // COMPLETE SHOPPING TRIP
    // POST /api/shopping/complete
    // =========================================

    @PostMapping("/complete")
    @Transactional
    public Map<String, Object> completeShoppingTrip(
            @RequestBody Map<String, Object> body) {

        long listId = getOrCreateCurrentListId();
        List<Map<String, Object>> currentItems = getItemsForList(listId);

        if (currentItems.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Add items before completing a shopping trip."
            );
        }

        Object rawItems = body.get("items");

        if (!(rawItems instanceof List<?> requestedItems)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "A list of purchase items is required."
            );
        }

        Map<Long, Map<?, ?>> requestedById = new LinkedHashMap<>();

        for (Object object : requestedItems) {
            if (!(object instanceof Map<?, ?> item)) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Invalid purchase item."
                );
            }

            long id = requiredId(item.get("id"));

            if (requestedById.putIfAbsent(id, item) != null) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Duplicate purchase item."
                );
            }
        }

        for (Long requestedId : requestedById.keySet()) {
            findItemInList(listId, requestedId);
        }

        boolean updateKitchen = Boolean.TRUE.equals(body.get("updateKitchen"));
        BigDecimal totalSpent = BigDecimal.ZERO;
        boolean anyPurchased = false;

        for (Map<String, Object> currentItem : currentItems) {
            long itemId =
                ((Number) currentItem.get("id")).longValue();

            Map<?, ?> purchase = requestedById.get(itemId);

            if (purchase == null ||
                !Boolean.TRUE.equals(purchase.get("purchased"))) {

                jdbcTemplate.update(
                    """
                    UPDATE shopping_list_items
                    SET purchased = FALSE,
                        bought_quantity = NULL,
                        total_price_paid = NULL,
                        unit_price = NULL,
                        price_unit = NULL
                    WHERE id = ?
                      AND shopping_list_id = ?
                    """,
                    itemId, listId
                );

                continue;
            }

            BigDecimal boughtQuantity =
                requiredQuantity(purchase.get("boughtQuantity"));

            BigDecimal price =
                requiredPrice(purchase.get("totalPricePaid"));

            String unit = String.valueOf(currentItem.get("unit"));

            Map<String, Object> priceInfo =
                calculateUnitPrice(boughtQuantity, unit, price);

            jdbcTemplate.update(
                """
                UPDATE shopping_list_items
                SET purchased = TRUE,
                    bought_quantity = ?,
                    total_price_paid = ?,
                    unit_price = ?,
                    price_unit = ?
                WHERE id = ?
                  AND shopping_list_id = ?
                """,
                boughtQuantity,
                price,
                priceInfo.get("unitPrice"),
                priceInfo.get("priceUnit"),
                itemId,
                listId
            );

            if (updateKitchen) {
                updateKitchenInventory(
                    String.valueOf(currentItem.get("itemName")),
                    boughtQuantity,
                    unit
                );
            }

            totalSpent = totalSpent.add(price);
            anyPurchased = true;
        }

        if (!anyPurchased) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Select at least one purchased item."
            );
        }

        jdbcTemplate.update(
            """
            UPDATE shopping_lists
            SET status = 'COMPLETED',
                completed_at = CURRENT_TIMESTAMP,
                total_spent = ?
            WHERE id = ?
              AND status = 'CURRENT'
            """,
            totalSpent, listId
        );

        createCurrentList();

        return getListWithItems(listId);
    }

    // =========================================
    // REUSE COMPLETED SHOPPING LIST
    // POST /api/shopping/history/{historyId}/reuse
    // =========================================

    @PostMapping("/history/{historyId}/reuse")
    @Transactional
    public Map<String, Object> reuseShoppingList(
            @PathVariable long historyId) {

        List<Long> completedLists = jdbcTemplate.query(
            """
            SELECT id
            FROM shopping_lists
            WHERE id = ?
              AND status = 'COMPLETED'
            """,
            (rs, rowNum) -> rs.getLong("id"),
            historyId
        );

        if (completedLists.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Completed shopping list not found."
            );
        }

        long currentListId = getOrCreateCurrentListId();

        jdbcTemplate.update(
            """
            DELETE FROM shopping_list_items
            WHERE shopping_list_id = ?
            """,
            currentListId
        );

        jdbcTemplate.update(
            """
            INSERT INTO shopping_list_items
                (shopping_list_id, item_name, planned_quantity, unit,
                 purchased, bought_quantity, total_price_paid,
                 unit_price, price_unit)
            SELECT ?,
                   item_name,
                   planned_quantity,
                   unit,
                   FALSE,
                   NULL,
                   NULL,
                   NULL,
                   NULL
            FROM shopping_list_items
            WHERE shopping_list_id = ?
            """,
            currentListId, historyId
        );

        return getListWithItems(currentListId);
    }

    // =========================================
    // DELETE ONE COMPLETED TRIP
    // DELETE /api/shopping/history/{historyId}
    // =========================================

    @DeleteMapping("/history/{historyId}")
    @Transactional
    public ResponseEntity<Void> deleteShoppingHistory(
            @PathVariable long historyId) {

        List<Long> completedTrips = jdbcTemplate.query(
            """
            SELECT id
            FROM shopping_lists
            WHERE id = ?
              AND status = 'COMPLETED'
            """,
            (rs, rowNum) -> rs.getLong("id"),
            historyId
        );

        if (completedTrips.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Completed shopping trip not found."
            );
        }

        jdbcTemplate.update(
            """
            DELETE FROM shopping_list_items
            WHERE shopping_list_id = ?
              AND EXISTS (
                  SELECT 1
                  FROM shopping_lists
                  WHERE id = ?
                    AND status = 'COMPLETED'
              )
            """,
            historyId, historyId
        );

        jdbcTemplate.update(
            """
            DELETE FROM shopping_lists
            WHERE id = ?
              AND status = 'COMPLETED'
            """,
            historyId
        );

        return ResponseEntity.noContent().build();
    }

    // =========================================
    // CLEAR ALL COMPLETED HISTORY
    // DELETE /api/shopping/history
    // =========================================

    @DeleteMapping("/history")
    @Transactional
    public ResponseEntity<Void> clearShoppingHistory() {

        jdbcTemplate.update(
            """
            DELETE FROM shopping_list_items
            WHERE shopping_list_id IN (
                SELECT id
                FROM (
                    SELECT id
                    FROM shopping_lists
                    WHERE status = 'COMPLETED'
                ) AS completed_trips
            )
            """
        );

        jdbcTemplate.update(
            """
            DELETE FROM shopping_lists
            WHERE status = 'COMPLETED'
            """
        );

        return ResponseEntity.noContent().build();
    }

    // =========================================
    // UPDATE MY KITCHEN AFTER PURCHASE
    // =========================================

    private void updateKitchenInventory(
            String itemName,
            BigDecimal boughtQuantity,
            String boughtUnit) {

        List<Map<String, Object>> matches = jdbcTemplate.queryForList(
            """
            SELECT id, ingredient_name AS ingredientName,
                   quantity, unit
            FROM kitchen_inventory
            WHERE LOWER(TRIM(ingredient_name)) = LOWER(TRIM(?))
            ORDER BY id
            """,
            itemName
        );

        if (matches.isEmpty()) {
            jdbcTemplate.update(
                """
                INSERT INTO kitchen_inventory
                    (ingredient_name, quantity, unit, low_stock_threshold)
                VALUES (?, ?, ?, ?)
                """,
                itemName,
                boughtQuantity,
                boughtUnit,
                new BigDecimal("1.00")
            );
            return;
        }

        Map<String, Object> compatibleMatch = null;

        for (Map<String, Object> match : matches) {
            String existingUnit = String.valueOf(match.get("unit"));
            if (sameUnitFamily(existingUnit, boughtUnit)) {
                compatibleMatch = match;
                break;
            }
        }

        if (compatibleMatch == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Cannot update My Kitchen for '" + itemName
                    + "': the existing inventory uses an incompatible unit."
            );
        }

        long ingredientId = ((Number) compatibleMatch.get("id")).longValue();
        BigDecimal existingQuantity = new BigDecimal(
            compatibleMatch.get("quantity").toString()
        );
        String existingUnit = String.valueOf(compatibleMatch.get("unit"));

        BigDecimal convertedBoughtQuantity =
            convertQuantity(boughtQuantity, boughtUnit, existingUnit);
        BigDecimal newQuantity = existingQuantity.add(convertedBoughtQuantity);

        jdbcTemplate.update(
            """
            UPDATE kitchen_inventory
            SET quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            newQuantity,
            ingredientId
        );
    }

    private boolean sameUnitFamily(String firstUnit, String secondUnit) {
        return unitFamily(firstUnit).equals(unitFamily(secondUnit));
    }

    private String unitFamily(String unit) {
        String normalized = unit == null
            ? ""
            : unit.trim().toLowerCase(Locale.ROOT);

        return switch (normalized) {
            case "g", "kg" -> "mass";
            case "ml", "l", "litre", "liter" -> "volume";
            case "piece", "pieces", "pcs" -> "piece";
            case "pack", "packet" -> "pack";
            default -> "unsupported";
        };
    }

    private BigDecimal convertQuantity(
            BigDecimal quantity,
            String fromUnit,
            String toUnit) {

        String from = fromUnit.trim().toLowerCase(Locale.ROOT);
        String to = toUnit.trim().toLowerCase(Locale.ROOT);

        if (!sameUnitFamily(from, to)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Cannot combine incompatible inventory units: "
                    + fromUnit + " and " + toUnit + "."
            );
        }

        if (from.equals(to)) {
            return quantity;
        }

        BigDecimal baseQuantity;

        switch (from) {
            case "g" -> baseQuantity = quantity;
            case "kg" -> baseQuantity = quantity.multiply(new BigDecimal("1000"));
            case "ml" -> baseQuantity = quantity;
            case "l", "litre", "liter" ->
                baseQuantity = quantity.multiply(new BigDecimal("1000"));
            default -> baseQuantity = quantity;
        }

        return switch (to) {
            case "kg", "l", "litre", "liter" ->
                baseQuantity.divide(new BigDecimal("1000"), 8, RoundingMode.HALF_UP);
            default -> baseQuantity;
        };
    }

    // =========================================
    // CURRENT LIST HELPERS
    // =========================================

    private long getOrCreateCurrentListId() {
        List<Long> ids = jdbcTemplate.query(
            """
            SELECT id
            FROM shopping_lists
            WHERE status = 'CURRENT'
            ORDER BY id DESC
            LIMIT 1
            """,
            (rs, rowNum) -> rs.getLong("id")
        );

        if (!ids.isEmpty()) {
            return ids.get(0);
        }

        return createCurrentList();
    }

    private long createCurrentList() {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection ->
            connection.prepareStatement(
                "INSERT INTO shopping_lists (status) VALUES ('CURRENT')",
                Statement.RETURN_GENERATED_KEYS
            ),
            keyHolder
        );

        Number key = keyHolder.getKey();

        if (key == null) {
            throw new IllegalStateException(
                "Could not create a shopping list."
            );
        }

        return key.longValue();
    }

    private Map<String, Object> getListWithItems(long listId) {
        Map<String, Object> result = jdbcTemplate.queryForMap(
            """
            SELECT id,
                   status,
                   created_at AS createdAt,
                   completed_at AS completedAt,
                   total_spent AS totalSpent
            FROM shopping_lists
            WHERE id = ?
            """,
            listId
        );

        result.put("items", getItemsForList(listId));
        return result;
    }

    private List<Map<String, Object>> getItemsForList(long listId) {
        return jdbcTemplate.queryForList(
            """
            SELECT id,
                   item_name AS itemName,
                   planned_quantity AS plannedQuantity,
                   unit,
                   purchased,
                   bought_quantity AS boughtQuantity,
                   total_price_paid AS totalPricePaid,
                   unit_price AS unitPrice,
                   price_unit AS priceUnit
            FROM shopping_list_items
            WHERE shopping_list_id = ?
            ORDER BY id
            """,
            listId
        );
    }

    private Map<String, Object> findCurrentItem(
            long listId, String name) {

        List<Map<String, Object>> matches = jdbcTemplate.queryForList(
            """
            SELECT id,
                   item_name AS itemName,
                   planned_quantity AS plannedQuantity,
                   unit,
                   purchased
            FROM shopping_list_items
            WHERE shopping_list_id = ?
              AND LOWER(item_name) = LOWER(?)
            ORDER BY id DESC
            LIMIT 1
            """,
            listId, name
        );

        if (matches.isEmpty()) {
            throw new IllegalStateException(
                "The saved shopping item could not be found."
            );
        }

        return matches.get(0);
    }

    private Map<String, Object> findItemInList(
            long listId, long itemId) {

        List<Map<String, Object>> items = jdbcTemplate.queryForList(
            """
            SELECT id,
                   item_name AS itemName,
                   planned_quantity AS plannedQuantity,
                   unit,
                   purchased
            FROM shopping_list_items
            WHERE id = ?
              AND shopping_list_id = ?
            """,
            itemId, listId
        );

        if (items.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Shopping item not found."
            );
        }

        return items.get(0);
    }

    private void ensureNoDuplicate(
            long listId, String name, Long excludedId) {

        List<Long> matches = jdbcTemplate.query(
            """
            SELECT id
            FROM shopping_list_items
            WHERE shopping_list_id = ?
              AND LOWER(item_name) = LOWER(?)
            """,
            (rs, rowNum) -> rs.getLong("id"),
            listId, name
        );

        boolean duplicate = matches.stream().anyMatch(id ->
            excludedId == null || id.longValue() != excludedId.longValue()
        );

        if (duplicate) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "This grocery already exists on the current shopping list."
            );
        }
    }

    // =========================================
    // PRICE CALCULATION
    // =========================================

    private Map<String, Object> calculateUnitPrice(
            BigDecimal quantity,
            String unit,
            BigDecimal totalPrice) {

        String normalUnit = unit.toLowerCase(Locale.ROOT);
        BigDecimal baseQuantity = quantity;
        String priceUnit = unit;

        if (normalUnit.equals("g")) {
            baseQuantity = quantity.divide(
                new BigDecimal("1000"), 8, RoundingMode.HALF_UP
            );
            priceUnit = "kg";
        } else if (normalUnit.equals("kg")) {
            priceUnit = "kg";
        } else if (normalUnit.equals("ml")) {
            baseQuantity = quantity.divide(
                new BigDecimal("1000"), 8, RoundingMode.HALF_UP
            );
            priceUnit = "litre";
        } else if (normalUnit.equals("l") ||
                   normalUnit.equals("litre")) {
            priceUnit = "litre";
        } else if (normalUnit.equals("piece") ||
                   normalUnit.equals("pieces") ||
                   normalUnit.equals("pcs")) {
            priceUnit = "piece";
        } else {
            priceUnit = "pack";
        }

        BigDecimal unitPrice = totalPrice.divide(
            baseQuantity, 4, RoundingMode.HALF_UP
        );

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("unitPrice", unitPrice);
        result.put("priceUnit", priceUnit);
        return result;
    }

    // =========================================
    // VALIDATION HELPERS
    // =========================================

    private String requiredName(Object value) {
        String name = value == null ? "" : value.toString().trim();

        if (name.isBlank() || name.length() > 100) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Grocery name must contain 1 to 100 characters."
            );
        }

        return name;
    }

    private String requiredUnit(Object value) {
        String unit = value == null
            ? ""
            : value.toString().trim().toLowerCase(Locale.ROOT);

        List<String> allowedUnits = List.of(
            "kg", "g", "litre", "l", "ml",
            "piece", "pieces", "pcs", "pack", "packet"
        );

        if (!allowedUnits.contains(unit)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Choose a supported grocery unit."
            );
        }

        return unit;
    }

    private BigDecimal requiredQuantity(Object value) {
        BigDecimal quantity = decimalValue(value, "quantity");

        if (quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Quantity must be greater than zero."
            );
        }

        return quantity;
    }

    private BigDecimal requiredPrice(Object value) {
        BigDecimal price = decimalValue(value, "price");

        if (price.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Price cannot be negative."
            );
        }

        return price;
    }

    private BigDecimal decimalValue(Object value, String field) {
        try {
            if (value == null || value.toString().isBlank()) {
                throw new NumberFormatException();
            }

            return new BigDecimal(value.toString());
        } catch (NumberFormatException exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Enter a valid number for " + field + "."
            );
        }
    }

    private long requiredId(Object value) {
        try {
            return Long.parseLong(value.toString());
        } catch (Exception exception) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "A valid item ID is required."
            );
        }
    }
}
