// js/auth.js
// Login / logout / page guard for UKSS

// Pages zinazochukuliwa kama "login pages"
const LOGIN_PAGES  = ["login.html", "index.html"];
// Pages zinazoruhusu kutembelewa bila login
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

    // Hakuna user, na page si public → peleka login
    if (!user && !isPublicPage) {
      window.location.href = "login.html";
      return;
    }

    // Kuna user, na tupo kwenye mojawapo ya login pages → peleka marks
    if (user && LOGIN_PAGES.includes(currentPath)) {
      console.log("[AUTH] logged in on login page, redirecting to marks.html");
      window.location.href = "marks.html";
    }
  });

  // Logout button (kwa marks, sms, results, n.k.)
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

    let niceMessage = msg;
    if (msg && msg.indexOf("INVALID_LOGIN_CREDENTIALS") !== -1) {
      niceMessage = "Email au password si sahihi. Hakikisha zinafanana na zilizoko Firebase Auth.";
    }

    if (errorBox) errorBox.textContent = niceMessage;
    else alert(niceMessage);
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
      showError("System auth is not initialised. Hakikisha firebase-auth.js na database.js zimepakiwa vizuri.");
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
        // onAuthStateChanged sasa itakukimbiza marks.html
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





