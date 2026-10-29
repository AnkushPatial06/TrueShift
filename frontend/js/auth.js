document.addEventListener("DOMContentLoaded", () => {
  if (TokenStore.getAccess()) {
    window.location.href = "dashboard.html"; // Default redirect; might need to adjust for employee
    return;
  }

  const loginForm = document.getElementById("login-form");
  const loginSubmitBtn = document.getElementById("login-submit");
  const loginPanel = document.getElementById("login-panel");
  const tfaPanel = document.getElementById("tfa-panel");
  const tfaForm = document.getElementById("tfa-form");
  const tfaSubmitBtn = document.getElementById("tfa-submit");
  // password toggle, forgot-password, and back-to-login are handled by login.html inline script

  let tempToken = null;

  // NOTE: password visibility toggle is handled by the inline script in login.html
  // (which also updates the eye SVG icon). Do not add a duplicate listener here.

  // NOTE: forgot-password panel and back-to-login navigation are handled
  // by the inline script in login.html (showPanel utility). No duplicate listeners needed here.

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("login-alert");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert("login-alert", "Invalid email format.");
      return;
    }
    if (password.length < 8) {
      showAlert("login-alert", "Password must be at least 8 characters.");
      return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "Signing in...";

    try {
      const resp = await apiRequest("/auth/login", {
        method: "POST",
        auth: false,
        body: { email, password },
      });
      
      if (resp.requires_2fa) {
        tempToken = resp.temp_token;
        loginPanel.classList.add("hidden");
        tfaPanel.classList.remove("hidden");
        document.getElementById("tfa-code").focus();
      } else {
        TokenStore.set(resp.access_token, resp.refresh_token);
        const me = await apiRequest("/auth/me");
        TokenStore.setUser(me);
        window.location.href = homeUrlForRole(me.role);
      }
    } catch (err) {
      showAlert("login-alert", err.message || "Login failed. Check your credentials.");
    } finally {
      loginSubmitBtn.disabled = false;
      loginSubmitBtn.textContent = "Sign in";
    }
  });

  tfaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideAlert("tfa-alert");

    const code = document.getElementById("tfa-code").value.trim();
    if (code.length !== 6) {
      showAlert("tfa-alert", "Please enter a 6-digit code.");
      return;
    }

    tfaSubmitBtn.disabled = true;
    tfaSubmitBtn.textContent = "Verifying...";

    try {
      const resp = await apiRequest("/auth/login/2fa", {
        method: "POST",
        auth: false,
        body: { temp_token: tempToken, code },
      });
      
      TokenStore.set(resp.access_token, resp.refresh_token);
      const me = await apiRequest("/auth/me");
      TokenStore.setUser(me);
      window.location.href = homeUrlForRole(me.role);
    } catch (err) {
      showAlert("tfa-alert", err.message || "2FA verification failed.");
      tfaSubmitBtn.disabled = false;
      tfaSubmitBtn.textContent = "Verify";
    }
  });
});
