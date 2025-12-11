// js/auth.js — tuned to work with index.html (green) as canonical login
"use strict";

const AUTH_PREFIX = '[AUTH]';
function log(){ console.log(AUTH_PREFIX, ...arguments); }
function warn(){ console.warn(AUTH_PREFIX, ...arguments); }
function error(){ console.error(AUTH_PREFIX, ...arguments); }
function el(id){ return document.getElementById(id); }
function setStatus(txt){ const s = el('loginStatus'); if(!s) return; if(!txt){ s.classList.add('hidden'); s.textContent=''; } else { s.classList.remove('hidden'); s.textContent = txt; } }
function setError(txt){ const e = el('loginError'); if(!e){ if(txt) alert(txt); return; } e.textContent = txt || ''; }

// fetch role (helper)
async function fetchRole(user){
  try{
    if(!user) return null;
    if(typeof db === 'undefined' || !db){ warn('fetchRole: db not present'); return null; }
    const doc = await db.collection('staff').doc(user.uid).get();
    if(doc && doc.exists) return (doc.data().role || '').toLowerCase();
    const q = await db.collection('staff').where('email','==',user.email||'').limit(1).get();
    if(q && !q.empty) return (q.docs[0].data().role || '').toLowerCase();
    return null;
  }catch(e){ error('fetchRole error', e); return null; }
}

// safety: ensure auth available
document.addEventListener('DOMContentLoaded', function(){
  if(typeof auth === 'undefined' || !auth){ warn('Auth SDK not available. Ensure database.js loaded first.'); return; }
  log('auth guard init on index.html');

  // onAuthStateChanged: only redirect from protected pages; do not auto-redirect here
  auth.onAuthStateChanged(function(user){
    log('onAuthStateChanged -> user:', user ? user.email : null);
    // on the login/index page do not auto-redirect here to avoid race loops
  });

  // bind login form
  const loginForm = el('loginForm');
  if(!loginForm){ log('No login form present.'); return; }
  log('Login form bound.');

  const emailEl = el('email');
  const passEl  = el('password');
  const submitBtn = el('loginSubmit');

  loginForm.addEventListener('submit', function(e){
    e.preventDefault();
    setError('');
    setStatus('');

    const email = (emailEl && emailEl.value || '').trim();
    const pass = (passEl && passEl.value || '');

    if(!email || !pass){ setError('Please enter email and password.'); return; }

    setStatus('Logging in… please wait');
    if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = 'Logging in...'; }

    auth.signInWithEmailAndPassword(email, pass)
      .then(async cred => {
        log('signIn success (submit flow).');
        try{ sessionStorage.setItem('justSignedIn','1'); } catch(e){ warn('sessionStorage set failed', e); }

        // optional welcome message (role aware)
        const user = auth.currentUser || (cred && cred.user);
        const role = await fetchRole(user);
        const roleLabel = role ? (role.charAt(0).toUpperCase()+role.slice(1)) : 'User';
        setStatus(`${user.email} — umeingia kama ${roleLabel}`);

        // redirect once to marks.html
        setTimeout(()=> { window.location.href = 'marks.html'; }, 250);
      })
      .catch(err => {
        error('signIn failed', err);
        setError(err && err.message ? err.message : 'Login failed');
        setStatus('');
        if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = 'Login'; }
      });
  });
});







