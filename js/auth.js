// js/auth.js
// Handle login + role-based redirect

var $ = function(id){ return document.getElementById(id); };

function showError(msg){
  var el = $("loginError");
  if (el) el.textContent = msg || "";
}

/* ===== AUTO-REDIRECT KAMA TAYARI UMELOG-IN ===== */
auth.onAuthStateChanged(function(user){
  if (!user) return;

  var path = window.location.pathname.toLowerCase();
  var onLoginPage =
    path.endsWith("index.html") ||
    path.endsWith("/") ||
    path.indexOf("ukss-risults") !== -1 && !path.match(/\.html$/);

  if (onLoginPage){
    routeByRole(user);
  }
});

/* ===== SETUP LOGIN FORM ===== */
function setupLoginForm(){
  var form = $("loginForm");
  var btn  = $("loginBtn");

  if (!form || !btn) return;   // kama tuko kwenye page nyingine tuache kimya

  form.addEventListener("submit", function(e){
    e.preventDefault();
    showError("");

    var email = ($("email") || {}).value || "";
    var pass  = ($("password") || {}).value || "";

    if (!email.trim() || !pass){
      showError("Weka email na password.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Logging in...";

    auth.signInWithEmailAndPassword(email.trim(), pass)
      .then(function(cred){
        btn.disabled = false;
        btn.textContent = "Login";
        routeByRole(cred.user);
      })
      .catch(function(err){
        console.error("login error", err);
        btn.disabled = false;
        btn.textContent = "Login";

        var msg = "Imeshindikana ku-login. Hakikisha email & password ni sahihi.";
        if (err.code === "auth/user-not-found") msg = "Hakuna akaunti yenye email hii.";
        if (err.code === "auth/wrong-password") msg = "Nenosiri si sahihi.";
        if (err.code === "auth/invalid-email") msg = "Email si sahihi.";

        showError(msg);
      });
  });
}

// hakikisha handler inasetup hata kama DOMContentLoaded imeshapita
if (document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", setupLoginForm);
} else {
  setupLoginForm();
}

/* ===== ROLE-BASED ROUTING ===== */
async function routeByRole(user){
  try{
    var snap = await db.collection(col.staff).doc(user.uid).get();
    if (!snap.exists){
      showError("Hakuna staff profile. Mwone Admin akusajili kwenye 'staff'.");
      return;
    }

    var staff  = snap.data();
    var role   = staff.role || "none";
    var active = (staff.active !== false);

    if (!active){
      showError("Akaunti yako imewekwa kuwa INACTIVE. Mwone Admin / Headmaster.");
      return;
    }

    var target = "marks.html"; // default

    if (role === "admin" || role === "headmaster"){
      target = "admin.html";
    } else if (role === "academic"){
      target = "academic.html";
    } else if (role === "class_teacher"){
      target = "marks.html";
    }

    window.location.href = target;
  }catch(err){
    console.error("routeByRole error:", err);
    window.location.href = "marks.html";
  }
}
