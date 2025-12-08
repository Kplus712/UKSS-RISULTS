// js/auth.js
// Simple login / logout / page guard for UKSS

// Ni kurasa gani zinaruhusu mtu hata bila ku-login
const PUBLIC_PAGES = ["login.html", "index.html"];

// Jina la file la page tunayoangalia sasa
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// Hakikisha tuna auth (imetoka database.js)
if (typeof auth !== "undefined" && auth) {

  // ========= 1. Guard ya kurasa zote =========
  auth.onAuthStateChanged(function(user){
    if (!user && !isPublicPage) {
      // mtu haja-login, na page si public -> peleka login
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      // tayari kashalogin lakini yuko login.html -> peleka marks
      window.location.href = "marks.html";
    }
  });

  // ========= 2. Logout button kwa pages za ndani =========
  document.addEventListener("DOMContentLoaded", function(){
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", function(){
        auth.signOut()
          .then(function(){
            window.location.href = "login.html";
          })
          .catch(function(err){
            console.error(err);
            alert("Failed to logout: " + err.message);
          });
      });
    }
  });

  // ========= 3. Login form (login.html) =========
  document.addEventListener("DOMContentLoaded", function(){
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;  // si login page, toka kimya kimya

    const emailInput    = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorBox      = document.getElementById("loginError");
    const submitBtn     = document.getElementById("loginSubmit");

    loginForm.addEventListener("submit", function(e){
      e.preventDefault();

      const email = (emailInput?.value || "").trim();
      const pass  = passwordInput?.value || "";

      if (!email || !pass) {
        if (errorBox) errorBox.textContent = "Andika email na password.";
        return;
      }

      if (errorBox) errorBox.textContent = "";

      // Hapa tumebaki na UX rahisi tu – hatubadili disabled ili kuepuka error
      if (submitBtn) submitBtn.textContent = "Signing in...";

      auth.signInWithEmailAndPassword(email, pass)
        .then(function(){
          // redirect itashughulikiwa na onAuthStateChanged
        })
        .catch(function(err){
          console.error(err);
          if (errorBox) errorBox.textContent = err.message;
          if (submitBtn) submitBtn.textContent = "Login";
        });
    });
  });

} else {
  console.warn("Auth not available. auth.js running in guest mode.");
}





