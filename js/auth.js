// js/auth.js
// Login / logout / page guard for UKSS

const PUBLIC_PAGES = ["login.html", "index.html"];
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// =================== 1. GLOBAL GUARD ===================
document.addEventListener("DOMContentLoaded", function () {
  if (typeof auth === "undefined" || !auth) {
    console.warn("Auth SDK not available for guard.");
    return;
  }

  console.log("[AUTH] guard initialised on", currentPath);

  auth.onAuthStateChanged(function (user) {
    console.log("[AUTH] state changed:", user ? user.email : null);

    if (!user && !isPublicPage) {
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      window.location.href = "marks.html";
    }
  });

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      auth
        .signOut()
        .then(function () {
          window.location.href = "login.html";
        })
        .catch(function (err) {
          console.error(err);
          alert("Failed to logout: " + err.message);
        });
    });
  }
});

// =================== 2. LOGIN HANDLER ===================
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) {
    console.log("[AUTH] No login form on this page.");
    return;
  }
  console.log("[AUTH] Login form found. Binding submit handler.");

  const emailInput  = document.getElementById("email");
  const passInput   = document.getElementById("password");
  const errorBox    = document.getElementById("loginError");
  const submitBtn   = document.getElementById("loginSubmit");
  const statusBox   = document.getElementById("loginStatus");

  function showError(msg){
    console.error("[AUTH] login error:", msg);
    if (errorBox) errorBox.textContent = msg;
    else alert(msg);
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    console.log("[AUTH] Login submit clicked.");

    const email = (emailInput?.value || "").trim();
    const pass  = passInput?.value || "";

    if (!email || !pass) {
      showError("Please enter email and password.");
      return;
    }

    if (typeof auth === "undefined" || !auth) {
      showError(
        "System auth is not initialised. Hakikisha firebase-auth.js na database.js zimepakiwa vizuri."
      );
      return;
    }

    if (errorBox) errorBox.textContent = "";

    if (statusBox) {
      statusBox.innerHTML =
        '<span class="loader"></span> Logging in… please wait';
      statusBox.classList.remove("hidden");
    }

    if (submitBtn) {
      submitBtn.textContent = "Logging in...";
      submitBtn.disabled = true;
    }

    auth
      .signInWithEmailAndPassword(email, pass)
      .then(function () {
        console.log("[AUTH] signIn success, waiting for onAuthStateChanged");
      })
      .catch(function (err) {
        showError(err.message);

        if (statusBox) {
          statusBox.textContent = "";
          statusBox.classList.add("hidden");
        }
        if (submitBtn) {
          submitBtn.textContent = "Login";
          submitBtn.disabled = false;
        }
      });
  });
});




