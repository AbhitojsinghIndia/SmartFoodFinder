
package com.smartfoodfinder.model;

import java.math.BigDecimal;

public class Ingredient {

    private Long id;
    private String ingredientName;
    private BigDecimal quantity;
    private String unit;
    private BigDecimal lowStockThreshold;

    public Ingredient() {
    }

    public Ingredient(Long id, String ingredientName, BigDecimal quantity,
                      String unit, BigDecimal lowStockThreshold) {
        this.id = id;
        this.ingredientName = ingredientName;
        this.quantity = quantity;
        this.unit = unit;
        this.lowStockThreshold = lowStockThreshold;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getIngredientName() {
        return ingredientName;
    }

    public void setIngredientName(String ingredientName) {
        this.ingredientName = ingredientName;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getLowStockThreshold() {
        return lowStockThreshold;
    }

    public void setLowStockThreshold(BigDecimal lowStockThreshold) {
        this.lowStockThreshold = lowStockThreshold;
    }
}
