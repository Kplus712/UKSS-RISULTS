// js/database.js
// Firebase config + helpers for UKSS

// ----- 1. CONFIG -----
var firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvVek",
  authDomain: "school-results-management.firebaseapp.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.firebasestorage.app",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};

// ----- 2. INIT APP (avoid double init) -----
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// ----- 3. CORE OBJECTS -----
const auth = firebase.auth();
const db   = firebase.firestore();

// Collection keys as STRINGS (used by getAll & others)
const col = {
  classes:      "classes",
  students:     "students",
  subjects:     "subjects",
  exams:        "exams",          // for exam registration
  marks:        "marks",
  report_cards: "report_cards",
  behaviour:    "behaviour",
  sms_logs:     "sms_logs",
  staff:        "staff",
  settings:     "settings"
};

// ----- 4. GENERIC HELPERS -----
// Zitasomwa na marks.js, sms.js, admin.js, academic.js, n.k.

async function getAll(collectionPath){
  // collectionPath ni string, mfano "students"
  const snap = await db.collection(collectionPath).get();
  return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
}

async function addCollectionDoc(collectionPath, data){
  const ref = await db.collection(collectionPath).add(data);
  return ref.id;
}

async function getDocById(collectionPath, id){
  const snap = await db.collection(collectionPath).doc(id).get();
  if (!snap.exists) return null;
  return Object.assign({ id: snap.id }, snap.data());
}

async function setDocById(collectionPath, id, data){
  await db.collection(collectionPath).doc(id).set(data, { merge: true });
}

async function deleteDocById(collectionPath, id){
  await db.collection(collectionPath).doc(id).delete();
}

// ----- 5. EXPOSE GLOBALS -----
window.auth = auth;
window.db   = db;
window.col  = col;

window.getAll          = getAll;
window.addCollectionDoc= addCollectionDoc;
window.getDocById      = getDocById;
window.setDocById      = setDocById;
window.deleteDocById   = deleteDocById;
