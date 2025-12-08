// js/auth.js
// Login / logout / page guard for UKSS

const PUBLIC_PAGES = ["login.html", "index.html"];
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// ========== 1. GLOBAL GUARD (kama auth ipo) ==========
document.addEventListener("DOMContentLoaded", function () {
  if (typeof auth === "undefined" || !auth) {
    console.warn("Auth SDK not available yet. Page guard is disabled.");
    return;
  }

  // linda kurasa za ndani
  auth.onAuthStateChanged(function (user) {
    if (!user && !isPublicPage) {
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      window.location.href = "marks.html";
    }
  });

  // logout button (kurasa za ndani)
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

// ========== 2. LOGIN FORM (inafanya kazi hata kama auth haipo, itaonyesha error) ==========
document.addEventListener("DOMContentLoaded", function () {
  const loginForm   = document.getElementById("loginForm");
  if (!loginForm) return; // sio login page

  const emailInput  = document.getElementById("email");
  const passInput   = document.getElementById("password");
  const errorBox    = document.getElementById("loginError");
  const submitBtn   = document.getElementById("loginSubmit");
  const statusBox   = document.getElementById("loginStatus");

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const email = (emailInput?.value || "").trim();
    const pass  = passInput?.value || "";

    if (!email || !pass) {
      if (errorBox) errorBox.textContent = "Please enter email and password.";
      return;
    }

    // kama auth haijapatikana kabisa, tujulishe wazi
    if (typeof auth === "undefined" || !auth) {
      if (errorBox)
        errorBox.textContent =
          "System auth is not initialised. Hakikisha firebase-auth.js na database.js zimepakiwa vizuri.";
      return;
    }

    if (errorBox) errorBox.textContent = "";

    // show status "logging in..."
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
        // success -> onAuthStateChanged itafanya redirect
      })
      .catch(function (err) {
        console.error(err);
        if (errorBox) errorBox.textContent = err.message;

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




