
 // ==================================================
// SMARTFOODFINDER — RECIPE FINDER
// Search, pagination, recipe details and kitchen suggestions
// ==================================================

document.addEventListener("DOMContentLoaded", initializeRecipePage);

const RECIPE_API_URL = "/api/recipes";
const KITCHEN_API_URL = "/api/kitchen/ingredients";

const RECIPES_PER_PAGE = 9;
const INITIAL_KITCHEN_SUGGESTIONS = 3;
const KITCHEN_SUGGESTION_STEP = 3;
const MAX_KITCHEN_SUGGESTIONS = 12;

let allRecipes = [];
let currentPage = 1;
let currentSearch = "";
let requestNumber = 0;

// Kitchen suggestion state
let kitchenSuggestionRecipes = [];
let visibleKitchenSuggestions = INITIAL_KITCHEN_SUGGESTIONS;

// ==================================================
// INITIALIZE PAGE
// ==================================================

function initializeRecipePage() {
    const form = document.getElementById("recipe-search-form");
    const input = document.getElementById("recipe-search-input");
    const clearButton = document.getElementById("clear-recipe-search");
    const previousButton = document.getElementById("previous-page");
    const nextButton = document.getElementById("next-page");
    const showAllButton = document.getElementById("show-all-recipes");
    const showMoreKitchenButton = document.getElementById(
        "show-more-kitchen-recipes"
    );

    form?.addEventListener("submit", event => {
        event.preventDefault();
        loadRecipes(input?.value.trim() || "");
    });

    clearButton?.addEventListener("click", () => {
        if (input) {
            input.value = "";
        }

        loadRecipes("");
    });

    previousButton?.addEventListener("click", () => {
        changePage(currentPage - 1);
    });

    nextButton?.addEventListener("click", () => {
        changePage(currentPage + 1);
    });

    showAllButton?.addEventListener("click", () => {
        if (input) {
            input.value = "";
        }

        loadRecipes("");
    });

    // Reveal three more kitchen suggestions per click.
    showMoreKitchenButton?.addEventListener("click", () => {
        visibleKitchenSuggestions = Math.min(
            visibleKitchenSuggestions + KITCHEN_SUGGESTION_STEP,
            kitchenSuggestionRecipes.length
        );

        renderKitchenSuggestions();
    });

    const initialSearch =
        new URLSearchParams(window.location.search).get("name") || "";

    if (input) {
        input.value = initialSearch;
    }

    loadRecipes(initialSearch, false);
    loadKitchenSuggestions();
    initializeRecipeModal();
}

// ==================================================
// FETCH AND FILTER ALL RECIPES
// ==================================================

async function loadRecipes(searchTerm = "", updateURL = true) {
    const thisRequest = ++requestNumber;

    currentSearch = searchTerm;
    currentPage = 1;
    allRecipes = [];

    updateSearchControls();
    showEmptyState(false);
    showStatus("Loading recipes...");

    const grid = document.getElementById("recipe-grid");
    const count = document.getElementById("recipe-results-count");

    if (grid) {
        grid.replaceChildren();
        grid.setAttribute("aria-busy", "true");
    }

    if (count) {
        count.textContent = "Loading...";
    }

    if (updateURL) {
        const url = new URL(window.location.href);

        if (searchTerm) {
            url.searchParams.set("name", searchTerm);
        } else {
            url.searchParams.delete("name");
        }

        window.history.replaceState({}, "", url);
    }

    try {
        const response = await fetch(RECIPE_API_URL, {
            headers: {
                Accept: "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(
                `Recipe API returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (thisRequest !== requestNumber) {
            return;
        }

        if (!Array.isArray(data)) {
            throw new Error("The recipe API did not return an array.");
        }

        const query = searchTerm.toLowerCase();

        allRecipes = query
            ? data.filter(recipe => {
                const originalName = String(
                    recipe.recipe_original || ""
                ).toLowerCase();

                const finalName = String(
                    recipe.final_food_name || ""
                ).toLowerCase();

                const recipeName = String(
                    recipe.recipe_name || ""
                ).toLowerCase();

                const alternateName = String(
                    recipe.recipeName || ""
                ).toLowerCase();

                return originalName.includes(query) ||
                    finalName.includes(query) ||
                    recipeName.includes(query) ||
                    alternateName.includes(query);
            })
            : data;

        hideStatus();

        if (grid) {
            grid.setAttribute("aria-busy", "false");
        }

        renderResults();

    } catch (error) {
        if (thisRequest !== requestNumber) {
            return;
        }

        console.error("SmartFoodFinder recipe error:", error);

        allRecipes = [];

        if (grid) {
            grid.replaceChildren();
            grid.setAttribute("aria-busy", "false");
        }

        renderPagination();
        showEmptyState(false);

        showStatus(
            "Unable to load recipes. Please check that Spring Boot is running.",
            true
        );

        if (count) {
            count.textContent = "Recipes unavailable";
        }
    }
}

// ==================================================
// RECIPE NAME
// ==================================================

function getRecipeName(recipe) {
    return String(
        recipe.final_food_name ||
        recipe.recipe_name ||
        recipe.recipeName ||
        recipe.recipe_original ||
        recipe.name ||
        recipe.title ||
        "Untitled Recipe"
    ).trim();
}

// ==================================================
// RENDER EXPLORE RECIPES
// ==================================================

function renderResults() {
    const grid = document.getElementById("recipe-grid");
    const count = document.getElementById("recipe-results-count");

    if (!grid) {
        return;
    }

    grid.replaceChildren();

    const totalRecipes = allRecipes.length;
    const totalPages = Math.ceil(totalRecipes / RECIPES_PER_PAGE);

    if (currentPage > totalPages && totalPages > 0) {
        currentPage = totalPages;
    }

    const startIndex = (currentPage - 1) * RECIPES_PER_PAGE;

    const visibleRecipes = allRecipes.slice(
        startIndex,
        startIndex + RECIPES_PER_PAGE
    );

    if (count) {
        if (totalRecipes === 0) {
            count.textContent = "No recipes found";
        } else {
            const first = startIndex + 1;
            const last = startIndex + visibleRecipes.length;

            count.textContent =
                `Showing ${first}–${last} of ${totalRecipes} recipes`;
        }
    }

    showEmptyState(totalRecipes === 0);

    visibleRecipes.forEach(recipe => {
        grid.appendChild(createRecipeCard(recipe));
    });

    grid.setAttribute("aria-busy", "false");

    renderPagination();
}

// ==================================================
// CREATE RECIPE CARD
// ==================================================

function createRecipeCard(recipe) {
    const card = document.createElement("article");
    card.className = "recipe-card";

    const recipeName = getRecipeName(recipe);

    // Image area
    const imageArea = document.createElement("div");
    imageArea.className = "recipe-card-image";

    const imageURL =
        recipe.image_url ||
        recipe.imageUrl ||
        recipe.image ||
        recipe.recipe_image ||
        "";

    if (imageURL) {
        const image = document.createElement("img");

        image.src = imageURL;
        image.alt = recipeName;
        image.loading = "lazy";

        image.addEventListener("error", () => {
            image.remove();

            if (!imageArea.querySelector(
                ".recipe-card-image-placeholder"
            )) {
                imageArea.appendChild(createImagePlaceholder());
            }
        });

        imageArea.appendChild(image);
    } else {
        imageArea.appendChild(createImagePlaceholder());
    }

    // Card content
    const content = document.createElement("div");
    content.className = "recipe-card-content";

    const category = document.createElement("span");
    category.className = "recipe-card-category";
    category.textContent = recipe.Cuisine || "INDIAN RECIPE";

    const title = document.createElement("h3");
    title.className = "recipe-card-title";
    title.textContent = recipeName;

    const description = document.createElement("p");
    description.className = "recipe-card-description";

    description.textContent =
        recipe.recipe_original &&
        recipe.recipe_original !== recipeName
            ? `Original recipe: ${recipe.recipe_original}`
            : "A delicious idea for your next home-cooked meal.";

    const meta = document.createElement("div");
    meta.className = "recipe-card-meta";

    const time = document.createElement("span");

    time.textContent = recipe.TotalTimeInMins != null
        ? `◷ ${recipe.TotalTimeInMins} mins`
        : "Everyday cooking";

    meta.appendChild(time);

    const viewButton = document.createElement("button");
    viewButton.type = "button";
    viewButton.className = "btn btn-primary recipe-view-button";
    viewButton.textContent = "View Recipe";

    viewButton.addEventListener("click", () => {
        openRecipeDetails(recipe);
    });

    content.append(category, title, description, meta, viewButton);
    card.append(imageArea, content);

    return card;
}

// ==================================================
// IMAGE PLACEHOLDER
// ==================================================

function createImagePlaceholder() {
    const placeholder = document.createElement("div");

    placeholder.className = "recipe-card-image-placeholder";
    placeholder.setAttribute("aria-hidden", "true");
    placeholder.textContent = "✳";

    return placeholder;
}

// ==================================================
// KITCHEN-BASED RECIPE SUGGESTIONS
// ==================================================

async function loadKitchenSuggestions() {
    const section = document.getElementById("kitchen-suggestions");
    const message = document.getElementById(
        "kitchen-suggestions-message"
    );
    const grid = document.getElementById("kitchen-suggestions-grid");
    const showMoreButton = document.getElementById(
        "show-more-kitchen-recipes"
    );

    if (!section || !message || !grid) {
        console.warn(
            "Kitchen suggestions section was not found in recipe.html."
        );
        return;
    }

    section.hidden = false;
    message.textContent = "Finding recipes that match your ingredients...";
    grid.replaceChildren();

    if (showMoreButton) {
        showMoreButton.hidden = true;
    }

    try {
        const [kitchenResponse, recipesResponse] = await Promise.all([
            fetch(KITCHEN_API_URL, {
                credentials: "same-origin",
                headers: {
                    Accept: "application/json"
                }
            }),
            fetch(RECIPE_API_URL, {
                headers: {
                    Accept: "application/json"
                }
            })
        ]);

        if (!kitchenResponse.ok) {
            throw new Error(
                `Kitchen API returned HTTP ${kitchenResponse.status}`
            );
        }

        if (!recipesResponse.ok) {
            throw new Error(
                `Recipe API returned HTTP ${recipesResponse.status}`
            );
        }

        const kitchenData = await kitchenResponse.json();
        const recipesData = await recipesResponse.json();

        if (!Array.isArray(kitchenData)) {
            throw new Error("Kitchen API did not return an array.");
        }

        if (!Array.isArray(recipesData)) {
            throw new Error("Recipe API did not return an array.");
        }

        const kitchenIngredients = [
            ...new Set(
                kitchenData
                    .map(ingredient => {
                        const name =
                            ingredient.ingredientName ??
                            ingredient.ingredient_name ??
                            ingredient.name ??
                            "";

                        return String(name).trim().toLowerCase();
                    })
                    .filter(name => name.length > 0)
            )
        ];

        if (kitchenIngredients.length === 0) {
            kitchenSuggestionRecipes = [];
            visibleKitchenSuggestions = INITIAL_KITCHEN_SUGGESTIONS;

            message.textContent =
                "Your kitchen is empty here. Add ingredients in My Kitchen to get recipe suggestions.";

            renderKitchenSuggestions();
            return;
        }

        // Find recipes containing saved kitchen ingredients.
        const matchedRecipes = recipesData
            .map(recipe => {
                const ingredientsValue =
                    recipe.TranslatedIngredients ??
                    recipe.translatedIngredients ??
                    recipe.ingredients ??
                    "";

                const ingredientText = Array.isArray(ingredientsValue)
                    ? ingredientsValue.join(" ").toLowerCase()
                    : String(ingredientsValue).toLowerCase();

                const matchedIngredients = kitchenIngredients.filter(
                    name => ingredientText.includes(name)
                );

                return {
                    recipe,
                    matchedIngredients
                };
            })
            .filter(item => item.matchedIngredients.length > 0)
            .sort((a, b) =>
                b.matchedIngredients.length -
                a.matchedIngredients.length
            );

        // Remove duplicate recipe names.
        const seenRecipeNames = new Set();

        kitchenSuggestionRecipes = matchedRecipes
            .filter(item => {
                const key = getRecipeName(item.recipe).toLowerCase();

                if (seenRecipeNames.has(key)) {
                    return false;
                }

                seenRecipeNames.add(key);
                return true;
            })
            .slice(0, MAX_KITCHEN_SUGGESTIONS);

        // Always start with only three visible suggestions.
        visibleKitchenSuggestions = INITIAL_KITCHEN_SUGGESTIONS;

        if (kitchenSuggestionRecipes.length === 0) {
            message.textContent =
                "No matching recipes found yet. Try adding more ingredients to My Kitchen.";
        } else {
            message.textContent =
                `Found ${kitchenSuggestionRecipes.length} recipes matching your kitchen ingredients.`;
        }

        renderKitchenSuggestions();

    } catch (error) {
        console.error("Kitchen recipe suggestions error:", error);

        kitchenSuggestionRecipes = [];
        visibleKitchenSuggestions = INITIAL_KITCHEN_SUGGESTIONS;
        grid.replaceChildren();

        message.textContent =
            "Unable to load kitchen suggestions. Check that you are logged in and try again.";

        if (showMoreButton) {
            showMoreButton.hidden = true;
        }
    }
}

// ==================================================
// DISPLAY ONLY THREE KITCHEN RECIPES INITIALLY
// ==================================================

function renderKitchenSuggestions() {
    const section = document.getElementById("kitchen-suggestions");
    const message = document.getElementById(
        "kitchen-suggestions-message"
    );
    const grid = document.getElementById("kitchen-suggestions-grid");
    const showMoreButton = document.getElementById(
        "show-more-kitchen-recipes"
    );

    if (!section || !message || !grid) {
        return;
    }

    section.hidden = false;
    grid.replaceChildren();

    const totalRecipes = kitchenSuggestionRecipes.length;

    if (totalRecipes === 0) {
        if (showMoreButton) {
            showMoreButton.hidden = true;
        }
        return;
    }

    // Never display more than the available number of recipes.
    visibleKitchenSuggestions = Math.min(
        visibleKitchenSuggestions,
        totalRecipes
    );

    // Only create cards for currently visible recipes.
    const recipesToShow = kitchenSuggestionRecipes.slice(
        0,
        visibleKitchenSuggestions
    );

    recipesToShow.forEach(item => {
        const card = createRecipeCard(item.recipe);

        const content = card.querySelector(".recipe-card-content");

        if (content) {
            const matchText = document.createElement("p");
            matchText.className = "recipe-card-description";
            matchText.textContent =
                "Matches your kitchen: " +
                item.matchedIngredients.join(", ");

            const meta = content.querySelector(".recipe-card-meta");

            if (meta) {
                content.insertBefore(matchText, meta);
            } else {
                content.appendChild(matchText);
            }
        }

        grid.appendChild(card);
    });

    // Hide the button when every suggestion has been revealed.
    if (showMoreButton) {
        const remaining = totalRecipes - visibleKitchenSuggestions;

        showMoreButton.hidden = remaining <= 0;

        if (remaining > 0) {
            showMoreButton.textContent =
                `Show More Recipes (${remaining} more)`;
        }
    }
}

// ==================================================
// PAGINATION FOR EXPLORE RECIPES
// ==================================================

function renderPagination() {
    const pagination = document.getElementById("recipe-pagination");
    const pagesContainer = document.getElementById("pagination-pages");
    const previousButton = document.getElementById("previous-page");
    const nextButton = document.getElementById("next-page");

    if (!pagination || !pagesContainer) {
        return;
    }

    pagesContainer.replaceChildren();

    const totalPages = Math.ceil(
        allRecipes.length / RECIPES_PER_PAGE
    );

    pagination.hidden = totalPages <= 1;

    if (previousButton) {
        previousButton.disabled = currentPage <= 1;
    }

    if (nextButton) {
        nextButton.disabled = currentPage >= totalPages;
    }

    let pages = [];

    if (totalPages <= 7) {
        pages = Array.from(
            { length: totalPages },
            (_, index) => index + 1
        );
    } else if (currentPage <= 4) {
        pages = [1, 2, 3, 4, 5, "...", totalPages];
    } else if (currentPage >= totalPages - 3) {
        pages = [
            1, "...",
            totalPages - 4,
            totalPages - 3,
            totalPages - 2,
            totalPages - 1,
            totalPages
        ];
    } else {
        pages = [
            1, "...",
            currentPage - 1,
            currentPage,
            currentPage + 1,
            "...",
            totalPages
        ];
    }

    pages.forEach(page => {
        if (page === "...") {
            const dots = document.createElement("span");
            dots.className = "pagination-ellipsis";
            dots.textContent = "…";
            pagesContainer.appendChild(dots);
            return;
        }

        const button = document.createElement("button");

        button.type = "button";
        button.className = "pagination-page";
        button.textContent = String(page);

        if (page === currentPage) {
            button.classList.add("active");
            button.setAttribute("aria-current", "page");
        }

        button.setAttribute("aria-label", `Page ${page}`);

        button.addEventListener("click", () => {
            changePage(page);
        });

        pagesContainer.appendChild(button);
    });
}

function changePage(page) {
    const totalPages = Math.ceil(
        allRecipes.length / RECIPES_PER_PAGE
    );

    if (page < 1 || page > totalPages) {
        return;
    }

    currentPage = page;
    renderResults();

    document.querySelector(".recipe-collection")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}

// ==================================================
// STATUS MESSAGES
// ==================================================

function showStatus(message, isError = false) {
    const status = document.getElementById("recipe-status");

    if (!status) {
        return;
    }

    status.textContent = message;
    status.className = isError
        ? "recipe-status status-error"
        : "recipe-status";

    status.hidden = false;
}

function hideStatus() {
    const status = document.getElementById("recipe-status");

    if (status) {
        status.textContent = "";
        status.hidden = true;
        status.className = "recipe-status";
    }
}

// ==================================================
// SEARCH CONTROLS
// ==================================================

function updateSearchControls() {
    const clearButton = document.getElementById("clear-recipe-search");
    const title = document.getElementById("recipe-section-title");
    const description = document.getElementById(
        "recipe-results-description"
    );

    if (clearButton) {
        clearButton.hidden = !currentSearch;
    }

    if (title) {
        title.textContent = currentSearch
            ? `Results for "${currentSearch}"`
            : "Explore recipes";
    }

    if (description) {
        description.textContent = currentSearch
            ? "Recipes matching your search."
            : "Find inspiration for your next meal.";
    }
}

function showEmptyState(show) {
    const emptyState = document.getElementById("recipe-empty-state");

    if (emptyState) {
        emptyState.hidden = !show;
    }
}

// ==================================================
// RECIPE DETAILS POPUP
// ==================================================

function initializeRecipeModal() {
    document.getElementById("recipe-modal-close")
        ?.addEventListener("click", closeRecipeDetails);

    document.getElementById("recipe-modal-backdrop")
        ?.addEventListener("click", closeRecipeDetails);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeRecipeDetails();
        }
    });
}

function openRecipeDetails(recipe) {
    const modal = document.getElementById("recipe-details-modal");

    if (!modal) {
        console.error("Recipe details modal not found.");
        return;
    }

    const title = document.getElementById("recipe-modal-title");
    const time = document.getElementById("recipe-modal-time");
    const ingredients = document.getElementById(
        "recipe-modal-ingredients"
    );
    const instructions = document.getElementById(
        "recipe-modal-instructions"
    );

    if (!title || !time || !ingredients || !instructions) {
        console.error("One or more recipe modal elements are missing.");
        return;
    }

    title.textContent = getRecipeName(recipe);

    time.textContent = recipe.TotalTimeInMins != null
        ? `Cooking time: ${recipe.TotalTimeInMins} minutes`
        : "";

    ingredients.textContent =
        recipe.TranslatedIngredients ||
        recipe.translatedIngredients ||
        recipe.ingredients ||
        "Ingredients are not available.";

    instructions.textContent =
        recipe.TranslatedInstructions ||
        recipe.translatedInstructions ||
        recipe.instructions ||
        "Instructions are not available.";

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    document.getElementById("recipe-modal-close")?.focus();
}

function closeRecipeDetails() {
    const modal = document.getElementById("recipe-details-modal");

    if (modal) {
        modal.hidden = true;
        document.body.style.overflow = "";
    }
}
