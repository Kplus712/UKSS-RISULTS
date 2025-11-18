// /js/admin.js
import { onAuthChange, firebaseSignOut, getAll, setDocById, getDocById, deleteDocById } from './database.js';
const $ = id => document.getElementById(id);
const ADM_COL = 'admins';

let currentUser = null;

onAuthChange(user => {
  if (user) {
    currentUser = user;
    $('myUid').innerText = user.uid;
    $('myEmail').innerText = user.email || '-';
    loadAdmins();
  } else {
    // not logged in, redirect to login
    window.location.href = 'index.html';
  }
});

async function loadAdmins() {
  const list = await getAll(ADM_COL);
  const tbody = $('adminsTable').querySelector('tbody');
  tbody.innerHTML = '';
  list.sort((a,b)=> (a.added_at||'').localeCompare(b.added_at||'')).forEach((a,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i+1}</td><td>${a.id}</td><td>${a.email||'-'}</td><td>${new Date(a.added_at||Date.now()).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  });
}

$('addAdminBtn').onclick = async () => {
  const uid = $('adminUidInput').value.trim();
  if (!uid) return alert('Enter a UID');
  const now = new Date().toISOString();
  await setDocById(ADM_COL, uid, { id: uid, email: null, added_at: now, by: currentUser.uid });
  $('adminUidInput').value = '';
  await loadAdmins();
  alert('Admin added');
};

$('removeAdminBtn').onclick = async () => {
  const uid = $('adminUidInput').value.trim();
  if (!uid) return alert('Enter a UID to remove');
  if (!confirm('Remove admin '+uid+'?')) return;
  try {
    await deleteDocById(ADM_COL, uid);
  } catch(e) {
    // deleteDocById is exported; if not available handle
    await setDocById(ADM_COL, uid, { deleted: true });
  }
  $('adminUidInput').value = '';
  await loadAdmins();
  alert('Admin removed (or marked deleted)');
};

$('signOutBtn').onclick = async () => {
  await firebaseSignOut();
  window.location.href = 'index.html';
};
