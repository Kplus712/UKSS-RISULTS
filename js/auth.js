// js/auth.js (UPDATED)
// Login / logout / page guard for UKSS + welcome notification on login

// Pages zinazochukuliwa kama "login pages"
const LOGIN_PAGES  = ["login.html", "index.html"];
// Pages zinazoruhusu kutembelewa bila login
const PUBLIC_PAGES = ["login.html", "index.html"];

const currentPath  = window.location.pathname.split("/").pop() || "index.html";
const isPublicPage = PUBLIC_PAGES.includes(currentPath);

// Helper: get firestore db (try existing `db` then firebase.firestore())
function getDb(){
  if (typeof db !== "undefined" && db) return db;
  if (typeof firebase !== "undefined" && firebase && firebase.firestore) return firebase.firestore();
  return null;
}

function capitalize(s){
  if(!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Notification helper: uses Notification API if allowed, else fallback to status/alert
function showWelcomeNotification(title, body){
  // Try Notification API
  try{
    if ("Notification" in window){
      if (Notification.permission === "granted"){
        new Notification(title, { body });
        return;
      }
      if (Notification.permission !== "denied"){
        Notification.requestPermission().then(perm => {
          if (perm === "granted") new Notification(title, { body });
          else {
            // fallback
            const statusBox = document.getElementById("loginStatus");
            if(statusBox) statusBox.textContent = body;
            else alert(title + "\n\n" + body);
          }
        }).catch(()=> {
          const statusBox = document.getElementById("loginStatus");
          if(statusBox) statusBox.textContent = body;
          else alert(title + "\n\n" + body);
        });
        return;
      }
    }
    // fallback
    const statusBox = document.getElementById("loginStatus");
    if(statusBox) statusBox.textContent = body;
    else alert(title + "\n\n" + body);
  }catch(e){
    const statusBox = document.getElementById("loginStatus");
    if(statusBox) statusBox.textContent = body;
    else alert(title + "\n\n" + body);
  }
}

// =================== 1. GLOBAL GUARD ===================
document.addEventListener("DOMContentLoaded", function () {
  if (typeof auth === "undefined" || !auth) {
    console.warn("Auth SDK not available for guard.");
    return;
  }

  console.log("[AUTH] guard initialised on", currentPath);

  auth.onAuthStateChanged(function (user) {
    console.log("[AUTH] state changed:", user ? user.email : null);

    // Hakuna user, na page si public → peleka login
    if (!user && !isPublicPage) {
      window.location.href = "login.html";
      return;
    }

    // Kuna user, na tupo kwenye mojawapo ya login pages → peleka marks
    if (user && LOGIN_PAGES.includes(currentPath)) {
      console.log("[AUTH] logged in on login page, redirecting to marks.html");
      window.location.href = "marks.html";
    }
  });

  // Logout button (kwa marks, sms, results, n.k.)
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      auth
        .signOut()
        .then(function () {
          window.location.href = "login.html";
        })
        .catch(function (err) {
          console.error(err);
          alert("Failed to logout: " + err.message);
        });
    });
  }
});

// =================== 2. LOGIN HANDLER (with "unatafuta" + welcome) ===================
document.addEventListener("DOMContentLoaded", function () {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) {
    console.log("[AUTH] No login form on this page.");
    return;
  }
  console.log("[AUTH] Login form found. Binding submit handler.");

  const emailInput  = document.getElementById("email");
  const passInput   = document.getElementById("password");
  const errorBox    = document.getElementById("loginError");
  const submitBtn   = document.getElementById("loginSubmit");
  const statusBox   = document.getElementById("loginStatus");

  function showError(msg){
    console.error("[AUTH] login error:", msg);

    let niceMessage = msg;
    if (msg && msg.indexOf("INVALID_LOGIN_CREDENTIALS") !== -1) {
      niceMessage = "Email au password si sahihi. Hakikisha zinafanana na zilizoko Firebase Auth.";
    }
    if (errorBox) errorBox.textContent = niceMessage;
    else alert(niceMessage);
  }

  // fetch role from staff collection (by uid then by email)
  async function fetchRoleForUser(user){
    if(!user) return null;
    const dbRef = getDb();
    if(!dbRef) return null;
    try{
      const doc = await dbRef.collection('staff').doc(user.uid).get();
      if(doc && doc.exists){
        return (doc.data().role || '').toLowerCase();
      }
      const q = await dbRef.collection('staff').where('email','==',user.email).limit(1).get();
      if(q && !q.empty){
        return (q.docs[0].data().role || '').toLowerCase();
      }
      return null;
    }catch(err){
      console.error('fetchRoleForUser error', err);
      return null;
    }
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (errorBox) errorBox.textContent = "";
    if (statusBox) statusBox.classList.remove("hidden");

    console.log("[AUTH] Login submit clicked.");

    const email = (emailInput?.value || "").trim();
    const pass  = passInput?.value || "";

    if (!email || !pass) {
      showError("Please enter email and password.");
      return;
    }

    if (typeof auth === "undefined" || !auth) {
      showError("System auth is not initialised. Hakikisha firebase-auth.js na database.js zimepakiwa vizuri.");
      return;
    }

    if (statusBox) {
      statusBox.innerHTML = '<span class="loader"></span> Unatafuta… taarifa zako, subiri kidogo';
    }

    if (submitBtn) {
      submitBtn.textContent = "Logging in...";
      submitBtn.disabled = true;
    }

    // sign in
    auth
      .signInWithEmailAndPassword(email, pass)
      .then(async function (cred) {
        console.log("[AUTH] signIn success; determining role & showing welcome...");

        const user = auth.currentUser || (cred && cred.user);
        // show quick searching status
        if (statusBox) statusBox.innerHTML = '<span class="loader"></span> Unatafuta role yako...';

        const role = await fetchRoleForUser(user);
        const roleLabel = role ? capitalize(role) : "User";
        const welcomeTitle = `Karibu ${roleLabel}`;
        const welcomeBody  = user && user.email ? `${user.email} — umeingia kama ${roleLabel}` : `Umeingia kama ${roleLabel}`;

        // show notification (Notification API or fallback)
        showWelcomeNotification(welcomeTitle, welcomeBody);

        // also update status box (non-blocking)
        if (statusBox) statusBox.textContent = welcomeBody;

        // re-enable button quickly (though we'll redirect)
        if (submitBtn) { submitBtn.textContent = "Login"; submitBtn.disabled = false; }

        // Redirect to marks.html (preserve original redirect behaviour)
        // Use a tiny timeout so notification/status has chance to appear; not necessary but nicer UX
        try{
          setTimeout(()=> { window.location.href = "marks.html"; }, 500);
        }catch(e){
          console.error('redirect failed', e);
          // fallback
          window.location.href = "marks.html";
        }
      })
      .catch(function (err) {
        const msg = (err && err.message) ? err.message : String(err);
        showError(msg);

        if (statusBox) {
          statusBox.textContent = "";
          statusBox.classList.add("hidden");
        }
        if (submitBtn) {
          submitBtn.textContent = "Login";
          submitBtn.disabled = false;
        }
      });
  });
});






