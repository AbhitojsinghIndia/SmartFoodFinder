
const loginForm = document.getElementById("login-form");
const loginButton = document.getElementById("login-button");
const messageBox = document.getElementById("form-message");

function showMessage(message, type = "error") {
    messageBox.textContent = message;
    messageBox.className = `form-message ${type}`;
    messageBox.hidden = false;
}

function getCookie(name) {
    const prefix = `${name}=`;
    const cookie = document.cookie
        .split("; ")
        .find(item => item.startsWith(prefix));

    return cookie
        ? decodeURIComponent(cookie.substring(prefix.length))
        : null;
}

loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    messageBox.hidden = true;

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    try {
        // Request a CSRF token before submitting login credentials.
        const csrfResponse = await fetch("/api/auth/csrf", {
            credentials: "same-origin"
        });

        if (!csrfResponse.ok) {
            throw new Error("Unable to initialise secure login. Please try again.");
        }

        const csrf = await csrfResponse.json();
        const token = csrf.token || getCookie("XSRF-TOKEN");

        if (!token) {
            throw new Error("Security token missing. Please refresh the page.");
        }

        const body = new URLSearchParams();
        body.append("email", email);
        body.append("password", password);

        const response = await fetch("/login", {
            method: "POST",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                [csrf.headerName || "X-XSRF-TOKEN"]: token
            },
            body: body.toString(),
            redirect: "follow"
        });

        if (response.redirected && response.url.includes("/account/login.html")) {
            throw new Error("Incorrect email or password. Please try again.");
        }

        if (!response.ok) {
            throw new Error("Login failed. Please check your credentials.");
        }

        window.location.href = "/";
    } catch (error) {
        showMessage(error.message || "Unable to connect to the server.");
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "Login";
    }
});
