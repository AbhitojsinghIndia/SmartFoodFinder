
// ==================================================
// SMARTFOODFINDER — HOMEPAGE JAVASCRIPT
// Homepage-specific functionality only
// ==================================================

document.addEventListener("DOMContentLoaded", initializeHomePage);

function initializeHomePage() {
    initializeRecipeSearch();
    initializeHeroImage();
}

// ==================================================
// RECIPE SEARCH
// ==================================================

function initializeRecipeSearch() {
    const searchForm = document.getElementById("home-search");
    const searchInput = document.getElementById("ingredient-search");

    if (!searchForm || !searchInput) {
        console.warn(
            "SmartFoodFinder: Recipe search elements were not found."
        );
        return;
    }

    searchForm.addEventListener("submit", function (event) {
        event.preventDefault();

        const searchTerm = searchInput.value.trim();

        if (!searchTerm) {
            searchInput.setCustomValidity(
                "Please enter a recipe name to search."
            );
            searchInput.reportValidity();
            searchInput.focus();
            return;
        }

        searchInput.setCustomValidity("");

        const searchUrl =
            "/recipe/recipe.html?name=" +
            encodeURIComponent(searchTerm);

        window.location.href = searchUrl;
    });

    searchInput.addEventListener("input", function () {
        searchInput.setCustomValidity("");
    });
}

// ==================================================
// HERO IMAGE ERROR HANDLING
// ==================================================

function initializeHeroImage() {
    const heroImage = document.querySelector(".hero-food-image");

    if (!heroImage) {
        return;
    }

    heroImage.addEventListener("error", function () {
        console.error(
            "SmartFoodFinder: The hero food image failed to load."
        );

        const imageFrame = heroImage.closest(".hero-image-frame");

        heroImage.hidden = true;

        if (imageFrame) {
            imageFrame.classList.add("image-unavailable");
            imageFrame.setAttribute("role", "img");
            imageFrame.setAttribute(
                "aria-label",
                "Food image is currently unavailable"
            );
        }
    });
}
