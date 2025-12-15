// js/guard-academic.js
"use strict";

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  try {
    const doc = await firebase
      .firestore()
      .collection("staff")
      .doc(user.uid)
      .get();

    if (!doc.exists) throw "NO_STAFF";

    const role = (doc.data().role || "").toLowerCase();

    if (role !== "academic" && role !== "admin") {
      alert("Huna ruhusa ya Academic.");
      await firebase.auth().signOut();
      location.href = "index.html";
      return;
    }

    console.log("[ACADEMIC] access granted");

    // optional: show welcome popup
    showWelcomePopup(doc.data().name, "Academic Officer");

  } catch (err) {
    console.error("Academic guard error:", err);
    await firebase.auth().signOut();
    location.href = "index.html";
  }
});

function showWelcomePopup(name, role){
  const overlay = document.createElement("div");
  overlay.innerHTML = `
    <div style="
      position:fixed;inset:0;
      background:rgba(0,0,0,.55);
      backdrop-filter:blur(6px);
      display:flex;align-items:center;justify-content:center;
      z-index:9999">
      <div style="
        background:#021b13;
        color:#eafff4;
        padding:30px 40px;
        border-radius:18px;
        text-align:center;
        box-shadow:0 20px 60px rgba(0,0,0,.6)">
        <h2>Karibu ${role}</h2>
        <p>${name || ""}</p>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(()=>overlay.remove(), 2500);
}
