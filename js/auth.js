// js/auth.js
// UKSS — Login logic

// auth na db zimetoka js/database.js
if (!auth) {
  console.error("Auth not initialized");
}

document.addEventListener("DOMContentLoaded", function () {
  var emailEl = document.getElementById("emailInput");
  var passEl  = document.getElementById("passwordInput");
  var btn     = document.getElementById("loginBtn");

  if (!emailEl || !passEl || !btn) {
    console.error("Login elements not found in DOM");
    return;
  }

  btn.addEventListener("click", function (e) {
    e.preventDefault();

    var email = (emailEl.value || "").trim();
    var password = passEl.value || "";

    if (!email || !password) {
      alert("Jaza email na password.");
      return;
    }

    auth.signInWithEmailAndPassword(email, password)
      .then(function (cred) {
        console.log("login success:", cred.user.uid);
        // baada ya login, nenda kwenye marks/academic
        window.location.href = "marks.html"; // au academic.html, kulingana na mfumo wako
      })
      .catch(function (err) {
        console.error("login error raw:", err);

        var msg = "Imeshindikana ku-login. ";
        if (err.code === "auth/user-not-found" || (err.message && err.message.indexOf("EMAIL_NOT_FOUND") !== -1)) {
          msg += "Akaunti hii haijasajiliwa. Mwone admin akufungulie akaunti.";
        } else if (err.code === "auth/wrong-password" || (err.message && err.message.indexOf("INVALID_PASSWORD") !== -1)) {
          msg += "Password sio sahihi. Jaribu tena.";
        } else if (err.code === "auth/invalid-email") {
          msg += "Email sio sahihi.";
        } else if (err.message && err.message.indexOf("OPERATION_NOT_ALLOWED") !== -1) {
          msg += "Email/Password signin haijawezeshwa kwenye Firebase Authentication.";
        } else {
          msg += "(" + (err.code || "unknown") + ")";
        }

        alert(msg);
      });
  });
});

