// js/guard-headmaster.js
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

    if (role !== "headmaster" && role !== "admin") {
      alert("Ruhusa ya Headmaster pekee.");
      await firebase.auth().signOut();
      location.href = "index.html";
      return;
    }

    console.log("[HEADMASTER] access granted");
    showWelcomePopup(doc.data().name, "Headmaster");

  } catch (err) {
    console.error("Headmaster guard error:", err);
    await firebase.auth().signOut();
    location.href = "index.html";
  }
});

function showWelcomePopup(name, role){
  const o = document.createElement("div");
  o.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.6);backdrop-filter:blur(8px);
  display:flex;align-items:center;justify-content:center;z-index:9999">
    <div style="background:#03140f;padding:28px 36px;border-radius:16px;color:#eafff4">
      <h2>Karibu ${role}</h2>
      <p>${name || ""}</p>
    </div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(()=>o.remove(), 2600);
}
