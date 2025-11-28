// js/auth.js
var $ = function(id){ return document.getElementById(id); };

// WAIT until database.js loads properly
function waitForFirebase(cb){
  let tries = 0;
  const int = setInterval(()=>{
    if (window.auth && window.db && window.col){
      clearInterval(int);
      cb();
    } else {
      tries++;
      if (tries > 50){ 
        console.error("Firebase not initialized"); 
        clearInterval(int);
      }
    }
  }, 100);
}

waitForFirebase(initAuth);

function initAuth(){
  console.log("Auth initialized");

  /* auto redirect if logged in */
  auth.onAuthStateChanged(function(user){
    if (!user) return;

    if (location.pathname.includes("index.html") || 
        location.pathname.endsWith("/") ||
        location.pathname.includes("github.io")){
      routeByRole(user);
    }
  });

  /* login form */
  document.addEventListener("DOMContentLoaded", function(){
    var form = $("loginForm");
    var btn  = $("loginBtn");
    if (!form) return;

    form.addEventListener("submit", function(e){
      e.preventDefault();

      var email = ($("email") || {}).value;
      var pass  = ($("password") || {}).value;

      if (!email || !pass){
        setErr("Weka email na password.");
        return;
      }

      btn.disabled = true;
      btn.textContent = "Logging in...";

      auth.signInWithEmailAndPassword(email, pass)
        .then(res=>{
          btn.disabled = false;
          btn.textContent = "Login";
          routeByRole(res.user);
        })
        .catch(err=>{
          console.error(err);
          btn.disabled = false;
          btn.textContent = "Login";
          setErr("Email au password sio sahihi.");
        });
    });
  });
}

function setErr(msg){
  var el = $("loginError");
  if (el) el.textContent = msg;
}

/* redirect based on role */
async function routeByRole(user){
  try{
    const snap = await db.collection(col.staff).doc(user.uid).get();

    if (!snap.exists){
      setErr("Hakuna staff profile. Mwone Admin.");
      return;
    }

    const staff = snap.data();
    const role  = staff.role;

    let target = "marks.html";

    if (role === "admin" || role === "headmaster")
      target = "admin.html";
    else if (role === "academic")
      target = "academic.html";
    else if (role === "class_teacher")
      target = "marks.html";

    window.location.href = target;

  }catch(e){
    console.error(e);
    window.location.href = "marks.html";
  }
}

