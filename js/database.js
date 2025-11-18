// /js/database.js
// Firebase v9 Modular SDK – Works with GitHub Pages (Frontend Only)
// ---------------------------------------------------------------
// ALL FIREBASE FEATURES LOADED VIA CDN (NO NPM)
// ---------------------------------------------------------------

// Firebase Core
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

// Firebase Authentication
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

// Firebase Firestore
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  addDoc,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
  deleteDoc,
  orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";


// =====================================================================
// 🔥 YOUR FIREBASE CONFIG (WORKING - ALREADY INSERTED)
// =====================================================================
const firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvKek",
  authDomain: "school-results-management.firebaseapp.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.firebasestorage.app",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};


// =====================================================================
// INITIALIZE FIREBASE
// =====================================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


// =====================================================================
// COLLECTION NAMES FOR UNIFORMITY
// =====================================================================
const col = {
  classes: 'classes',
  students: 'students',
  subjects: 'subjects',
  exams: 'exams',
  marks: 'marks',
  report_cards: 'report_cards',
  sms_logs: 'sms_logs'
};


// =====================================================================
// AUTH FUNCTIONS
// =====================================================================
async function firebaseSignIn(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

async function firebaseSignOut() {
  return signOut(auth);
}

function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}


// =====================================================================
// FIRESTORE CORE HELPERS
// =====================================================================
async function addCollectionDoc(collectionName, data) {
  const ref = await addDoc(collection(db, collectionName), data);
  return ref.id;
}

async function setDocById(collectionName, id, data) {
  await setDoc(doc(db, collectionName, id), data, { merge: true });
  return id;
}

async function getDocById(collectionName, id) {
  const d = await getDoc(doc(db, collectionName, id));
  return d.exists() ? { id: d.id, ...d.data() } : null;
}

async function updateDocById(collectionName, id, data) {
  await updateDoc(doc(db, collectionName, id), data);
}

async function deleteDocById(collectionName, id) {
  await deleteDoc(doc(db, collectionName, id));
}

async function getAll(collectionName) {
  const snap = await getDocs(collection(db, collectionName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function queryCollection(collectionName, field, operator, value) {
  const qy = query(collection(db, collectionName), where(field, operator, value));
  const snap = await getDocs(qy);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function realtimeQuery(collectionName, callback) {
  return onSnapshot(collection(db, collectionName), snapshot => {
    const arr = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    callback(arr);
  });
}


// =====================================================================
// EXPORT EVERYTHING FOR OTHER MODULES
// =====================================================================
export {
  auth,
  db,
  col,
  firebaseSignIn,
  firebaseSignOut,
  onAuthChange,
  addCollectionDoc,
  setDocById,
  getDocById,
  updateDocById,
  deleteDocById,
  getAll,
  queryCollection,
  realtimeQuery
};
