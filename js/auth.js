// js/auth.js (REPLACE your old auth.js with this file)
// Depends on: firebase SDK loaded and js/database.js (which defines global `auth` and `db`)

"use strict";

/*
 Behavior:
 - Uses global `auth` and `db` from ./js/database.js
 - Prevents app pages from being accessible when not logged in
 - Login form shows "Unatafuta..." status while role is resolved
 - After successful login, shows welcome notification (Notification API or UI fallback)
 - Redirects to marks.html on success (same behavior as before)
 - Safeguard: if an anonymous user is present, signs out to force explicit login
*/

const LOGIN_PAGES  = ["login.html", "index.html"];
const PUBLIC_PAGES = ["login.html", "index.html"];
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

function el(id){ return document.getElementById(id); }
function showEl(id){ const e = el(id); if(e) e.classList.remove('hidden'); }
function hideEl(id){ const e = el(id); if(e) e.classList.add('hidden'); }
function setStatus(text){
  const s = el('loginStatus');
  if(!s) return;
  if(!text) { s.classList.add('hidden'); s.textContent = ''; }
  else { s.classList.remove('hidden'); s.textContent = text; }
}
function setError(text){
  const e = el('loginError');
  if(!e) { if(text) alert(text); return; }
  e.textContent = text || '';
}

// Notification helper (tries Notification API, falls back to UI or alert)
function showWelcomeNotification(title, body){
  // prefer Notification API
  try{
    if("Notification" in window){
      if(Notification.permission === "granted"){
        new Notification(title, { body });
        return;
      }
      if(Notification.permission !== "denied"){
        Notification.requestPermission().then(perm => {
          if(perm === "granted") new Notification(title, { body });
          else {
            // fallback to UI
            const status = el('loginStatus');
            if(status){ status.classList.remove('hidden'); status.textContent = body; }
            else alert(title + "\n\n" + body);
          }
        }).catch(()=>{
          const status = el('loginStatus');
          if(status){ status.classList.remove('hidden'); status.textContent = body; }
          else alert(title + "\n\n" + body);
        });
        return;
      }
    }
    // fallback
    const status = el('loginStatus');
    if(status){ status.classList.remove('hidden'); status.textContent = body; }
    else alert(title + "\n\n" + body);
  }catch(e){
    const status = el('loginStatus');
    if(status){ status.classList.remove('hidden'); status.textContent = body; }
    else alert(title + "\n\n" + body);
  }
}

// db helper
function getDb(){
  if(typeof db !== 'undefined' && db) return db;
  if(typeof firebase !== 'undefined' && firebase && firebase.firestore) return firebase.firestore();
  return null;
}

// fetch role from staff collection (uid preferred, fallback to email)
async function fetchRoleForUser(user){
  if(!user) return null;
  const dbRef = getDb();
  if(!dbRef) return null;
  try{
    // try uid
    const doc = await dbRef.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role || '').toLowerCase();
    // fallback: search by email
    const q = await dbRef.collection('staff').where('email','==',user.email).limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role || '').toLowerCase();
    return null;
  }catch(err){
    console.error('fetchRoleForUser error', err);
    return null;
  }
}

// Utility to capitalise role label
function cap(s){ if(!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }

// -------------- Global Guard (auth state) --------------
document.addEventListener('DOMContentLoaded', function(){
  if(typeof auth === 'undefined' || !auth){
    console.warn('[AUTH] auth global not available. Ensure database.js is loaded before auth.js.');
    return;
  }

  console.log('[AUTH] guard initialising on', currentPath);

  // If an anonymous user exists (unexpected), sign them out to force explicit login
  // This prevents accidental anonymous sessions that show app without credentials
  if(auth.currentUser && auth.currentUser.isAnonymous){
    console.warn('[AUTH] anonymous session detected - signing out to force explicit login.');
    auth.signOut().catch(e => console.warn('Sign out failed', e));
  }

  auth.onAuthStateChanged(async function(user){
    console.log('[AUTH] state changed:', user ? user.email : null);

    // No user and page is protected -> redirect to login
    if(!user && !isPublicPage){
      console.log('[AUTH] no user - redirect to login');
      window.location.href = 'login.html';
      return;
    }

    // If user exists and we're on login page -> go to marks (original flow)
    if(user && LOGIN_PAGES.includes(currentPath)){
      console.log('[AUTH] logged in on login page; redirecting to marks.html');
      window.location.href = 'marks.html';
      return;
    }

    // If user exists on protected page, optionally prefetch role (no UI reveal here)
    // We will let page components decide what to show depending on role.
  });

  // Logout binding (common selector across pages)
  const logoutBtn = el('logoutBtn');
  if(logoutBtn){
    logoutBtn.addEventListener('click', function(){
      auth.signOut().then(()=> window.location.href = 'login.html').catch(err=> { console.error(err); alert('Failed to logout: '+ err.message); });
    });
  }
});

// -------------- Login handler (with search status + welcome) --------------
document.addEventListener('DOMContentLoaded', function(){
  const form = el('loginForm');
  if(!form){
    console.log('[AUTH] No login form found on this page; skipping login handler.');
    return;
  }

  const emailInput = el('email');
  const passInput  = el('password');
  const submitBtn  = el('loginSubmit');
  const errorBox   = el('loginError');
  const statusBox  = el('loginStatus');

  function showError(msg){
    console.error('[AUTH] login error:', msg);
    if(errorBox){ errorBox.textContent = msg; }
    else alert(msg);
  }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    if(!auth){
      showError('System auth not initialised.');
      return;
    }

    const email = (emailInput && emailInput.value || '').trim();
    const pass  = (passInput && passInput.value) || '';

    if(!email || !pass){
      showError('Please enter email and password.');
      return;
    }

    // UI: show searching status
    if(statusBox){ statusBox.classList.remove('hidden'); statusBox.innerHTML = '<span class="loader"></span> Unatafuta… taarifa zako, subiri kidogo'; }
    if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }
    if(errorBox) errorBox.textContent = '';

    // sign in
    auth.signInWithEmailAndPassword(email, pass)
      .then(async cred => {
        console.log('[AUTH] signIn successful, fetching role...');
        const user = auth.currentUser || (cred && cred.user);
        // show searching role status
        if(statusBox) statusBox.innerHTML = '<span class="loader"></span> Unatafuta role yako...';

        const role = await fetchRoleForUser(user);
        const roleLabel = role ? cap(role) : 'User';
        const title = `Karibu ${roleLabel}`;
        const body  = `${user.email} — umeingia kama ${roleLabel}`;

        // show Notification (or fallback)
        showWelcomeNotification(title, body);

        // set statusBox for UX
        if(statusBox){ statusBox.textContent = body; }

        // re-enable button (cosmetic)
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Login'; }

        // redirect to marks (preserve existing flow)
        setTimeout(()=> window.location.href = 'marks.html', 500);
      })
      .catch(err => {
        console.error('[AUTH] signIn error', err);
        // show friendly message where possible
        let msg = (err && err.message) ? err.message : String(err);
        if(msg && msg.indexOf('INVALID_LOGIN_CREDENTIALS') !== -1) msg = 'Email au password si sahihi.';
        showError(msg);

        if(statusBox){ statusBox.classList.add('hidden'); statusBox.textContent = ''; }
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      });
  });

});







