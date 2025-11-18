// /js/admin.js
import { onAuthChange, firebaseSignOut, setDocById, getAll, deleteDocById } from './database.js';
const $ = id => document.getElementById(id);
const ADM = 'admins';

let me=null;

onAuthChange(user=>{
  if(!user) window.location.href='index.html';
  me=user;
  $('myUid').innerText = user.uid;
  $('myEmail').innerText = user.email || '-';
  loadAdmins();
});

async function loadAdmins(){
  const list = await getAll(ADM);
  const tbody = $('adminsTable').querySelector('tbody'); tbody.innerHTML='';
  list.sort((a,b)=> (a.added_at||'').localeCompare(b.added_at||'')).forEach((it,i)=>{
    const tr=document.createElement('tr'); tr.innerHTML = `<td>${i+1}</td><td>${it.id}</td><td>${new Date(it.added_at||Date.now()).toLocaleString()}</td>`; tbody.appendChild(tr);
  });
}

$('addAdminBtn').onclick = async ()=>{
  const uid = $('adminUidInput').value.trim(); if(!uid) return alert('Enter UID');
  await setDocById(ADM, uid, { id: uid, added_at: new Date().toISOString(), added_by: me.uid });
  $('adminUidInput').value=''; await loadAdmins(); alert('Admin added');
};

$('removeAdminBtn').onclick = async ()=>{
  const uid = $('adminUidInput').value.trim(); if(!uid) return alert('Enter UID');
  if(!confirm('Remove admin '+uid+'?')) return;
  try{ await deleteDocById(ADM, uid); } catch(e){ await setDocById(ADM, uid, { deleted:true }); }
  $('adminUidInput').value=''; await loadAdmins(); alert('Removed');
};

document.getElementById('signOutLink')?.addEventListener('click', async e=>{ e.preventDefault(); await firebaseSignOut(); window.location.href='index.html'; });
