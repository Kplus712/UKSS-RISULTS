// js/guard-teacher.js
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

    if (
      role !== "class teacher" &&
      role !== "teacher" &&
      role !== "academic" &&
      role !== "admin"
    ) {
      alert("Huna ruhusa ya Teacher.");
      await firebase.auth().signOut();
      location.href = "index.html";
      return;
    }

    console.log("[TEACHER] access granted");
    showWelcomePopup(doc.data().name, role);

  } catch (err) {
    console.error("Teacher guard error:", err);
    await firebase.auth().signOut();
    location.href = "index.html";
  }
});

function showWelcomePopup(name, role){
  const o = document.createElement("div");
  o.innerHTML = `
  <div style="position:fixed;inset:0;background:rgba(0,0,0,.55);backdrop-filter:blur(6px);
  display:flex;align-items:center;justify-content:center;z-index:9999">
    <div style="background:#021b13;padding:26px 34px;border-radius:14px;color:#eafff4">
      <h3>Karibu ${role}</h3>
      <p>${name || ""}</p>
    </div>
  </div>`;
  document.body.appendChild(o);
  setTimeout(()=>o.remove(), 2400);
}
