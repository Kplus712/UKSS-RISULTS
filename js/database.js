// js/database.js
// Firebase init + helpers for UKSS

// CONFIG YAKO YA PROJECT
// (tumia ile uliyoniwekea awali)
var firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvVek",
  authDomain: "school-results-management.firebaseapp.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.appspot.com",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};

// Initialize Firebase (v8 style)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

console.log("Firebase initialized");

// GLOBAL AUTH & DB
var auth = firebase.auth();
var db   = firebase.firestore();

// Collections shortcuts — hizi ndizo tunaziita kama col.classes n.k.
var col = {
  classes      : db.collection("classes"),
  students     : db.collection("students"),
  subjects     : db.collection("subjects"),
  exams        : db.collection("exams"),
  marks        : db.collection("marks"),
  report_cards : db.collection("report_cards"),
  behaviour    : db.collection("behaviour"),
  sms_logs     : db.collection("sms_logs"),
  staff        : db.collection("staff"),
  settings     : db.collection("settings")
};

// ===== UTILITY FUNCTIONS =====

// Soma docs zote za collection
async function getAll(collectionRef){
  var snap = await collectionRef.get();
  return snap.docs.map(function(doc){
    return Object.assign({ id: doc.id }, doc.data());
  });
}

// Ongeza doc mpya kwenye collection
function addCollectionDoc(collectionRef, data){
  return collectionRef.add(data);
}

// Pata doc moja kwa id
async function getDocById(collectionRef, id){
  var doc = await collectionRef.doc(id).get();
  if (!doc.exists) return null;
  return Object.assign({ id: doc.id }, doc.data());
}

