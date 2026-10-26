
/* =========================================
   SMARTFOODFINDER - SHOPPING LIST
   Spring Boot + MySQL
========================================= */

const SHOPPING_API_URL = "/api/shopping";
const KITCHEN_API_URL = "/api/kitchen/ingredients";

let currentListId = null;
let shoppingItems = [];
let shoppingHistory = [];
let editingShoppingItemId = null;
let requestInProgress = false;

/* =========================================
   INITIALIZATION
========================================= */

document.addEventListener("DOMContentLoaded", initializeShoppingPage);

function initializeShoppingPage() {
    document.getElementById("shopping-item-form")
        ?.addEventListener("submit", handleShoppingFormSubmit);

    document.getElementById("cancel-shopping-edit-button")
        ?.addEventListener("click", resetShoppingForm);

    document.getElementById("shopping-search")
        ?.addEventListener("input", renderShoppingItems);

    document.getElementById("shopping-filter")
        ?.addEventListener("change", renderShoppingItems);

    document.getElementById("load-low-stock-button")
        ?.addEventListener("click", loadLowStockItems);

    document.getElementById("finish-shopping-button")
        ?.addEventListener("click", openPurchaseReview);

    document.getElementById("close-purchase-dialog")
        ?.addEventListener("click", closePurchaseReview);

    document.getElementById("cancel-purchase-review")
        ?.addEventListener("click", closePurchaseReview);

    document.getElementById("confirm-purchases-button")
        ?.addEventListener("click", confirmPurchases);

    document.getElementById("purchase-item-rows")
        ?.addEventListener("input", updatePurchaseTotal);

    document.getElementById("purchase-item-rows")
        ?.addEventListener("change", handlePurchaseRowChange);

    document.getElementById("shopping-history-list")
        ?.addEventListener("click", handleHistoryAction);

    document.getElementById("clear-shopping-history-button")
        ?.addEventListener("click", clearAllShoppingHistory);

    loadShoppingData();
}

/* =========================================
   API HELPER
========================================= */


/* =========================================
   API HELPER WITH CSRF PROTECTION
========================================= */

async function apiRequest(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();

    const headers = {
        Accept: "application/json",
        ...options.headers
    };

    if (options.body) {
        headers["Content-Type"] = "application/json";
    }

    // Get a valid CSRF token for requests that modify data.
    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
        const csrfResponse = await fetch("/api/auth/csrf", {
            method: "GET",
            credentials: "same-origin",
            headers: {
                Accept: "application/json"
            }
        });

        if (!csrfResponse.ok) {
            throw new Error("Could not obtain CSRF token.");
        }

        const csrfData = await csrfResponse.json();
        headers[csrfData.headerName || "X-XSRF-TOKEN"] = csrfData.token;
    }

    const response = await fetch(`${SHOPPING_API_URL}${path}`, {
        ...options,
        method,
        headers,
        credentials: "same-origin"
    });

    if (!response.ok) {
        const responseText = await response.text();
        let message = `Request failed (${response.status})`;

        if (responseText) {
            try {
                const data = JSON.parse(responseText);
                message =
                    data.message ||
                    data.detail ||
                    data.error ||
                    responseText;
            } catch {
                message = responseText;
            }
        }

        const error = new Error(message);
        error.status = response.status;
        throw error;
    }

    if (response.status === 204) {
        return null;
    }

    const responseText = await response.text();
    return responseText ? JSON.parse(responseText) : null;
}


/* =========================================
   LOAD CURRENT LIST AND HISTORY
========================================= */

async function loadShoppingData() {
    setPageMessage("Loading your shopping list...");

    try {
        const [currentList, history] = await Promise.all([
            apiRequest("/current"),
            apiRequest("/history")
        ]);

        if (!currentList || !Array.isArray(currentList.items)) {
            throw new Error("Invalid current shopping list response.");
        }

        currentListId = currentList.id;
        shoppingItems = currentList.items;
        shoppingHistory = Array.isArray(history) ? history : [];

        renderAllShoppingData();
        setPageMessage("");
    } catch (error) {
        console.error("Could not load shopping data:", error);
        setPageMessage(`Could not load shopping data. ${error.message}`, "error");
    }
}

async function refreshShoppingData() {
    await loadShoppingData();
}

/* =========================================
   HELPERS
========================================= */

function getItemName(item) {
    return String(item.itemName ?? item.name ?? "").trim();
}

function getPlannedQuantity(item) {
    return Number(item.plannedQuantity ?? item.quantity ?? 0);
}

function findShoppingItem(id) {
    return shoppingItems.find(
        item => String(item.id) === String(id)
    );
}

function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;

    return element;
}

function formatQuantity(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) return "0";

    return number.toLocaleString("en-IN", {
        maximumFractionDigits: 3
    });
}

function formatMoney(value) {
    return Number(value || 0).toLocaleString("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatDate(value) {
    if (!value) return "Date unavailable";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "Date unavailable";

    return date.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

/* =========================================
   ADD OR EDIT ITEM
========================================= */

async function handleShoppingFormSubmit(event) {
    event.preventDefault();

    if (requestInProgress) return;

    const nameInput = document.getElementById("shopping-item-name");
    const quantityInput = document.getElementById("shopping-item-quantity");
    const unitInput = document.getElementById("shopping-item-unit");

    const name = nameInput.value.trim();
    const quantity = Number(quantityInput.value);
    const unit = unitInput.value;

    if (!name) {
        showFormMessage("Enter a grocery name.", "error");
        nameInput.focus();
        return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
        showFormMessage("Quantity must be greater than zero.", "error");
        quantityInput.focus();
        return;
    }

    const duplicate = shoppingItems.find(item =>
        getItemName(item).toLowerCase() === name.toLowerCase() &&
        String(item.id) !== String(editingShoppingItemId)
    );

    if (duplicate) {
        if (String(duplicate.unit).toLowerCase() !== unit.toLowerCase()) {
            showFormMessage(
                `${name} already exists using ${duplicate.unit}. Edit that item instead.`,
                "error"
            );
            return;
        }

        const merge = window.confirm(
            `${name} already exists with quantity ` +
            `${formatQuantity(getPlannedQuantity(duplicate))} ${duplicate.unit}.\n\n` +
            "Add the new quantity to the existing quantity?"
        );

        if (!merge) return;

        await updateShoppingItem(
            duplicate.id,
            name,
            getPlannedQuantity(duplicate) + quantity,
            unit
        );
        return;
    }

    if (editingShoppingItemId !== null) {
        await updateShoppingItem(editingShoppingItemId, name, quantity, unit);
        return;
    }

    await runRequest(async () => {
        await apiRequest("/items", {
            method: "POST",
            body: JSON.stringify({
                itemName: name,
                plannedQuantity: quantity,
                unit
            })
        });

        resetShoppingForm();
        await refreshShoppingData();
        showFormMessage(`${name} added to your shopping list.`, "success");
    });
}

async function updateShoppingItem(id, name, quantity, unit) {
    await runRequest(async () => {
        await apiRequest(`/items/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({
                itemName: name,
                plannedQuantity: quantity,
                unit
            })
        });

        resetShoppingForm();
        await refreshShoppingData();
        showFormMessage(`${name} saved successfully.`, "success");
    });
}

async function runRequest(action) {
    if (requestInProgress) return;

    requestInProgress = true;

    const button = document.getElementById("save-shopping-item-button");
    if (button) button.disabled = true;

    try {
        await action();
    } catch (error) {
        console.error("Shopping request failed:", error);

        showFormMessage(
            error.status === 409
                ? "This grocery already exists on the current list."
                : error.message,
            "error"
        );
    } finally {
        requestInProgress = false;
        if (button) button.disabled = false;
    }
}

/* =========================================
   FORM HELPERS
========================================= */

function resetShoppingForm() {
    document.getElementById("shopping-item-form")?.reset();
    editingShoppingItemId = null;

    const heading = document.getElementById("shopping-form-heading");
    const saveText = document.getElementById("save-shopping-button-text");
    const cancelButton = document.getElementById("cancel-shopping-edit-button");

    if (heading) heading.textContent = "Add to your list";
    if (saveText) saveText.textContent = "+ Add item";
    if (cancelButton) cancelButton.hidden = true;
}

function editShoppingItem(id) {
    const item = findShoppingItem(id);

    if (!item) {
        setPageMessage("Shopping item not found.", "error");
        return;
    }

    editingShoppingItemId = item.id;

    document.getElementById("shopping-item-name").value = getItemName(item);
    document.getElementById("shopping-item-quantity").value =
        getPlannedQuantity(item);

    const unitInput = document.getElementById("shopping-item-unit");
    const unit = String(item.unit || "kg");

    if (!Array.from(unitInput.options).some(option => option.value === unit)) {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        unitInput.appendChild(option);
    }

    unitInput.value = unit;

    document.getElementById("shopping-form-heading").textContent = "Edit grocery";
    document.getElementById("save-shopping-button-text").textContent =
        "Save changes";
    document.getElementById("cancel-shopping-edit-button").hidden = false;

    document.getElementById("shopping-item-manager")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    document.getElementById("shopping-item-name").focus();
}

/* =========================================
   DELETE CURRENT ITEM
========================================= */

async function deleteShoppingItem(id) {
    const item = findShoppingItem(id);
    if (!item) return;

    if (!window.confirm(`Remove "${getItemName(item)}" from this list?`)) {
        return;
    }

    await runRequest(async () => {
        await apiRequest(`/items/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });

        if (String(editingShoppingItemId) === String(id)) {
            resetShoppingForm();
        }

        await refreshShoppingData();
        setPageMessage(`${getItemName(item)} removed from your list.`);
    });
}

async function togglePurchased(id, purchased) {
    await runRequest(async () => {
        await apiRequest(`/items/${encodeURIComponent(id)}/purchased`, {
            method: "PATCH",
            body: JSON.stringify({ purchased })
        });

        await refreshShoppingData();
    });
}

/* =========================================
   RENDER CURRENT LIST
========================================= */

function renderShoppingItems() {
    const list = document.getElementById("shopping-items-list");
    const emptyState = document.getElementById("shopping-empty-state");

    if (!list || !emptyState) return;

    const search = (
        document.getElementById("shopping-search")?.value || ""
    ).trim().toLowerCase();

    const filter =
        document.getElementById("shopping-filter")?.value || "all";

    const filteredItems = shoppingItems.filter(item => {
        const matchesSearch =
            getItemName(item).toLowerCase().includes(search);

        const purchased = Boolean(item.purchased);

        const matchesFilter =
            filter === "all" ||
            (filter === "remaining" && !purchased) ||
            (filter === "purchased" && purchased);

        return matchesSearch && matchesFilter;
    });

    list.replaceChildren();

    filteredItems.forEach(item => {
        list.appendChild(createShoppingItemCard(item));
    });

    emptyState.hidden = filteredItems.length > 0;

    if (filteredItems.length === 0) {
        const heading = emptyState.querySelector("h3");
        const paragraph = emptyState.querySelector("p");

        if (heading) {
            heading.textContent = shoppingItems.length
                ? "No matching groceries"
                : "Your shopping list starts here";
        }

        if (paragraph) {
            paragraph.textContent = shoppingItems.length
                ? "Try another search or filter."
                : "Add a grocery above or bring in low-stock ingredients from My Kitchen.";
        }
    }

    const finishButton = document.getElementById("finish-shopping-button");
    if (finishButton) finishButton.disabled = shoppingItems.length === 0;

    updateShoppingSummary();
}

function createShoppingItemCard(item) {
    const card = createElement("article", "shopping-item-card");

    if (item.purchased) card.classList.add("is-purchased");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "shopping-item-checkbox";
    checkbox.checked = Boolean(item.purchased);
    checkbox.setAttribute("aria-label", `Mark ${getItemName(item)} as purchased`);
    checkbox.addEventListener("change", () => {
        togglePurchased(item.id, checkbox.checked);
    });

    const details = createElement("div", "shopping-item-details");

    details.append(
        createElement("h3", "", getItemName(item)),
        createElement(
            "p",
            "",
            `${formatQuantity(getPlannedQuantity(item))} ${item.unit}` +
            (item.purchased ? " · Purchased" : " · Remaining")
        )
    );

    const actions = createElement("div", "shopping-item-actions");

    const editButton = createElement("button", "shopping-icon-button", "✎");
    editButton.type = "button";
    editButton.title = "Edit item";
    editButton.addEventListener("click", () => editShoppingItem(item.id));

    const deleteButton = createElement("button", "shopping-icon-button delete", "×");
    deleteButton.type = "button";
    deleteButton.title = "Delete item";
    deleteButton.addEventListener("click", () => deleteShoppingItem(item.id));

    actions.append(editButton, deleteButton);
    card.append(checkbox, details, actions);

    return card;
}

/* =========================================
   LOW STOCK FROM MY KITCHEN
========================================= */

async function loadLowStockItems() {
    const button = document.getElementById("load-low-stock-button");
    const list = document.getElementById("low-stock-items-list");
    const message = document.getElementById("low-stock-message");

    if (!list || !message) return;

    message.textContent = "Checking your kitchen inventory...";
    if (button) button.disabled = true;

    try {
        const response = await fetch(KITCHEN_API_URL, {
            headers: { Accept: "application/json" }
        });

        if (!response.ok) {
            throw new Error(`Kitchen API returned HTTP ${response.status}`);
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            throw new Error("Unexpected kitchen inventory response.");
        }

        const lowItems = data.filter(item => {
            const quantity = Number(item.quantity ?? 0);
            const rawThreshold =
                item.lowStockThreshold ?? item.low_stock_threshold;
            const threshold =
                rawThreshold == null || rawThreshold === ""
                    ? 1
                    : Number(rawThreshold);

            return Number.isFinite(quantity) &&
                Number.isFinite(threshold) &&
                quantity <= threshold;
        });

        list.replaceChildren();

        if (lowItems.length === 0) {
            message.textContent = "No low-stock ingredients found.";
            return;
        }

        message.textContent = `${lowItems.length} low-stock ingredient(s) found.`;

        lowItems.forEach(item => list.appendChild(createLowStockCard(item)));
    } catch (error) {
        console.error(error);
        message.textContent = error.message;
    } finally {
        if (button) button.disabled = false;
    }
}

function createLowStockCard(ingredient) {
    const name = String(
        ingredient.ingredientName ??
        ingredient.ingredient_name ??
        ingredient.name ??
        ""
    ).trim();

    const unit = String(ingredient.unit || "piece");
    const quantity = Number(ingredient.quantity ?? 0);

    const card = createElement("article", "low-stock-card");
    const info = createElement("div", "low-stock-card-info");

    info.append(
        createElement("h3", "", name || "Unnamed ingredient"),
        createElement(
            "p",
            "",
            `${formatQuantity(quantity)} ${unit} available · Low stock`
        )
    );

    const button = createElement(
        "button",
        "shopping-button shopping-button-secondary",
        "Add to list"
    );

    button.type = "button";
    button.addEventListener("click", () => addLowStockIngredient(name, unit));

    card.append(info, button);
    return card;
}

async function addLowStockIngredient(name, unit) {
    if (!name) return;

    const existing = shoppingItems.find(
        item => getItemName(item).toLowerCase() === name.toLowerCase()
    );

    if (existing) {
        const entered = window.prompt(
            `${name} is already on your list. Enter the new planned quantity in ${existing.unit}:`,
            String(getPlannedQuantity(existing))
        );

        if (entered === null) return;

        const quantity = Number(entered);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            setPageMessage("Quantity must be greater than zero.", "error");
            return;
        }

        await updateShoppingItem(
            existing.id,
            getItemName(existing),
            quantity,
            existing.unit
        );
        return;
    }

    const entered = window.prompt(`How much ${name} would you like to buy?`, "1");
    if (entered === null) return;

    const quantity = Number(entered);
    if (!Number.isFinite(quantity) || quantity <= 0) {
        setPageMessage("Quantity must be greater than zero.", "error");
        return;
    }

    await runRequest(async () => {
        await apiRequest("/items", {
            method: "POST",
            body: JSON.stringify({
                itemName: name,
                plannedQuantity: quantity,
                unit
            })
        });

        await refreshShoppingData();
        setPageMessage(`${name} added to your shopping list.`);
    });
}

/* =========================================
   SUMMARY
========================================= */

function updateShoppingSummary() {
    const total = document.getElementById("total-items-count");
    const remaining = document.getElementById("remaining-items-count");
    const purchased = document.getElementById("purchased-items-count");
    const spending = document.getElementById("latest-trip-spending");

    const purchasedCount = shoppingItems.filter(
        item => Boolean(item.purchased)
    ).length;

    if (total) total.textContent = shoppingItems.length;
    if (remaining) remaining.textContent = shoppingItems.length - purchasedCount;
    if (purchased) purchased.textContent = purchasedCount;

    if (spending) {
        spending.textContent = shoppingHistory.length
            ? formatMoney(shoppingHistory[0].totalSpent)
            : formatMoney(0);
    }
}

/* =========================================
   PURCHASE REVIEW
========================================= */

function openPurchaseReview() {
    const dialog = document.getElementById("purchase-review-dialog");
    const rows = document.getElementById("purchase-item-rows");

    if (!dialog || !rows || shoppingItems.length === 0) return;

    rows.replaceChildren();

    shoppingItems.forEach(item => rows.appendChild(createPurchaseItemRow(item)));

    document.getElementById("purchase-review-message").textContent = "";
    updatePurchaseTotal();

    if (typeof dialog.showModal === "function") {
        dialog.showModal();
    } else {
        setPageMessage("Your browser does not support this purchase dialog.", "error");
    }
}

function createPurchaseItemRow(item) {
    const row = createElement("article", "purchase-item-row");
    row.dataset.itemId = item.id;

    const header = createElement("div", "purchase-item-row-header");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "purchase-bought-checkbox";
    checkbox.checked = Boolean(item.purchased);

    const heading = createElement(
        "h3",
        "",
        `${getItemName(item)} — planned ${formatQuantity(getPlannedQuantity(item))} ${item.unit}`
    );

    header.append(checkbox, heading);

    const fields = createElement("div", "purchase-item-fields");

    const quantityLabel = createElement("label", "", `Actual quantity bought (${item.unit})`);
    const quantityInput = document.createElement("input");
    quantityInput.type = "number";
    quantityInput.min = "0.001";
    quantityInput.step = "any";
    quantityInput.className = "purchase-quantity-input";
    quantityInput.value = getPlannedQuantity(item);
    quantityInput.disabled = !checkbox.checked;
    quantityLabel.appendChild(quantityInput);

    const priceLabel = createElement("label", "", "Total price paid (₹)");
    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.placeholder = "Enter amount paid";
    priceInput.className = "purchase-price-input";
    priceInput.disabled = !checkbox.checked;
    priceLabel.appendChild(priceInput);

    fields.append(quantityLabel, priceLabel);

    const unitPrice = createElement(
        "p",
        "purchase-unit-price",
        "Enter quantity and price to calculate unit price."
    );

    row.append(header, fields, unitPrice);

    checkbox.addEventListener("change", () => {
        quantityInput.disabled = !checkbox.checked;
        priceInput.disabled = !checkbox.checked;
        updatePurchaseTotal();
    });

    return row;
}

function closePurchaseReview() {
    const dialog = document.getElementById("purchase-review-dialog");
    if (dialog?.open) dialog.close();
}

function handlePurchaseRowChange(event) {
    if (
        event.target.matches(".purchase-bought-checkbox") ||
        event.target.matches(".purchase-quantity-input") ||
        event.target.matches(".purchase-price-input")
    ) {
        updatePurchaseTotal();
    }
}

/* =========================================
   PRICE CALCULATIONS
========================================= */

function getPriceInformation(quantity, unit, totalPrice) {
    const amount = Number(quantity);
    const price = Number(totalPrice);

    if (
        !Number.isFinite(amount) || amount <= 0 ||
        !Number.isFinite(price) || price < 0
    ) {
        return null;
    }

    const normalUnit = String(unit || "").toLowerCase();
    let baseQuantity = amount;
    let priceUnit = unit;

    if (normalUnit === "g") {
        baseQuantity = amount / 1000;
        priceUnit = "kg";
    } else if (normalUnit === "kg") {
        priceUnit = "kg";
    } else if (normalUnit === "ml") {
        baseQuantity = amount / 1000;
        priceUnit = "litre";
    } else if (normalUnit === "l" || normalUnit === "litre") {
        priceUnit = "litre";
    } else if (["piece", "pieces", "pcs"].includes(normalUnit)) {
        priceUnit = "piece";
    } else {
        priceUnit = "pack";
    }

    return {
        totalPrice: price,
        unitPrice: price / baseQuantity,
        priceUnit
    };
}

function updatePurchaseTotal() {
    const rows = document.querySelectorAll(
        "#purchase-item-rows .purchase-item-row"
    );

    let total = 0;

    rows.forEach(row => {
        const bought = row.querySelector(".purchase-bought-checkbox").checked;
        const quantityInput = row.querySelector(".purchase-quantity-input");
        const priceInput = row.querySelector(".purchase-price-input");
        const priceLabel = row.querySelector(".purchase-unit-price");

        if (!bought) {
            priceLabel.textContent = "Not marked as purchased.";
            return;
        }

        const quantity = Number(quantityInput.value);
        const price = Number(priceInput.value);
        const item = findShoppingItem(row.dataset.itemId);

        if (
            quantity > 0 &&
            priceInput.value.trim() !== "" &&
            Number.isFinite(price) &&
            price >= 0
        ) {
            const info = getPriceInformation(quantity, item?.unit, price);

            if (info) {
                total += price;
                priceLabel.textContent =
                    `Price per ${info.priceUnit}: ${formatMoney(info.unitPrice)}`;
            } else {
                priceLabel.textContent = "Check the quantity and unit.";
            }
        } else {
            priceLabel.textContent = "Enter quantity bought and price paid.";
        }
    });

    const totalElement = document.getElementById("purchase-total-amount");
    if (totalElement) totalElement.textContent = formatMoney(total);
}

/* =========================================
   CONFIRM PURCHASES + MY KITCHEN UPDATE
========================================= */

async function confirmPurchases() {
    const message = document.getElementById("purchase-review-message");

    const rows = Array.from(document.querySelectorAll(
        "#purchase-item-rows .purchase-item-row"
    ));

    const itemsToSubmit = [];

    for (const row of rows) {
        const id = Number(row.dataset.itemId);

        const bought = row.querySelector(
            ".purchase-bought-checkbox"
        ).checked;

        const payload = {
            id,
            purchased: bought
        };

        if (bought) {
            const quantityInput = row.querySelector(
                ".purchase-quantity-input"
            );

            const priceInput = row.querySelector(
                ".purchase-price-input"
            );

            const quantity = Number(quantityInput.value);
            const price = Number(priceInput.value);

            if (!Number.isFinite(quantity) || quantity <= 0) {
                message.textContent =
                    "Enter a valid purchased quantity.";

                message.className =
                    "shopping-form-message error";

                quantityInput.focus();
                return;
            }

            if (
                priceInput.value.trim() === "" ||
                !Number.isFinite(price) ||
                price < 0
            ) {
                message.textContent =
                    "Enter the total price for every purchased item.";

                message.className =
                    "shopping-form-message error";

                priceInput.focus();
                return;
            }

            payload.boughtQuantity = quantity;
            payload.totalPricePaid = price;
        }

        itemsToSubmit.push(payload);
    }

    if (!itemsToSubmit.some(item => item.purchased)) {
        message.textContent =
            "Select at least one item you bought.";

        message.className =
            "shopping-form-message error";

        return;
    }

    const kitchenCheckbox = document.getElementById(
        "update-kitchen-after-purchase"
    );

    const updateKitchen = Boolean(kitchenCheckbox?.checked);

    const confirmButton = document.getElementById(
        "confirm-purchases-button"
    );

    confirmButton.disabled = true;

    message.textContent = "Saving your shopping trip...";
    message.className = "shopping-form-message";

    try {
        await apiRequest("/complete", {
            method: "POST",
            body: JSON.stringify({
                items: itemsToSubmit,
                updateKitchen: updateKitchen
            })
        });

        closePurchaseReview();

        await refreshShoppingData();

        setPageMessage(
            updateKitchen
                ? "Shopping trip saved and My Kitchen inventory updated."
                : "Shopping trip saved to MySQL."
        );

    } catch (error) {
        console.error(
            "Could not complete shopping trip:",
            error
        );

        message.textContent = error.message;
        message.className = "shopping-form-message error";

    } finally {
        confirmButton.disabled = false;
    }
}

/* =========================================
   SHOPPING HISTORY
========================================= */

function renderShoppingHistory() {
    const list = document.getElementById("shopping-history-list");
    const emptyState = document.getElementById("shopping-history-empty");

    if (!list || !emptyState) return;

    list.replaceChildren();

    if (shoppingHistory.length === 0) {
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;

    shoppingHistory.forEach(record => {
        list.appendChild(createHistoryCard(record));
    });
}

function createHistoryCard(record) {
    const card = createElement("article", "shopping-history-card");
    const header = createElement("div", "shopping-history-card-header");
    const info = document.createElement("div");

    info.append(
        createElement("h3", "", `Shopping trip · ${formatDate(record.completedAt)}`),
        createElement(
            "p",
            "",
            `${(record.items || []).length} items · ` +
            `${(record.items || []).filter(item => item.purchased).length} purchased`
        )
    );

    const total = createElement("div", "shopping-history-card-total");
    total.append(
        createElement("strong", "", formatMoney(record.totalSpent)),
        createElement("span", "", "Total spent")
    );

    header.append(info, total);

    const items = createElement("div", "shopping-history-card-items");

    (record.items || []).forEach(item => {
        const line = createElement("div", "shopping-history-item");

        const quantity = item.purchased
            ? Number(item.boughtQuantity ?? getPlannedQuantity(item))
            : getPlannedQuantity(item);

        const name = createElement(
            "span",
            "shopping-history-item-name",
            `${getItemName(item)} · ${formatQuantity(quantity)} ${item.unit}` +
            (item.purchased ? "" : " · Not purchased")
        );

        const priceText = item.purchased
            ? `${formatMoney(item.totalPricePaid)} · ${formatMoney(item.unitPrice)}/${item.priceUnit}`
            : "—";

        const price = createElement("span", "shopping-history-item-price", priceText);

        line.append(name, price);
        items.appendChild(line);
    });

    const actions = createElement("div", "shopping-history-card-actions");

    const reuseButton = createElement(
        "button",
        "shopping-button shopping-button-primary",
        "↻ Reuse list"
    );
    reuseButton.type = "button";
    reuseButton.dataset.action = "reuse";
    reuseButton.dataset.historyId = record.id;

    const deleteButton = createElement(
        "button",
        "shopping-button shopping-button-secondary",
        "Delete Trip"
    );
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.historyId = record.id;

    actions.append(reuseButton, deleteButton);
    card.append(header, items, actions);

    return card;
}

function handleHistoryAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;

    const historyId = button.dataset.historyId;

    if (button.dataset.action === "reuse") {
        reuseShoppingHistory(historyId);
    } else if (button.dataset.action === "delete") {
        deleteShoppingHistory(historyId);
    }
}

/* =========================================
   DELETE ONE HISTORY TRIP
========================================= */

async function deleteShoppingHistory(historyId) {
    const trip = shoppingHistory.find(
        record => String(record.id) === String(historyId)
    );

    if (!trip) {
        setPageMessage("Shopping trip not found.", "error");
        return;
    }

    const confirmed = window.confirm(
        "Delete this completed shopping trip and its history items?\n\n" +
        "Your current shopping list and My Kitchen inventory will not change."
    );

    if (!confirmed) return;

    await runRequest(async () => {
        await apiRequest(`/history/${encodeURIComponent(historyId)}`, {
            method: "DELETE"
        });

        await refreshShoppingData();

        setPageMessage(
            "Shopping trip deleted. Current list and My Kitchen inventory were not changed."
        );
    });
}

/* =========================================
   CLEAR ALL HISTORY
========================================= */

async function clearAllShoppingHistory() {
    if (shoppingHistory.length === 0) {
        setPageMessage("There is no shopping history to clear.");
        return;
    }

    const confirmed = window.confirm(
        `Delete all ${shoppingHistory.length} completed shopping trip(s)?\n\n` +
        "This cannot be undone. Your current shopping list and My Kitchen inventory will remain untouched."
    );

    if (!confirmed) return;

    await runRequest(async () => {
        await apiRequest("/history", {
            method: "DELETE"
        });

        await refreshShoppingData();

        setPageMessage(
            "All completed shopping history was deleted. Current list and My Kitchen inventory remain untouched."
        );
    });
}

/* =========================================
   REUSE HISTORY
========================================= */

async function reuseShoppingHistory(historyId) {
    if (shoppingItems.length > 0) {
        const confirmed = window.confirm(
            "Reusing this list will replace your current shopping list.\n\n" +
            "Your shopping history will not change. Continue?"
        );

        if (!confirmed) return;
    }

    await runRequest(async () => {
        await apiRequest(
            `/history/${encodeURIComponent(historyId)}/reuse`,
            { method: "POST" }
        );

        resetShoppingForm();
        await refreshShoppingData();

        setPageMessage(
            "Previous list reused. Only item names, quantities and units were copied."
        );

        document.getElementById("current-shopping-list")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    });
}

/* =========================================
   FINAL RENDER AND MESSAGES
========================================= */

function renderAllShoppingData() {
    renderShoppingItems();
    renderShoppingHistory();
    updateShoppingSummary();
}

function setPageMessage(message, type = "") {
    const element = document.getElementById("shopping-page-message");
    if (!element) return;

    element.textContent = message;
    element.className = "shopping-page-message";
    element.hidden = !message;

    if (type) element.classList.add(type);
}

function showFormMessage(message, type = "") {
    const element = document.getElementById("shopping-form-message");
    if (!element) return;

    element.textContent = message;
    element.className = "shopping-form-message";

    if (type) element.classList.add(type);
}
