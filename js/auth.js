// js/auth.js  (FORCE fresh login unless user just signed in)
// Replaces your previous auth.js. Works with your existing database.js (auth + db globals).

"use strict";

const LOGIN_PAGES  = ["login.html", "index.html"];
const PUBLIC_PAGES = ["login.html", "index.html"];
const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// helper DOM
function el(id){ return document.getElementById(id); }
function setStatusText(txt){
  const s = el('loginStatus');
  if(!s) return;
  if(!txt){ s.classList.add('hidden'); s.textContent=''; }
  else { s.classList.remove('hidden'); s.textContent = txt; }
}
function setError(txt){
  const e = el('loginError');
  if(e) e.textContent = txt || '';
  else if(txt) console.warn('loginError:', txt);
}

// notification fallback
function showWelcomeNotification(title, body){
  try{
    if("Notification" in window){
      if(Notification.permission === "granted"){
        new Notification(title, { body });
        return;
      }
      if(Notification.permission !== "denied"){
        Notification.requestPermission().then(p => {
          if(p === "granted") new Notification(title, { body });
          else {
            const s = el('loginStatus');
            if(s){ s.classList.remove('hidden'); s.textContent = body; }
            else alert(title + "\n\n" + body);
          }
        }).catch(()=> {
          const s = el('loginStatus');
          if(s){ s.classList.remove('hidden'); s.textContent = body; }
          else alert(title + "\n\n" + body);
        });
        return;
      }
    }
    // fallback
    const s = el('loginStatus');
    if(s){ s.classList.remove('hidden'); s.textContent = body; }
    else alert(title + "\n\n" + body);
  }catch(e){
    const s = el('loginStatus');
    if(s){ s.classList.remove('hidden'); s.textContent = body; }
    else alert(title + "\n\n" + body);
  }
}

// db helper
function getDb(){
  if(typeof db !== 'undefined' && db) return db;
  if(typeof firebase !== 'undefined' && firebase && firebase.firestore) return firebase.firestore();
  return null;
}
async function fetchRoleForUser(user){
  if(!user) return null;
  const dbRef = getDb();
  if(!dbRef) return null;
  try{
    const doc = await dbRef.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role||'').toLowerCase();
    const q = await dbRef.collection('staff').where('email','==',user.email).limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role||'').toLowerCase();
    return null;
  }catch(err){
    console.error('fetchRoleForUser error', err);
    return null;
  }
}
function cap(s){ if(!s) return s; return s.charAt(0).toUpperCase() + s.slice(1); }

// ----------------- Core guard -----------------
document.addEventListener('DOMContentLoaded', function(){
  if(typeof auth === 'undefined' || !auth){
    console.warn('[AUTH] auth not available. Ensure database.js is loaded first.');
    return;
  }

  console.log('[AUTH] auth guard init on', currentPath);

  // If an anonymous session accidentally exists, sign it out to force explicit login
  if(auth.currentUser && auth.currentUser.isAnonymous){
    console.warn('[AUTH] anonymous user detected - signing out.');
    auth.signOut().catch(e=>console.warn('signOut err', e));
  }

  auth.onAuthStateChanged(async function(user){
    console.log('[AUTH] onAuthStateChanged -> user:', user ? user.email : null);

    // No user: if page protected -> redirect to login
    if(!user){
      if(!isPublicPage){
        console.log('[AUTH] no user on protected page -> redirect to login');
        window.location.href = 'login.html';
        return;
      }
      // public page and no user: nothing more
      return;
    }

    // User exists. Decide whether to allow them to continue or force login again.
    // Policy: allow only if sessionStorage.justSignedIn === '1' (i.e., user just used the login form now).
    // Otherwise force signOut and redirect to login (to ensure fresh credentials).
    const justSignedIn = sessionStorage.getItem('justSignedIn') === '1';
    if(!justSignedIn && !isPublicPage){
      // Not freshly signed in — force sign out to require credentials
      console.log('[AUTH] existing persistent session found but not justSignedIn -> forcing signOut to require fresh login');
      try{
        await auth.signOut();
      }catch(e){ console.warn('Force signOut failed', e); }
      // ensure flag cleared
      sessionStorage.removeItem('justSignedIn');
      // redirect
      window.location.href = 'login.html';
      return;
    }

    // If we reach here and justSignedIn===true:
    // Allow the normal redirect/flow (e.g., on login page we redirect to marks)
    // Clear the flag to avoid reusing it later
    sessionStorage.removeItem('justSignedIn');

    // If on login page and user exists -> redirect to marks (preserve prior behaviour)
    if(user && LOGIN_PAGES.includes(currentPath)){
      console.log('[AUTH] user just signed in on login page -> redirecting to marks.html');
      window.location.href = 'marks.html';
      return;
    }

    // Otherwise, user is allowed on protected page (they just signed in)
    // No further action here — page components may now run as normal.
  });

  // Logout binding
  const logoutBtn = el('logoutBtn');
  if(logoutBtn){
    logoutBtn.addEventListener('click', function(){
      auth.signOut().then(()=> {
        sessionStorage.removeItem('justSignedIn');
        window.location.href = 'login.html';
      }).catch(err=> { console.error('logout failed', err); alert('Failed to logout: '+ (err.message||err)); });
    });
  }
});

// ----------------- Login handler -----------------
document.addEventListener('DOMContentLoaded', function(){
  const form = el('loginForm');
  if(!form){
    console.log('[AUTH] login form not present; skip binding login handler.');
    return;
  }

  const emailInput = el('email');
  const passInput  = el('password');
  const submitBtn  = el('loginSubmit');
  const errBox     = el('loginError');
  const statusBox  = el('loginStatus');

  function showError(msg){ if(errBox) errBox.textContent = msg; else alert(msg); }

  form.addEventListener('submit', function(e){
    e.preventDefault();
    setError('');
    if(!auth){
      showError('System auth not initialized.');
      return;
    }

    const email = (emailInput && emailInput.value || '').trim();
    const pass  = (passInput && passInput.value) || '';
    if(!email || !pass){ showError('Enter email and password.'); return; }

    // set UI state
    if(statusBox) statusBox.classList.remove('hidden');
    if(statusBox) statusBox.innerHTML = '<span class="loader"></span> Unatafuta… taarifa zako, subiri kidogo';
    if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }
    if(errBox) errBox.textContent = '';

    // sign in
    auth.signInWithEmailAndPassword(email, pass)
      .then(async cred => {
        console.log('[AUTH] signIn ok; marking session as justSignedIn and fetching role');
        // mark session as freshly signed in (used by onAuthStateChanged guard)
        sessionStorage.setItem('justSignedIn', '1');

        const user = auth.currentUser || (cred && cred.user);
        // fetch role for nicer welcome
        const role = await fetchRoleForUser(user);
        const roleLabel = role ? cap(role) : 'User';
        const title = `Karibu ${roleLabel}`;
        const body  = `${user.email} — umeingia kama ${roleLabel}`;

        // show notification or fallback
        showWelcomeNotification(title, body);

        // update UI status and re-enable button
        if(statusBox) statusBox.textContent = body;
        if(submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Login'; }

        // Redirect to marks.html after small delay
        setTimeout(()=> {
          // keep justSignedIn in sessionStorage until onAuthStateChanged clears it
          window.location.href = 'marks.html';
        }, 400);
      })
      .catch(err => {
        console.error('[AUTH] signIn error', err);
        let msg = (err && err.message) ? err.message : String(err);
        if(msg && msg.indexOf('INVALID_LOGIN_CREDENTIALS') !== -1) msg = 'Email au password si sahihi.';
        showError(msg);
        if(statusBox){ statusBox.classList.add('hidden'); statusBox.textContent = ''; }
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      });
  });
});







