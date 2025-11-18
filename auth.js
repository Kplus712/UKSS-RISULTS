// /js/auth.js
// Authentication handler (Firebase Email/Password)
// Requires: database.js (must be in same folder)

import { firebaseSignIn, onAuthChange } from './database.js';

const $ = id => document.getElementById(id);

// Hook up login button when page loads
window.addEventListener('load', () => {
  const loginBtn = document.querySelector('button[onclick="login()"]');
  // if your index.html uses inline onclick="login()", we override it to use the module function
  if (loginBtn) loginBtn.onclick = login;

  // optional: redirect if already logged in
  onAuthChange(user => {
    if (user) {
      // logged in
      console.log('User signed in:', user.email);
      // keep user on login page or redirect automatically to marks page
      // window.location.href = 'marks.html';
    } else {
      console.log('No user signed in');
    }
  });
});

async function login() {
  const userInput = $('username').value.trim();
  const password = $('password').value;
  const msg = $('loginMessage');

  msg.style.color = '#333';
  msg.innerText = 'Signing in...';

  // Expect admin to use an email; if user typed username without '@', you may append fixed domain
  // If you prefer to force email, remove below conversion.
  const email = userInput.includes('@') ? userInput : `${userInput}@example.com`;

  try {
    await firebaseSignIn(email, password);
    msg.style.color = 'green';
    msg.innerText = 'Login successful. Redirecting...';
    // redirect to marks page
    window.location.href = 'marks.html';
  } catch (err) {
    console.error(err);
    msg.style.color = 'red';
    // show friendly message
    msg.innerText = 'Login failed: ' + (err.message || err.code || 'Check credentials');
  }
}

// Export if any other module wants to call login()
export { login };
