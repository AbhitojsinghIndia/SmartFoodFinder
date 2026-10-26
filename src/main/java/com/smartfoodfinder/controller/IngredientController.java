
package com.smartfoodfinder.controller;

import com.smartfoodfinder.model.Ingredient;
import com.smartfoodfinder.repository.IngredientRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/kitchen/ingredients")
public class IngredientController {

    private final IngredientRepository ingredientRepository;

    public IngredientController(IngredientRepository ingredientRepository) {
        this.ingredientRepository = ingredientRepository;
    }

    @GetMapping
    public List<Ingredient> getAllIngredients() {
        return ingredientRepository.findAll();
    }

    @PostMapping
    public Ingredient addIngredient(@RequestBody Ingredient ingredient) {
        return ingredientRepository.addIngredient(ingredient);
    }

    @PutMapping("/{id}")
    public Ingredient updateIngredient(
            @PathVariable Long id,
            @RequestBody Ingredient ingredient) {
        return ingredientRepository.updateIngredient(id, ingredient);
    }

    @DeleteMapping("/{id}")
    public String deleteIngredient(@PathVariable Long id) {
        ingredientRepository.deleteIngredient(id);
        return "Ingredient deleted successfully";
    }
}
