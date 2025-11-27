// js/database.js
// Uses Firebase v8 CDN (firebase-app.js, auth.js, firestore.js MUST be loaded before this file)

// ----- 1. Firebase config -----
var firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvKek",
  authDomain: "school-results-management.firebaseapp.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.firebasestorage.app",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};

// ----- 2. Init app -----
firebase.initializeApp(firebaseConfig);

// GLOBAL instances
window.auth = firebase.auth();
window.db   = firebase.firestore();

window.col = {
  classes:      "classes",
  students:     "students",
  subjects:     "subjects",
  exams:        "exams",
  marks:        "marks",
  report_cards: "report_cards",
  behaviour:    "behaviour",
  sms_logs:     "sms_logs",
  staff:        "staff",      // 🔹 staff collection
  settings:     "settings",   // 🔹 system settings
  admins:       "admins"
};


const db = firebase.firestore();
const col = {
  classes: db.collection("classes"),
  students: db.collection("students"),
  report_cards: db.collection("report_cards"),
  behaviour: db.collection("behaviour"),
  sms_logs: db.collection("sms_logs"),
  staff: db.collection("staff"),       // 👈 hii lazima iwepo
  settings: db.collection("settings")  // 👈 hii pia kwa system settings
};



// ----- 4. Helper functions (available globally) -----
window.getAll = async function getAll(colName){
  const snap = await db.collection(colName).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

window.getDocById = async function getDocById(colName, id){
  const docRef = db.collection(colName).doc(id);
  const snap   = await docRef.get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
};

window.setDocById = async function setDocById(colName, id, data){
  const docRef = db.collection(colName).doc(id);
  await docRef.set(data, { merge:true });
};

window.addCollectionDoc = async function addCollectionDoc(colName, data){
  const ref = await db.collection(colName).add(data);
  return ref.id;
};
