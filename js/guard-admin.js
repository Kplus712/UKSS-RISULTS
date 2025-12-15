// js/guard-admin.js
"use strict";

firebase.auth().onAuthStateChanged(async user => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  try {
    const snap = await firebase
      .firestore()
      .collection("staff")
      .doc(user.uid)
      .get();

    if (!snap.exists) {
      await firebase.auth().signOut();
      location.href = "index.html";
      return;
    }

    const role = (snap.data().role || "").toLowerCase();

    if (!role.includes("admin")) {
      alert("Huna ruhusa ya Admin.");
      await firebase.auth().signOut();
      location.href = "index.html";
      return;
    }

    // ✅ Admin authenticated (page continues)
    console.log("[ADMIN] access granted");

  } catch (err) {
    console.error("Admin guard error:", err);
    location.href = "index.html";
  }
});
