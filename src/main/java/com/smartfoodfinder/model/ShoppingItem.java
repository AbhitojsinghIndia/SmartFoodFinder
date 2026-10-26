
package com.smartfoodfinder.model;

import java.math.BigDecimal;

public class ShoppingItem {

    private Long id;
    private String itemName;
    private BigDecimal quantity;
    private String unit;
    private boolean purchased;

    public ShoppingItem() {
    }

    public ShoppingItem(Long id, String itemName, BigDecimal quantity,
                        String unit, boolean purchased) {
        this.id = id;
        this.itemName = itemName;
        this.quantity = quantity;
        this.unit = unit;
        this.purchased = purchased;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getItemName() {
        return itemName;
    }

    public void setItemName(String itemName) {
        this.itemName = itemName;
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

    public boolean isPurchased() {
        return purchased;
    }

    public void setPurchased(boolean purchased) {
        this.purchased = purchased;
    }
}
