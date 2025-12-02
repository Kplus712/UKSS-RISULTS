// js/auth.js
// UKSS — Staff Login

// auth na db zinatoka js/database.js
if (!auth) {
  console.error("Auth not initialized");
}

document.addEventListener("DOMContentLoaded", function () {
  var form     = document.getElementById("loginForm");
  var emailEl  = document.getElementById("email");
  var passEl   = document.getElementById("password");
  var btn      = document.getElementById("loginBtn");
  var errorEl  = document.getElementById("loginError");

  if (!form || !emailEl || !passEl || !btn) {
    console.error("Login elements not found in DOM");
    return;
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (errorEl) errorEl.textContent = "";
    btn.disabled = true;

    var email = (emailEl.value || "").trim();
    var password = passEl.value || "";

    if (!email || !password) {
      if (errorEl) errorEl.textContent = "Jaza email na password.";
      btn.disabled = false;
      return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then(function (cred) {
        console.log("login success:", cred.user.uid);
        window.location.href = "marks.html"; // au academic.html ukipenda
      })
      .catch(function (err) {
        // Hapa tunaona kosa halisi
        console.error("login error raw:", err, "code:", err.code, "message:", err.message);

        var msg = "Imeshindikana ku-login. ";

        if (err.code === "auth/user-not-found" ||
            (err.message && err.message.indexOf("EMAIL_NOT_FOUND") !== -1)) {
          msg += "Akaunti hii haijasajiliwa kwenye Firebase Authentication. Mwone admin akufungulie akaunti.";
        } else if (err.code === "auth/wrong-password" ||
                   (err.message && err.message.indexOf("INVALID_PASSWORD") !== -1)) {
          msg += "Password sio sahihi. Jaribu tena.";
        } else if (err.code === "auth/invalid-email") {
          msg += "Email sio sahihi. Hakikisha umeandika vizuri.";
        } else if (err.code === "auth/too-many-requests") {
          msg += "Maombi mengi sana ya ku-login. Jaribu tena baada ya muda mfupi.";
        } else if (err.message && err.message.indexOf("OPERATION_NOT_ALLOWED") !== -1) {
          msg += "Email/Password signin haijawezeshwa kwenye Firebase (Sign-in method → Email/Password).";
        } else {
          msg += (err.message || err.code || "");
        }

        if (errorEl) errorEl.textContent = msg;
      })
      .finally(function () {
        btn.disabled = false;
      });
  });
});



