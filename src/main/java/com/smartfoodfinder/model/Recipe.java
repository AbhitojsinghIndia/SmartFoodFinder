
package com.smartfoodfinder.model;

import java.math.BigDecimal;

public class Recipe {

    private Long id;
    private String name;
    private String ingredients;
    private String instructions;
    private String cuisine;
    private Integer preparationTime;
    private Integer cookingTime;
    private Integer servings;
    private BigDecimal calories;

    public Recipe() {
    }

    public Recipe(Long id, String name, String ingredients,
                  String instructions, String cuisine,
                  Integer preparationTime, Integer cookingTime,
                  Integer servings, BigDecimal calories) {
        this.id = id;
        this.name = name;
        this.ingredients = ingredients;
        this.instructions = instructions;
        this.cuisine = cuisine;
        this.preparationTime = preparationTime;
        this.cookingTime = cookingTime;
        this.servings = servings;
        this.calories = calories;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getIngredients() {
        return ingredients;
    }

    public void setIngredients(String ingredients) {
        this.ingredients = ingredients;
    }

    public String getInstructions() {
        return instructions;
    }

    public void setInstructions(String instructions) {
        this.instructions = instructions;
    }

    public String getCuisine() {
        return cuisine;
    }

    public void setCuisine(String cuisine) {
        this.cuisine = cuisine;
    }

    public Integer getPreparationTime() {
        return preparationTime;
    }

    public void setPreparationTime(Integer preparationTime) {
        this.preparationTime = preparationTime;
    }

    public Integer getCookingTime() {
        return cookingTime;
    }

    public void setCookingTime(Integer cookingTime) {
        this.cookingTime = cookingTime;
    }

    public Integer getServings() {
        return servings;
    }

    public void setServings(Integer servings) {
        this.servings = servings;
    }

    public BigDecimal getCalories() {
        return calories;
    }

    public void setCalories(BigDecimal calories) {
        this.calories = calories;
    }
}
