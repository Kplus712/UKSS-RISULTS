// js/auth.js
// Handle login + role-based redirect

var $ = function(id){ return document.getElementById(id); };

function showError(msg){
  var el = $("loginError");
  if (el) el.textContent = msg || "";
}

function toast(text){
  console.log(text);
}

// on page load, kama mtu tayari yuko logged-in tunam-route moja kwa moja
auth.onAuthStateChanged(function(user){
  if (!user) return; // akaunti haija-login bado

  // kama tuko kwenye index.html, tum-route
  if (window.location.pathname.toLowerCase().indexOf("index") !== -1 ||
      window.location.pathname === "/" ||
      window.location.pathname.endsWith(".github.io/")){

    routeByRole(user);
  }
});

/* ===== LOGIN FORM SUBMIT ===== */
document.addEventListener("DOMContentLoaded", function(){
  var form = $("loginForm");
  var btn  = $("loginBtn");

  if (!form) return;

  form.addEventListener("submit", function(e){
    e.preventDefault();
    showError("");
    if (!btn) return;

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
});

/* ===== ROLE-BASED ROUTING ===== */
/*
   staff.role:
   - admin       -> admin.html
   - headmaster  -> admin.html (anapewa wider control)
   - academic    -> academic.html
   - class_teacher / others -> marks.html
*/
async function routeByRole(user){
  try{
    var uid = user.uid;

    // some pages zinaweza kuitwa kabla db ku-initialize, hakikisha ipo
    if (!db || !col || !col.staff){
      window.location.href = "marks.html";
      return;
    }

    var snap = await db.collection(col.staff).doc(uid).get();
    var staff = snap.exists ? snap.data() : {};
    var role  = staff.role || "none";
    var active = (staff.active !== false);

    if (!active){
      // akaunti imezuiwa, mruhusu tu aone error
      showError("Akaunti yako imewekwa kuwa INACTIVE. Mwone Admin / Headmaster.");
      return;
    }

    var target = "marks.html";  // default

    if (role === "admin" || role === "headmaster"){
      target = "admin.html";
    }else if (role === "academic"){
      target = "academic.html";
    }else if (role === "class_teacher"){
      target = "marks.html";
    }

    window.location.href = target;
  }catch(err){
    console.error("routeByRole error:", err);
    // kama kuna shida na staff doc, peleka tu marks.html
    window.location.href = "marks.html";
  }
}
