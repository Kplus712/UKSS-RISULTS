// js/auth.js  — REPLACE your old file with this
"use strict";

// Pages
const LOGIN_PAGES  = ["login.html", "index.html"];
const PUBLIC_PAGES = ["login.html", "index.html"];
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// Helpers
function el(id){ return document.getElementById(id); }
function setStatus(text){
  const s = el('loginStatus');
  if(!s) return;
  if(!text){ s.classList.add('hidden'); s.textContent=''; }
  else { s.classList.remove('hidden'); s.textContent = text; }
}
function setError(text){
  const e = el('loginError');
  if(e) e.textContent = text || '';
  else if(text) console.warn('loginError:', text);
}
function showWelcome(title, body){
  try{
    if ("Notification" in window){
      if(Notification.permission === "granted"){
        new Notification(title, { body });
        return;
      }
      if(Notification.permission !== "denied"){
        Notification.requestPermission().then(p=>{
          if(p === "granted") new Notification(title,{body});
          else { const s = el('loginStatus'); if(s){ s.classList.remove('hidden'); s.textContent = body; } else alert(title+"\n\n"+body); }
        }).catch(()=>{
          const s = el('loginStatus'); if(s){ s.classList.remove('hidden'); s.textContent = body; } else alert(title+"\n\n"+body);
        });
        return;
      }
    }
    const s = el('loginStatus'); if(s){ s.classList.remove('hidden'); s.textContent = body; } else alert(title+"\n\n"+body);
  }catch(e){
    const s = el('loginStatus'); if(s){ s.classList.remove('hidden'); s.textContent = body; } else alert(title+"\n\n"+body);
  }
}

// get DB helper (optional)
function getDb(){
  if(typeof db !== 'undefined' && db) return db;
  if(typeof firebase !== 'undefined' && firebase && firebase.firestore) return firebase.firestore();
  return null;
}

// fetch role helper
async function fetchRoleForUser(user){
  if(!user) return null;
  const dbRef = getDb();
  if(!dbRef) return null;
  try{
    const doc = await dbRef.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role || '').toLowerCase();
    const q = await dbRef.collection('staff').where('email','==',user.email).limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role || '').toLowerCase();
    return null;
  }catch(err){
    console.error('fetchRoleForUser error', err);
    return null;
  }
}

// =================== GUARD (onAuthStateChanged) ===================
document.addEventListener("DOMContentLoaded", function () {
  if (typeof auth === "undefined" || !auth) {
    console.warn("Auth SDK not available for guard.");
    return;
  }

  console.log("[AUTH] auth guard init on", currentPath);

  auth.onAuthStateChanged(function (user) {
    console.log("[AUTH] onAuthStateChanged -> user:", user ? user.email : null);

    // If no user and page is protected -> redirect to login
    if (!user && !isPublicPage) {
      console.log("[AUTH] no user on protected page -> redirect to login");
      window.location.href = "login.html";
      return;
    }

    // IMPORTANT: Do NOT auto-redirect to marks.html here when on login pages.
    // That causes a race with signIn handler (which sets sessionStorage.justSignedIn).
    // We only let login submit handler perform the redirect after it sets the flag.
    // However, if you prefer automatic redirect for persistent sessions, implement a guarded flow:
    // if (user && LOGIN_PAGES.includes(currentPath) && sessionStorage.getItem('justSignedIn')==='1') { ... }
    // For now keep onAuthStateChanged quiet on login pages to avoid race loops.
  });

  // Logout
  const logoutBtn = el("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      auth.signOut().then(function () {
        sessionStorage.removeItem('justSignedIn');
        window.location.href = "login.html";
      }).catch(function (err) {
        console.error(err);
        alert("Failed to logout: " + err.message);
      });
    });
  }
});

// =================== LOGIN HANDLER (explicit redirect only here) ===================
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = el("loginForm");
  if (!loginForm) {
    console.log("[AUTH] No login form on this page.");
    return;
  }
  console.log("[AUTH] Login form bound.");

  const emailInput  = el("email");
  const passInput   = el("password");
  const errorBox    = el("loginError");
  const submitBtn   = el("loginSubmit");
  const statusBox   = el("loginStatus");

  function showError(msg){
    console.error("[AUTH] login error:", msg);
    let nice = msg;
    if (msg && msg.indexOf("INVALID_LOGIN_CREDENTIALS") !== -1) {
      nice = "Email au password si sahihi. Hakikisha zinafanana na Firebase Auth.";
    }
    if (errorBox) errorBox.textContent = nice;
    else alert(nice);
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (errorBox) errorBox.textContent = "";

    const email = (emailInput?.value || "").trim();
    const pass  = passInput?.value || "";

    if (!email || !pass) {
      showError("Please enter email and password.");
      return;
    }

    if (typeof auth === "undefined" || !auth) {
      showError("System auth is not initialised.");
      return;
    }

    if (statusBox) {
      statusBox.innerHTML = '<span class="loader"></span> Unatafuta…';
      statusBox.classList.remove("hidden");
    }
    if (submitBtn) {
      submitBtn.textContent = "Logging in...";
      submitBtn.disabled = true;
    }

    // Sign in. On success: set justSignedIn BEFORE redirect.
    auth.signInWithEmailAndPassword(email, pass)
      .then(async function (cred) {
        console.log("[AUTH] signIn success (submit flow).");

        // mark fresh transition
        try { sessionStorage.setItem('justSignedIn', '1'); } catch(e){ console.warn('sessionStorage set failed', e); }

        // optional: fetch role to show welcome
        const user = auth.currentUser || (cred && cred.user);
        const role = await fetchRoleForUser(user);
        const roleLabel = role ? role.charAt(0).toUpperCase()+role.slice(1) : "User";
        const welcomeTitle = `Karibu ${roleLabel}`;
        const welcomeBody  = user && user.email ? `${user.email} — umeingia kama ${roleLabel}` : `Umeingia kama ${roleLabel}`;

        showWelcome(welcomeTitle, welcomeBody);
        if (statusBox) statusBox.textContent = welcomeBody;

        // re-enable UI
        if (submitBtn) { submitBtn.textContent = "Login"; submitBtn.disabled = false; }

        // Redirect to marks.html (this is the single redirect action)
        setTimeout(()=> { window.location.href = "marks.html"; }, 300);
      })
      .catch(function (err) {
        showError(err.message || String(err));
        if (statusBox) { statusBox.textContent = ""; statusBox.classList.add("hidden"); }
        if (submitBtn) { submitBtn.textContent = "Login"; submitBtn.disabled = false; }
      });
  });
});






