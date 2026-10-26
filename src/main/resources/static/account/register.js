
const registerForm = document.getElementById("register-form");
const registerButton = document.getElementById("register-button");
const messageBox = document.getElementById("form-message");

function showMessage(message, type = "error") {
    if (!messageBox) return;

    messageBox.textContent = message;
    messageBox.className = `form-message ${type}`;
    messageBox.hidden = false;
}

// Show or hide passwords
document.querySelectorAll(".toggle-password").forEach(button => {
    button.addEventListener("click", () => {
        const input = document.getElementById(button.dataset.target);

        if (!input) return;

        const showPassword = input.type === "password";
        input.type = showPassword ? "text" : "password";
        button.textContent = showPassword ? "Hide" : "Show";
    });
});

if (registerForm) {
    registerForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (messageBox) {
            messageBox.hidden = true;
        }

        const fullName =
            document.getElementById("fullName").value.trim();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        const confirmPassword =
            document.getElementById("confirmPassword").value;

        if (!fullName) {
            showMessage("Please enter your full name.");
            return;
        }

        if (password.length < 8) {
            showMessage(
                "Your password must contain at least 8 characters."
            );
            return;
        }

        if (password.length > 72) {
            showMessage("Your password is too long.");
            return;
        }

        if (password !== confirmPassword) {
            showMessage("The passwords do not match.");
            return;
        }

        registerButton.disabled = true;
        registerButton.textContent = "Creating account...";

        try {
            const response = await fetch("/api/auth/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    fullName,
                    email,
                    password
                })
            });

            const responseText = await response.text();

            let result = {};

            if (responseText) {
                try {
                    result = JSON.parse(responseText);
                } catch {
                    result = { message: responseText };
                }
            }

            if (!response.ok) {
                let errorMessage;

                switch (response.status) {
                    case 400:
                        errorMessage =
                            result.message ||
                            result.detail ||
                            "Please check your name, email and password.";
                        break;

                    case 401:
                        errorMessage =
                            "Authentication is required for this request.";
                        break;

                    case 403:
                        errorMessage =
                            "Request blocked by security protection (403). " +
                            "Check Spring Security and CSRF configuration.";
                        break;

                    case 409:
                        errorMessage =
                            result.message ||
                            "An account with this email already exists.";
                        break;

                    default:
                        errorMessage =
                            result.message ||
                            result.detail ||
                            `Registration failed (HTTP ${response.status}).`;
                }

                throw new Error(errorMessage);
            }

            showMessage(
                result.message ||
                "Account created successfully! Redirecting to login...",
                "success"
            );

            registerForm.reset();

            window.setTimeout(() => {
                window.location.href =
                    "/account/login.html?registered";
            }, 1200);

        } catch (error) {
            console.error("Registration error:", error);

            showMessage(
                error.message ||
                "Unable to contact the server. Check that Spring Boot is running."
            );

        } finally {
            registerButton.disabled = false;
            registerButton.textContent = "Create Account";
        }
    });
} else {
    console.error("Registration form was not found in register.html");
}
