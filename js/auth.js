// js/auth.js
"use strict";

/* ===========================
   HELPERS & LOGGING
=========================== */
const AUTH_PREFIX = "[AUTH]";

function log(...args){ console.log(AUTH_PREFIX, ...args); }
function warn(...args){ console.warn(AUTH_PREFIX, ...args); }
function err(...args){ console.error(AUTH_PREFIX, ...args); }

function el(id){
  return document.getElementById(id);
}

function setStatus(msg){
  const s = el("status") || el("loginStatus");
  if(!s) return;
  s.textContent = msg || "";
  s.className = "status";
}

function setError(msg){
  const e = el("loginError") || el("status");
  if(!e) return;
  e.textContent = msg || "";
  e.className = "status error";
}

/* ===========================
   FETCH ROLE FROM FIRESTORE
=========================== */
async function fetchUserRole(user){
  if(!user) return null;

  try{
    if(typeof db === "undefined"){
      warn("Firestore (db) not found");
      return null;
    }

    // 1️⃣ primary: staff/{uid}
    const doc = await db.collection("staff").doc(user.uid).get();
    if(doc.exists){
      return (doc.data().role || "").toLowerCase();
    }

    // 2️⃣ fallback: search by email
    const q = await db.collection("staff")
      .where("email", "==", user.email)
      .limit(1)
      .get();

    if(!q.empty){
      return (q.docs[0].data().role || "").toLowerCase();
    }

    return null;

  }catch(e){
    err("fetchUserRole failed:", e);
    return null;
  }
}

/* ===========================
   DOM READY
=========================== */
document.addEventListener("DOMContentLoaded", () => {

  if(typeof firebase === "undefined" || !firebase.auth){
    err("Firebase Auth not loaded. Check database.js");
    return;
  }

  const auth = firebase.auth();
  log("Auth initialized");

  const form = el("loginForm");
  if contando not exist, do nothing (page may be guard page)
  if(!form){
    log("No login form found on this page");
    return;
  }

  const emailInput = el("email");
  const passwordInput = el("password");
  const submitBtn = form.querySelector("button");

  /* ===========================
     LOGIN SUBMIT
  =========================== */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    setError("");
    setStatus("Inathibitisha taarifa...");

    const email = emailInput?.value.trim();
    const password = passwordInput?.value;

    if(!email || !password){
      setError("Tafadhali jaza email na password");
      return;
    }

    if(submitBtn){
      submitBtn.disabled = true;
      submitBtn.textContent = "Inaingia...";
    }

    try{
      // 🔐 Firebase Auth
      const cred = await auth.signInWithEmailAndPassword(email, password);
      const user = cred.user;

      log("Login success:", user.email);

      // 🧠 Get role
      const role = await fetchUserRole(user);
      if(!role){
        throw new Error("ROLE_NOT_ASSIGNED");
      }

      // Store session flag (for guards)
      sessionStorage.setItem("justSignedIn", "1");
      sessionStorage.setItem("userRole", role);
      sessionStorage.setItem("userName", user.displayName || user.email);

      setStatus(`Karibu ${role.toUpperCase()} 👋`);

      /* ===========================
         ROLE-BASED REDIRECT
      =========================== */
      setTimeout(() => {
        switch(role){
          case "admin":
            window.location.href = "admin.html";
            break;

          case "academic":
            window.location.href = "academic.html";
            break;

          case "headmaster":
            window.location.href = "results.html";
            break;

          case "teacher":
            window.location.href = "marks.html";
            break;

          default:
            warn("Unknown role:", role);
            window.location.href = "marks.html";
        }
      }, 700);

    }catch(e){
      err("Login failed:", e);

      let message = "Imeshindikana kuingia";

      if(e.code === "auth/user-not-found"){
        message = "Akaunti haipo";
      }else if(e.code === "auth/wrong-password"){
        message = "Password si sahihi";
      }else if(e.code === "auth/invalid-email"){
        message = "Email si sahihi";
      }else if(e.message === "ROLE_NOT_ASSIGNED"){
        message = "Huna ruhusa ya kuingia (role haijawekwa)";
      }

      setError(message);
      setStatus("");

      if(submitBtn){
        submitBtn.disabled = false;
        submitBtn.textContent = "Login";
      }
    }
  });

});





