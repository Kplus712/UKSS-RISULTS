// /js/auth.js
// Handles login page behaviour

import { firebaseSignIn, onAuthChange } from "./database.js";

const emailInput = document.getElementById("username");
const passInput  = document.getElementById("password");
const msgBox     = document.getElementById("loginMessage");

// redirect if already logged in
onAuthChange(user => {
  if (user) {
    // already logged in → send to marks dashboard (tutaiandika baadaye)
    window.location.href = "marks.html";
  }
});

// global function for onclick="login()"
window.login = async function login(){
  const email = emailInput.value.trim();
  const pass  = passInput.value.trim();

  if (!email || !pass){
    showMessage("Tafadhali jaza email na password.");
    return;
  }

  showMessage("Inalogin, tafadhali subiri...");

  try{
    await firebaseSignIn(email, pass);
    showMessage("Login imefanikiwa, nafungua dashboard...");
    // redirect after short delay
    setTimeout(() => {
      window.location.href = "marks.html";
    }, 600);
  } catch(err){
    console.error(err);
    let text = "Login imeshindikana. Hakikisha email & password ni sahihi.";
    if (err.code === "auth/user-not-found") text = "Akaunti haipo. Muulize admin akusajili.";
    if (err.code === "auth/wrong-password") text = "Password sio sahihi.";
    showMessage(text, true);
  }
};

function showMessage(text, isError=false){
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.color = isError ? "#ffb3b3" : "#9fb5a7";
}

// optional: support Enter key
window.addEventListener("keydown", (e)=>{
  if (e.key === "Enter") window.login();
});
