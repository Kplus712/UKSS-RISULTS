// js/auth.js  — professional, single-responsibility auth guard + login handler
"use strict";

/*
  Expectations:
  - ./js/database.js must be loaded BEFORE this file. database.js should define globals:
      - firebase (SDK)
      - db (firestore instance)
      - auth (firebase.auth())
  - login.html contains #loginForm, #email, #password, #loginSubmit, #loginStatus, #loginError
  - marks.html contains the head guard that checks sessionStorage.justSignedIn === '1'
*/

const AUTH_LOG_PREFIX = "[AUTH]";

function log(...args){ console.log(AUTH_LOG_PREFIX, ...args); }
function warn(...args){ console.warn(AUTH_LOG_PREFIX, ...args); }
function err(...args){ console.error(AUTH_LOG_PREFIX, ...args); }

function el(id){ return document.getElementById(id); }
function setStatusText(txt){
  const s = el('loginStatus');
  if(!s) return;
  if(!txt){ s.classList.add('hidden'); s.textContent=''; }
  else { s.classList.remove('hidden'); s.textContent = txt; }
}
function setErrorText(txt){
  const e = el('loginError');
  if(!e){
    if(txt) alert(txt);
    return;
  }
  e.textContent = txt || '';
}

// small helper to fetch staff role (uid -> email fallback)
async function fetchRole(user){
  try{
    if(!user) return null;
    if(typeof db === 'undefined' || !db){
      warn('fetchRole: db not available');
      return null;
    }
    // prefer uid document
    const doc = await db.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role||'').toLowerCase();
    // fallback: query by email
    const q = await db.collection('staff').where('email','==', user.email||'').limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role||'').toLowerCase();
    return null;
  }catch(e){
    err('fetchRole error', e);
    return null;
  }
}

// simple welcome display (Notification API if available)
function showWelcome(title, msg){
  try{
    if("Notification" in window){
      if(Notification.permission === "granted"){
        new Notification(title, { body: msg });
        return;
      }
      if(Notification.permission !== "denied"){
        Notification.requestPermission().then(p => {
          if(p === "granted") new Notification(title, { body: msg });
          else setStatusText(msg);
        }).catch(()=> setStatusText(msg));
        return;
      }
    }
  }catch(e){
    // ignore
  }
  setStatusText(msg);
}

// redirect locking to avoid double redirects/races
let redirectLock = false;
function safeRedirect(url){
  if(redirectLock) { log('redirect blocked (lock active) to', url); return; }
  redirectLock = true;
  log('redirecting to', url);
  window.location.href = url;
}

// Core guard setup + one-time login submit wiring
document.addEventListener('DOMContentLoaded', function(){

  // Safety: ensure auth global exists
  if(typeof auth === 'undefined' || !auth){
    warn('Auth SDK not available. Ensure database.js (firebase init) loaded before auth.js.');
    return;
  }

  log('auth guard init on', window.location.pathname.split('/').pop() || 'index.html');

  // ---------- AUTH STATE CHANGED (no direct redirect on login pages) ----------
  auth.onAuthStateChanged(async function(user){
    log('onAuthStateChanged -> user:', user ? user.email : null);

    // If this is a protected page and there's no user -> force redirect to login (safe).
    // We consider the page public if it's login/index.
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const publicPages = ['login.html','index.html'];
    const isPublic = publicPages.includes(currentPath);

    if(!user && !isPublic){
      log('no user on protected page -> redirecting to login.html');
      // ensure flag removed
      try{ sessionStorage.removeItem('justSignedIn'); }catch(e){}
      safeRedirect('login.html');
      return;
    }

    // If user exists and we are on a login page, we DO NOT auto redirect here.
    // Redirect must be initiated by the login submit handler after setting the justSignedIn flag.
    // This prevents the "two UI / double login" race condition.
    // If you want to allow persistent session auto-login, implement a separate explicit flow.
  });

  // ---------- LOGIN FORM SUBMIT ----------
  const loginForm = el('loginForm');
  if(loginForm){
    log('Login form bound.');
    const emailEl = el('email');
    const passEl  = el('password');
    const submitBtn = el('loginSubmit');

    loginForm.addEventListener('submit', function(ev){
      ev.preventDefault();
      // reset messages
      setErrorText('');
      setStatusText('');

      const email = (emailEl && emailEl.value || '').trim();
      const pass  = (passEl && passEl.value || '');

      if(!email || !pass){
        setErrorText('Please enter email and password.');
        return;
      }

      // show status
      setStatusText('Logging in… please wait');
      if(submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }

      auth.signInWithEmailAndPassword(email, pass)
        .then(async cred => {
          log('signIn success (submit flow).');

          // mark the transition (marks.html head guard checks this)
          try{ sessionStorage.setItem('justSignedIn','1'); }catch(e){ warn('sessionStorage set failed', e); }

          // fetch role and welcome the user
          const user = auth.currentUser || (cred && cred.user);
          const role = await fetchRole(user);
          const roleLabel = role ? (role.charAt(0).toUpperCase() + role.slice(1)) : 'User';
          const welcomeMsg = `${user.email} — umeingia kama ${roleLabel}`;

          showWelcome(`Karibu ${roleLabel}`, welcomeMsg);

          // re-enable UI (clean)
          if(submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }

          // single place for redirect: do it after short delay
          setTimeout(()=> safeRedirect('marks.html'), 250);
        })
        .catch(e => {
          err('signIn failed', e);
          const message = e && e.message ? e.message : 'Login failed';
          setErrorText(message.indexOf('INVALID_LOGIN_CREDENTIALS') !== -1 ? 'Email au password si sahihi.' : message);
          setStatusText('');
          if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
        });
    });
  } else {
    log('No login form present on this page (skipping submit binding).');
  }

}); // DOMContentLoaded end






