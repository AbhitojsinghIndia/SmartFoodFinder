
package com.smartfoodfinder.controller;

import com.smartfoodfinder.repository.RecipeRepository;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/recipes")
public class RecipeController {

    private final RecipeRepository recipeRepository;

    public RecipeController(RecipeRepository recipeRepository) {
        this.recipeRepository = recipeRepository;
    }

    @GetMapping
    public Object getAllRecipes() {
        return recipeRepository.findAllRecipes();
    }

    @GetMapping("/search")
    public Object searchRecipes(@RequestParam String name) {
        return recipeRepository.searchRecipesByName(name);
    }
}
