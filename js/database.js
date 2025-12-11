// js/database.js
// Firebase init + helpers for UKSS

var firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvKek",
  authDomain: "school-results-management.firebaseapp.com",
  databaseURL: "https://school-results-management-default-rtdb.firebaseio.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.appspot.com",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
console.log("Firebase initialized");

// Firestore & Auth
var db   = firebase.firestore ? firebase.firestore() : null;
var auth = firebase.auth ? firebase.auth() : null;

if (!db)   console.warn("Firestore SDK not loaded.");
if (!auth) console.warn("Auth SDK not loaded. Login features disabled.");

// Collection shortcuts (optional)
var col = {
  classes      : db ? db.collection("classes")      : null,
  students     : db ? db.collection("students")     : null,
  subjects     : db ? db.collection("subjects")     : null,
  exams        : db ? db.collection("exams")        : null,
  marks        : db ? db.collection("marks")        : null,
  report_cards : db ? db.collection("report_cards") : null,
  behaviour    : db ? db.collection("behaviour")    : null,
  sms_logs     : db ? db.collection("sms_logs")     : null,
  staff        : db ? db.collection("staff")        : null,
  settings     : db ? db.collection("settings")     : null
};

// Helpers
async function getAll(collectionRef){
  var snap = await collectionRef.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function addCollectionDoc(collectionRef, data){
  return collectionRef.add(data);
}

async function getDocById(collectionRef, id){
  var doc = await collectionRef.doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

