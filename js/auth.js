// js/auth.js
// Simple Auth Guard + Login handling for UKSS

const PUBLIC_PAGES = ["login.html"];

const currentPath   = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage  = PUBLIC_PAGES.includes(currentPath);

// Hakikisha auth ime-load (imetoka database.js)
if (typeof auth !== "undefined" && auth) {

  // ====== AUTH STATE LISTENER ======
  auth.onAuthStateChanged(function(user) {
    if (!user && !isPublicPage) {
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      window.location.href = "marks.html";
    }
  });

  // ====== LOGOUT BUTTON (kurasa za ndani) ======
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      auth.signOut()
        .then(function() {
          window.location.href = "login.html";
        })
        .catch(function(err) {
          console.error(err);
          alert("Failed to logout: " + err.message);
        });
    });
  }

  // ====== LOGIN FORM (login.html) ======
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    const emailInput    = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorBox      = document.getElementById("loginError");
    const submitBtn     = document.getElementById("loginSubmit");

    loginForm.addEventListener("submit", function(e){
      e.preventDefault();

      const email = (emailInput?.value || "").trim();
      const pass  = passwordInput?.value || "";

      if (!email || !pass){
        if (errorBox) errorBox.textContent = "Andika email na password.";
        return;
      }

      if (errorBox) errorBox.textContent = "";

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Signing in...";
      }

      auth.signInWithEmailAndPassword(email, pass)
        .then(function(){
          // onAuthStateChanged itafanya redirect
        })
        .catch(function(err){
          console.error(err);
          if (errorBox) errorBox.textContent = err.message;
        })
        .finally(function(){
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Login";
          }
        });
    });
  }

} else {
  console.warn("Auth not available. auth.js running in guest mode.");
}




