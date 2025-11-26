// /js/database.js
// Firebase init + small helper functions (Auth + Firestore)

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ==== YOUR CONFIG (ule ule uliotupa mwanzo) ====
const firebaseConfig = {
  apiKey: "AIzaSyA8QMDOD-bUXpElehkg2BlJhKE1_cbvKek",
  authDomain: "school-results-management.firebaseapp.com",
  projectId: "school-results-management",
  storageBucket: "school-results-management.firebasestorage.app",
  messagingSenderId: "755154296958",
  appId: "1:755154296958:web:e4c5f9bc0e6cce3e9cf82f",
  measurementId: "G-MDN4Q3C22J"
};

// Init app
const app = initializeApp(firebaseConfig);

// Auth + DB instances
export const auth = getAuth(app);
export const db = getFirestore(app);

// ---- AUTH HELPERS ----
export function firebaseSignIn(email, password){
  return signInWithEmailAndPassword(auth, email, password);
}

export function firebaseSignOut(){
  return signOut(auth);
}

export function onAuthChange(callback){
  return onAuthStateChanged(auth, callback);
}

// ---- FIRESTORE HELPERS (tutazitumia baadaye kwenye marks/results) ----
export const col = {
  classes: "classes",
  students: "students",
  subjects: "subjects",
  exams: "exams",
  marks: "marks",
  report_cards: "report_cards",
  sms_logs: "sms_logs",
  admins: "admins"
};

export async function getAll(colName){
  const snap = await getDocs(collection(db, colName));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function getDocById(colName, id){
  const ref = doc(db, colName, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function setDocById(colName, id, data){
  const ref = doc(db, colName, id);
  await setDoc(ref, data, { merge: true });
}

export async function addCollectionDoc(colName, data){
  const ref = await addDoc(collection(db, colName), data);
  return ref.id;
}

export async function queryCollection(colName, field, op, value){
  const q = query(collection(db, colName), where(field, op, value));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
