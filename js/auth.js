// js/auth.js
// Simple Auth Guard + Login handling for UKSS

// Kurasa ambazo hazihitaji login
const PUBLIC_PAGES = ["login.html"];

// Tafuta jina la file (marks.html, sms.html, n.k.)
const currentPath = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// Hakikisha auth ime-load
if (typeof auth !== "undefined" && auth) {

  // ====== AUTH STATE LISTENER ======
  auth.onAuthStateChanged(function(user) {
    if (!user && !isPublicPage) {
      // hakuna user, lakini page ni protected → mpeleke login
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      // kisha/logged in, akiwa kwenye login → mpeleke home
      window.location.href = "marks.html";
    }
  });

  // ====== LOGOUT BUTTON (kwenye pages kama sms.html, marks.html, …) ======
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function() {
      auth.signOut().then(function() {
        window.location.href = "login.html";
      }).catch(function(err){
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
      const email = emailInput.value.trim();
      const pass  = passwordInput.value;

      if (!email || !pass){
        errorBox.textContent = "Andika email na password.";
        return;
      }

      errorBox.textContent = "";
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing in...";

      auth.signInWithEmailAndPassword(email, pass)
        .then(function(){
          // onAuthStateChanged itam-handle redirect
        })
        .catch(function(err){
          console.error(err);
          errorBox.textContent = err.message;
        })
        .finally(function(){
          submitBtn.disabled = false;
          submitBtn.textContent = "Login";
        });
    });
  }

} else {
  console.warn("Auth not available. auth.js running in guest mode.");
}



