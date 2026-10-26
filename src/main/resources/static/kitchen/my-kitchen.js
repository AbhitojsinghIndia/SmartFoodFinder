/* =========================================
   SMARTFOODFINDER — MY KITCHEN
   Ingredient inventory and low-stock filter
========================================= */

const INGREDIENT_API_URL = "/api/kitchen/ingredients";

/* =========================================
   CSRF TOKEN SUPPORT
========================================= */

function readCsrfCookie() {
    const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
}

async function getCsrfToken() {
    const response = await fetch("/api/auth/csrf", {
        credentials: "same-origin"
    });

    if (!response.ok) {
        throw new Error("Could not obtain CSRF token.");
    }

    const data = await response.json();
    return data.token;
}

async function csrfHeaders() {
    const token = await getCsrfToken();

    return {
        "Content-Type": "application/json",
        "X-XSRF-TOKEN": token
    };
}

/* =========================================
   GLOBAL VARIABLES
========================================= */

let kitchenIngredients = [];
let editingIngredientId = null;
let ingredientRequestInProgress = false;

document.addEventListener("DOMContentLoaded", initializeKitchenPage);

/* =========================================
   INITIALIZE
========================================= */

function initializeKitchenPage() {
    document
        .getElementById("ingredient-form")
        ?.addEventListener("submit", handleIngredientSubmit);

    document
        .getElementById("ingredient-search")
        ?.addEventListener("input", renderIngredients);

    document
        .getElementById("ingredient-sort")
        ?.addEventListener("change", renderIngredients);

    loadIngredients();
}

/* =========================================
   DATA HELPERS
========================================= */

function getIngredientName(ingredient) {
    return String(
        ingredient.ingredientName ??
        ingredient.ingredient_name ??
        ingredient.name ??
        ""
    );
}

function getIngredientId(ingredient) {
    return ingredient.id ?? ingredient.ingredientId;
}

function getQuantity(ingredient) {
    const quantity = Number(ingredient.quantity ?? 0);

    return Number.isFinite(quantity) ? quantity : 0;
}

function getThreshold(ingredient) {
    const rawThreshold =
        ingredient.lowStockThreshold ??
        ingredient.low_stock_threshold;

    if (
        rawThreshold === null ||
        rawThreshold === undefined ||
        rawThreshold === ""
    ) {
        return 1;
    }

    const threshold = Number(rawThreshold);

    return Number.isFinite(threshold) && threshold >= 0
        ? threshold
        : 1;
}

function isLowStock(ingredient) {
    return getQuantity(ingredient) <= getThreshold(ingredient);
}

/* =========================================
   LOAD INGREDIENTS
========================================= */

async function loadIngredients() {
    const list = document.getElementById("ingredient-list");

    setKitchenMessage("Loading your kitchen inventory...");

    if (list) {
        list.setAttribute("aria-busy", "true");
    }

    try {
        const response = await fetch(INGREDIENT_API_URL, {
            headers: {
                Accept: "application/json"
            },
            credentials: "same-origin"
        });

        if (!response.ok) {
            throw new Error(
                `Server returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            throw new Error(
                "The ingredient API did not return a list."
            );
        }

        kitchenIngredients = data;

        console.log(
            "Kitchen ingredients loaded:",
            kitchenIngredients
        );

        renderIngredients();
        updateKitchenSummary();
    } catch (error) {
        console.error("Could not load ingredients:", error);

        setKitchenMessage(
            `Could not load ingredients. ${error.message}`,
            "error"
        );

        if (list) {
            list.setAttribute("aria-busy", "false");
        }
    }
}

/* =========================================
   ADD OR UPDATE INGREDIENT
========================================= */

async function handleIngredientSubmit(event) {
    event.preventDefault();

    if (ingredientRequestInProgress) {
        return;
    }

    const nameInput =
        document.getElementById("ingredient-name");

    const quantityInput =
        document.getElementById("ingredient-quantity");

    const unitInput =
        document.getElementById("ingredient-unit");

    const submitButton =
        document.getElementById("add-ingredient-button");

    if (!nameInput || !quantityInput || !unitInput) {
        return;
    }

    const ingredientName = nameInput.value.trim();
    const quantity = Number(quantityInput.value);
    const unit = unitInput.value;

    if (!ingredientName) {
        showFormMessage(
            "Please enter an ingredient name.",
            "error"
        );

        nameInput.focus();
        return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        showFormMessage(
            "Quantity must be greater than zero.",
            "error"
        );

        quantityInput.focus();
        return;
    }

    const isEditing = editingIngredientId !== null;

    const existingIngredient = kitchenIngredients.find(
        item =>
            String(getIngredientId(item)) ===
            String(editingIngredientId)
    );

    const payload = {
        ingredientName,
        quantity,
        unit,
        lowStockThreshold: existingIngredient
            ? getThreshold(existingIngredient)
            : 1
    };

    const requestUrl = isEditing
        ? `${INGREDIENT_API_URL}/${encodeURIComponent(editingIngredientId)}`
        : INGREDIENT_API_URL;

    ingredientRequestInProgress = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = isEditing
            ? "Saving changes..."
            : "Adding ingredient...";
    }

    try {
        const headers = {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(await csrfHeaders())
        };

        const response = await fetch(requestUrl, {
            method: isEditing ? "PUT" : "POST",
            credentials: "same-origin",
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const serverMessage = await response.text();

            throw new Error(
                serverMessage ||
                `Server returned HTTP ${response.status}`
            );
        }

        resetIngredientForm();

        showFormMessage(
            isEditing
                ? "Ingredient updated successfully."
                : "Ingredient added successfully.",
            "success"
        );

        await loadIngredients();
    } catch (error) {
        console.error("Ingredient save failed:", error);

        showFormMessage(
            `Could not save the ingredient. ${error.message}`,
            "error"
        );
    } finally {
        ingredientRequestInProgress = false;

        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML =
                editingIngredientId !== null
                    ? "Save changes <span>↗</span>"
                    : "Add to kitchen <span>↗</span>";
        }
    }
}

/* =========================================
   SEARCH, FILTER AND SORT
========================================= */

function renderIngredients() {
    const list = document.getElementById("ingredient-list");
    const emptyState = document.getElementById("empty-kitchen");

    const searchInput =
        document.getElementById("ingredient-search");

    const sortSelect =
        document.getElementById("ingredient-sort");

    if (!list) {
        return;
    }

    const searchTerm = (searchInput?.value || "")
        .trim()
        .toLowerCase();

    const sortBy = sortSelect?.value || "name";

    let filteredIngredients = kitchenIngredients.filter(
        ingredient =>
            getIngredientName(ingredient)
                .toLowerCase()
                .includes(searchTerm)
    );

    if (sortBy === "low-stock") {
        filteredIngredients =
            filteredIngredients.filter(isLowStock);
    }

    filteredIngredients.sort((a, b) => {
        if (sortBy === "quantity-high") {
            return getQuantity(b) - getQuantity(a);
        }

        if (sortBy === "quantity-low") {
            return getQuantity(a) - getQuantity(b);
        }

        return getIngredientName(a).localeCompare(
            getIngredientName(b)
        );
    });

    list.replaceChildren();

    filteredIngredients.forEach(ingredient => {
        list.appendChild(createIngredientCard(ingredient));
    });

    list.setAttribute("aria-busy", "false");

    if (emptyState) {
        emptyState.hidden = filteredIngredients.length > 0;
    }

    if (filteredIngredients.length === 0) {
        if (kitchenIngredients.length === 0) {
            setKitchenMessage(
                "Your kitchen is empty. Add your first ingredient."
            );
        } else if (sortBy === "low-stock" && !searchTerm) {
            setKitchenMessage("No low-stock ingredients found.");
        } else if (sortBy === "low-stock" && searchTerm) {
            setKitchenMessage(
                "No low-stock ingredients match your search."
            );
        } else if (searchTerm) {
            setKitchenMessage(
                "No ingredients match your search. Try another name."
            );
        } else {
            setKitchenMessage("No ingredients to display.");
        }
    } else {
        const description = sortBy === "low-stock"
            ? "low-stock ingredient(s)"
            : "ingredient(s)";

        setKitchenMessage(
            `Showing ${filteredIngredients.length} ${description} out of ${kitchenIngredients.length}.`
        );
    }

    updateKitchenSummary();
}

/* =========================================
   INGREDIENT CARD
========================================= */

function createIngredientCard(ingredient) {
    const card = document.createElement("article");
    card.className = "ingredient-card";

    const header = document.createElement("div");
    header.className = "ingredient-card-header";

    const icon = document.createElement("div");
    icon.className = "ingredient-card-icon";
    icon.setAttribute("aria-hidden", "true");

    icon.textContent = getIngredientEmoji(
        getIngredientName(ingredient)
    );

    const name = document.createElement("h3");
    name.className = "ingredient-card-name";

    name.textContent =
        getIngredientName(ingredient) || "Unnamed ingredient";

    header.append(icon, name);

    const quantity = document.createElement("p");
    quantity.className = "ingredient-card-quantity";

    const quantityValue = document.createElement("strong");

    quantityValue.textContent =
        formatQuantity(getQuantity(ingredient));

    quantity.append(
        quantityValue,
        document.createTextNode(
            ` ${ingredient.unit || ""} available`
        )
    );

    card.append(header, quantity);

    if (isLowStock(ingredient)) {
        const warning = document.createElement("p");
        warning.className = "kitchen-message";
        warning.textContent = "⚠️ Low stock";

        card.appendChild(warning);
    }

    const actions = document.createElement("div");
    actions.className = "ingredient-card-actions";

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit quantity";

    editButton.addEventListener("click", () => {
        editIngredient(getIngredientId(ingredient));
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "ingredient-delete-button";
    deleteButton.textContent = "Delete";

    deleteButton.addEventListener("click", () => {
        deleteIngredient(getIngredientId(ingredient));
    });

    actions.append(editButton, deleteButton);
    card.appendChild(actions);

    return card;
}

/* =========================================
   INGREDIENT EMOJIS
========================================= */

function getIngredientEmoji(name) {
    const value = String(name || "").toLowerCase();

    const ingredientEmojis = [
        [/tomato/, "🍅"],
        [/potato/, "🥔"],
        [/onion/, "🧅"],
        [/garlic/, "🧄"],
        [/carrot/, "🥕"],
        [/broccoli/, "🥦"],
        [/spinach|palak|leafy/, "🥬"],
        [/apple/, "🍎"],
        [/banana/, "🍌"],
        [/mango/, "🥭"],
        [/lemon|lime/, "🍋"],
        [/orange/, "🍊"],
        [/grape/, "🍇"],
        [/chilli|chili|pepper/, "🌶️"],
        [/rice/, "🍚"],
        [/bread/, "🍞"],
        [/milk/, "🥛"],
        [/cheese|paneer/, "🧀"],
        [/egg/, "🥚"],
        [/mushroom/, "🍄"],
        [/corn|maize/, "🌽"],
        [/cucumber/, "🥒"],
        [/avocado/, "🥑"],
        [/coconut/, "🥥"],
        [/beans|rajma/, "🫘"],
        [/pea/, "🫛"]
    ];

    const match = ingredientEmojis.find(
        ([pattern]) => pattern.test(value)
    );

    return match ? match[1] : "🥗";
}

/* =========================================
   EDIT INGREDIENT
========================================= */

function editIngredient(id) {
    const ingredient = kitchenIngredients.find(
        item =>
            String(getIngredientId(item)) === String(id)
    );

    if (!ingredient) {
        showFormMessage(
            "Ingredient not found. Refresh the page.",
            "error"
        );

        return;
    }

    editingIngredientId = getIngredientId(ingredient);

    document.getElementById("ingredient-name").value =
        getIngredientName(ingredient);

    document.getElementById("ingredient-quantity").value =
        ingredient.quantity ?? "";

    const unitInput =
        document.getElementById("ingredient-unit");

    const unit = ingredient.unit || "kg";

    const unitExists = Array.from(unitInput.options).some(
        option => option.value === unit
    );

    if (!unitExists) {
        const option = document.createElement("option");

        option.value = unit;
        option.textContent = unit;

        unitInput.appendChild(option);
    }

    unitInput.value = unit;

    const submitButton =
        document.getElementById("add-ingredient-button");

    if (submitButton) {
        submitButton.innerHTML =
            "Save changes <span>↗</span>";
    }

    showFormMessage(
        `Editing ${getIngredientName(ingredient)}. Update the fields and save.`,
        "success"
    );

    document.getElementById("ingredient-manager")
        ?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });

    document.getElementById("ingredient-name")?.focus();
}

/* =========================================
   DELETE INGREDIENT
========================================= */

async function deleteIngredient(id) {
    const ingredient = kitchenIngredients.find(
        item =>
            String(getIngredientId(item)) === String(id)
    );

    if (!ingredient) {
        return;
    }

    const confirmed = window.confirm(
        `Delete "${getIngredientName(ingredient)}" from your kitchen inventory?`
    );

    if (!confirmed) {
        return;
    }

    try {
        const response = await fetch(
            `${INGREDIENT_API_URL}/${encodeURIComponent(id)}`,
            {
                method: "DELETE",
                credentials: "same-origin",
                headers: {
                    ...(await csrfHeaders())
                }
            }
        );

        if (!response.ok) {
            const serverMessage = await response.text();

            throw new Error(
                serverMessage ||
                `Server returned HTTP ${response.status}`
            );
        }

        if (
            editingIngredientId !== null &&
            String(editingIngredientId) === String(id)
        ) {
            resetIngredientForm();
        }

        await loadIngredients();

        showFormMessage(
            "Ingredient deleted successfully.",
            "success"
        );
    } catch (error) {
        console.error("Ingredient deletion failed:", error);

        showFormMessage(
            `Could not delete the ingredient. ${error.message}`,
            "error"
        );
    }
}

/* =========================================
   SUMMARY CARDS
========================================= */

function updateKitchenSummary() {
    const totalIngredients =
        document.getElementById("total-ingredients");

    const totalQuantity =
        document.getElementById("total-quantity");

    const inventoryStatus =
        document.getElementById("inventory-status");

    if (totalIngredients) {
        totalIngredients.textContent =
            kitchenIngredients.length;
    }

    if (totalQuantity) {
        const units = new Set(
            kitchenIngredients.map(item =>
                String(item.unit || "").toLowerCase()
            )
        );

        if (kitchenIngredients.length === 0) {
            totalQuantity.textContent = "0";
        } else if (units.size === 1) {
            const sum = kitchenIngredients.reduce(
                (total, item) =>
                    total + getQuantity(item),
                0
            );

            totalQuantity.textContent =
                `${formatQuantity(sum)} ${kitchenIngredients[0].unit || ""}`.trim();
        } else {
            totalQuantity.textContent = "Mixed";
        }
    }

    if (inventoryStatus) {
        const lowStockCount =
            kitchenIngredients.filter(isLowStock).length;

        inventoryStatus.textContent = lowStockCount > 0
            ? `${lowStockCount} low`
            : "All set";
    }
}

/* =========================================
   FORM HELPERS
========================================= */

function resetIngredientForm() {
    document.getElementById("ingredient-form")?.reset();

    editingIngredientId = null;

    const submitButton =
        document.getElementById("add-ingredient-button");

    if (submitButton) {
        submitButton.innerHTML =
            "Add to kitchen <span>↗</span>";
    }
}

function formatQuantity(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "0";
    }

    return number.toLocaleString("en-IN", {
        maximumFractionDigits: 3
    });
}

function setKitchenMessage(message, type = "") {
    const element =
        document.getElementById("kitchen-page-message");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = "kitchen-page-message";

    if (type) {
        element.classList.add(type);
    }
}

function showFormMessage(message, type = "") {
    const element =
        document.getElementById("ingredient-form-message");

    if (!element) {
        return;
    }

    element.textContent = message;
    element.className = "kitchen-message";

    if (type === "error") {
        element.style.color = "#a34a3e";
    } else if (type === "success") {
        element.style.color = "#426a3c";
    } else {
        element.style.color = "";
    }
}