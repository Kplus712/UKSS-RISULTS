// js/auth.js
// Simple login / logout / page guard for UKSS

// kurasa zinazoruhusu kuonekana bila login
const PUBLIC_PAGES = ["login.html", "index.html"];

const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// hakikisha auth ipo (imetoka database.js)
if (typeof auth !== "undefined" && auth) {

  // 1. Guard ya global (kulinda kurasa za ndani)
  auth.onAuthStateChanged(function(user){
    if (!user && !isPublicPage) {
      // hakuna user na page si public -> peleka login
      window.location.href = "login.html";
      return;
    }

    if (user && currentPath === "login.html") {
      // tayari kashalogin lakini yuko login page -> peleka home
      window.location.href = "marks.html";
    }
  });

  // 2. Logout button (kwa marks.html, sms.html, n.k.)
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

  // 3. Login form (login.html) + status notification
  document.addEventListener("DOMContentLoaded", function(){
    const loginForm = document.getElementById("loginForm");
    if (!loginForm) return;   // tukiwa sio login page, skip

    const emailInput    = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const errorBox      = document.getElementById("loginError");
    const submitBtn     = document.getElementById("loginSubmit");
    const statusBox     = document.getElementById("loginStatus");

    loginForm.addEventListener("submit", function(e){
      e.preventDefault();

      const email = (emailInput?.value || "").trim();
      const pass  = passwordInput?.value || "";

      if (!email || !pass) {
        if (errorBox) errorBox.textContent = "Please enter email and password.";
        return;
      }

      if (errorBox) errorBox.textContent = "";

      // onyesha notification ya "logging in"
      if (statusBox) {
        statusBox.innerHTML = `<span class="loader"></span> Logging in… please wait`;
        statusBox.classList.remove("hidden");
      }

      // update button (optionally disable)
      if (submitBtn) {
        submitBtn.textContent = "Logging in...";
        submitBtn.disabled = true;
      }

      auth.signInWithEmailAndPassword(email, pass)
        .then(function(){
          // success: onAuthStateChanged itafanya redirect
          // notification itaondoka automatically baada ya redirect
        })
        .catch(function(err){
          console.error(err);
          if (errorBox)  errorBox.textContent = err.message;

          // hide status
          if (statusBox) {
            statusBox.textContent = "";
            statusBox.classList.add("hidden");
          }

          // re-enable button
          if (submitBtn) {
            submitBtn.textContent = "Login";
            submitBtn.disabled = false;
          }
        });
    });
  });

} else {
  console.warn("Auth not available. auth.js running in guest mode.");
}



