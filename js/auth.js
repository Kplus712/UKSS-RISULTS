// js/auth.js

var emailInput = document.getElementById("username");
var passInput  = document.getElementById("password");
var msgBox     = document.getElementById("loginMessage");

// kama user tayari ka-login, mtupie marks.html
auth.onAuthStateChanged(function(user){
  if (user) {
    window.location.href = "marks.html";
  }
});

function showMessage(text, isError){
  if (!msgBox) return;
  msgBox.textContent = text;
  msgBox.style.color = isError ? "#ffb3b3" : "#9fb5a7";
}

// inahitajika na onclick="login()" kwenye index.html
window.login = function login(){
  var email = (emailInput.value || "").trim();
  var pass  = (passInput.value || "").trim();

  if(!email || !pass){
    showMessage("Tafadhali jaza email na password.", true);
    return;
  }

  showMessage("Inalogin...");

  auth.signInWithEmailAndPassword(email, pass)
    .then(function(){
      showMessage("Login imefanikiwa, nafungua dashboard...");
      setTimeout(function(){
        window.location.href = "marks.html";
      }, 500);
    })
    .catch(function(err){
      console.error(err);
      var text = "Login imeshindikana. Hakikisha email & password ni sahihi.";
      if (err.code === "auth/user-not-found")  text = "Akaunti haipo. Muulize admin akusajili Firebase.";
      if (err.code === "auth/wrong-password")  text = "Password sio sahihi.";
      showMessage(text, true);
    });
};

// support Enter key
window.addEventListener("keydown", function(e){
  if (e.key === "Enter") window.login();
});
