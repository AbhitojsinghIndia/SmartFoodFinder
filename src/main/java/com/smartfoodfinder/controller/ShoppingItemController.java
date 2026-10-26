
package com.smartfoodfinder.controller;

import com.smartfoodfinder.model.ShoppingItem;
import com.smartfoodfinder.repository.ShoppingItemRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/shopping-items")
public class ShoppingItemController {

    private final ShoppingItemRepository shoppingItemRepository;

    public ShoppingItemController(
            ShoppingItemRepository shoppingItemRepository) {
        this.shoppingItemRepository = shoppingItemRepository;
    }

    @GetMapping
    public List<ShoppingItem> getAllItems() {
        return shoppingItemRepository.findAll();
    }

    @PostMapping
    public ShoppingItem addItem(@RequestBody ShoppingItem item) {
        return shoppingItemRepository.addItem(item);
    }

    @PutMapping("/{id}")
    public ShoppingItem updateItem(
            @PathVariable Long id,
            @RequestBody ShoppingItem item) {
        return shoppingItemRepository.updateItem(id, item);
    }

    @DeleteMapping("/{id}")
    public String deleteItem(@PathVariable Long id) {
        shoppingItemRepository.deleteItem(id);
        return "Shopping item deleted successfully";
    }
}
