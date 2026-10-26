
document.addEventListener("DOMContentLoaded", initializeSharedLayout);

// ==================================================
// INITIALIZE SHARED LAYOUT
// ==================================================

async function initializeSharedLayout() {
    const headerLoaded = await loadSharedComponent(
        "site-header",
        "/shared/header.html"
    );

    await loadSharedComponent(
        "site-footer",
        "/shared/footer.html"
    );

    if (headerLoaded) {
        initializeNavigation();
        await initializeAccountMenu();
    }

    updateFooterYear();
}

// ==================================================
// LOAD SHARED HTML COMPONENTS
// ==================================================

async function loadSharedComponent(elementId, filePath) {
    const container = document.getElementById(elementId);

    if (!container) {
        return false;
    }

    try {
        const response = await fetch(filePath);

        if (!response.ok) {
            throw new Error(
                `Failed to load ${filePath}: HTTP ${response.status}`
            );
        }

        container.innerHTML = await response.text();
        return true;

    } catch (error) {
        console.error("SmartFoodFinder component error:", error);

        container.textContent =
            "This section could not be loaded. Please refresh the page.";

        return false;
    }
}

// ==================================================
// NAVIGATION AND ACTIVE PAGE
// ==================================================

function initializeNavigation() {
    const menuToggle = document.querySelector(".menu-toggle");
    const navLinks = document.querySelector(".nav-links");

    const currentPath = normalizePath(window.location.pathname);

    if (navLinks) {
        navLinks.querySelectorAll("a[href]").forEach((link) => {
            const href = link.getAttribute("href");

            if (!href || href.startsWith("#")) {
                return;
            }

            const linkUrl = new URL(href, window.location.origin);

            if (linkUrl.origin !== window.location.origin) {
                return;
            }

            const linkPath = normalizePath(linkUrl.pathname);

            const isHome =
                (currentPath === "/" ||
                    currentPath === "/index/index.html") &&
                (linkPath === "/" ||
                    linkPath === "/index/index.html");

            const isCurrentPage =
                linkPath !== "/" &&
                linkPath !== "/index/index.html" &&
                currentPath === linkPath;

            const isActive = isHome || isCurrentPage;

            link.classList.toggle("active", isActive);

            if (isActive) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });
    }

    if (!menuToggle || !navLinks) {
        return;
    }

    function closeMenu() {
        navLinks.classList.remove("open");
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute(
            "aria-label",
            "Open navigation menu"
        );
    }

    menuToggle.addEventListener("click", () => {
        const isOpen = navLinks.classList.toggle("open");

        menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Close navigation menu" : "Open navigation menu"
        );
    });

    navLinks.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeMenu();
            closeAccountDropdown();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 850) {
            closeMenu();
        }
    });
}

// ==================================================
// ACCOUNT MENU
// ==================================================

async function initializeAccountMenu() {
    const avatar = document.getElementById("account-avatar");
    const dropdown = document.getElementById("account-dropdown");
    const loginLink = document.getElementById("account-login-link");
    const registerLink = document.getElementById("account-register-link");
    const fullName = document.getElementById("account-full-name");
    const email = document.getElementById("account-email");
    const logoutButton = document.getElementById("account-logout-button");

    if (
        !avatar ||
        !dropdown ||
        !loginLink ||
        !registerLink ||
        !fullName ||
        !email ||
        !logoutButton
    ) {
        return;
    }

    try {
        const response = await fetch("/api/auth/me", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error(
                `Login status request failed: ${response.status}`
            );
        }

        const user = await response.json();

        if (!user.authenticated) {
            return;
        }

        // Display the logged-in user's details.
        fullName.textContent = user.fullName || "User";
        email.textContent = user.email || "";

        // Show the circle instead of Login and Create Account.
        loginLink.hidden = true;
        registerLink.hidden = true;
        avatar.hidden = false;

    } catch (error) {
        console.error("Could not load account details:", error);
        return;
    }

    // Open or close the account dropdown.
    avatar.addEventListener("click", () => {
        const isOpening = dropdown.hidden;

        dropdown.hidden = !isOpening;
        avatar.setAttribute("aria-expanded", String(isOpening));
    });

    // Close the dropdown when clicking outside it.
    document.addEventListener("click", (event) => {
        if (!event.target.closest("#header-account")) {
            closeAccountDropdown();
        }
    });

    // Secure logout using Spring Security's CSRF token.
    logoutButton.addEventListener("click", async () => {
        logoutButton.disabled = true;

        try {
            const csrfResponse = await fetch("/api/auth/csrf", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!csrfResponse.ok) {
                throw new Error("Could not obtain the security token.");
            }

            const csrf = await csrfResponse.json();

            const headers = {};
            headers[csrf.headerName] = csrf.token;

            const logoutResponse = await fetch("/logout", {
                method: "POST",
                credentials: "same-origin",
                headers: headers
            });

            if (!logoutResponse.ok) {
                throw new Error("Logout request failed.");
            }

            window.location.href = "/account/login.html";

        } catch (error) {
            console.error("Logout error:", error);
            alert("Logout failed. Please try again.");
            logoutButton.disabled = false;
        }
    });
}

function closeAccountDropdown() {
    const dropdown = document.getElementById("account-dropdown");
    const avatar = document.getElementById("account-avatar");

    if (dropdown) {
        dropdown.hidden = true;
    }

    if (avatar) {
        avatar.setAttribute("aria-expanded", "false");
    }
}

// ==================================================
// NORMALIZE URL PATHS
// ==================================================

function normalizePath(path) {
    if (!path) {
        return "/";
    }

    const normalized = path.replace(/\/+$/, "");
    return normalized || "/";
}

// ==================================================
// FOOTER COPYRIGHT YEAR
// ==================================================

function updateFooterYear() {
    const currentYear = new Date().getFullYear();

    document.querySelectorAll("[data-year]").forEach((element) => {
        element.textContent = currentYear;
    });
}
