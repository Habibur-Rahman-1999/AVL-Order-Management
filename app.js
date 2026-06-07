import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBRNwi-pA8OSq7__Rn4Hg5X_280W9AexH0",
  authDomain: "avl-order-management.firebaseapp.com",
  databaseURL: "https://avl-order-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "avl-order-management",
  storageBucket: "avl-order-management.firebasestorage.app",
  messagingSenderId: "825754454601",
  appId: "1:825754454601:web:360c6c265f1f6b11b50d98"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global state
let generatedOTP = null;
let tempRegistrationData = {};
let currentUser = { uid: null, email: null, name: null, role: 'user', status: null };
let csvData = [];

// Unit-Line mapping
const unitLines = {
  'AFBL': ['A','B','C'],
  'ADL': ['D','UHT'],
  'AEEL': ['E'],
  'AALL': ['AG'],
  'AHHL': ['H'],
  'ABEL': ['BC','SP']
};

function updateLineDropdown(unitSelectId, lineSelectId) {
  const unit = document.getElementById(unitSelectId).value;
  const lineSel = document.getElementById(lineSelectId);
  lineSel.innerHTML = '<option value="">লাইন সিলেক্ট করুন</option>';
  if (unitLines[unit]) {
    unitLines[unit].forEach(line => {
      const opt = document.createElement('option');
      opt.value = line; opt.text = line;
      lineSel.appendChild(opt);
    });
  }
}

// Attach unit change for registration
document.getElementById('regUnit').addEventListener('change', () => updateLineDropdown('regUnit', 'regLine'));

// Auth views
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const otpView = document.getElementById('otp-view');
const mainAppView = document.getElementById('main-app');

document.getElementById('goToRegister').addEventListener('click', () => switchAuthView(registerView));
document.getElementById('goToLogin').addEventListener('click', () => switchAuthView(loginView));
document.getElementById('backToRegister').addEventListener('click', () => switchAuthView(registerView));

function switchAuthView(view) {
  [loginView, registerView, otpView].forEach(v => v.classList.remove('active'));
  view.classList.add('active');
}

const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

function toggleLoading(btnId, loading, defaultHtml) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  if (loading) { btn.disabled = true; btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং...`; }
  else { btn.disabled = false; btn.innerHTML = defaultHtml; }
}

// ---------- LOGIN ----------
document.getElementById('btnLogin').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const dft = `<i class="fas fa-right-to-bracket"></i> লগইন`;
  if (!email || !password) { alert('ইমেইল ও পাসওয়ার্ড দিন।'); return; }
  toggleLoading('btnLogin', true, dft);
  signInWithEmailAndPassword(auth, email, password).then(async (uc) => {
    const user = uc.user;
    console.log("Logged in:", user.uid);
    const snap = await get(ref(database, 'users/' + user.uid));
    if (!snap.exists()) { await signOut(auth); toggleLoading('btnLogin', false, dft); alert('অ্যাকাউন্ট পাওয়া যায়নি।'); return; }
    const userData = snap.val();
    if (userData.status !== 'approved') { await signOut(auth); toggleLoading('btnLogin', false, dft); alert('অনুমোদিত নয়।'); return; }
    const adminsSnap = await get(ref(database, 'admins'));
    const admins = adminsSnap.val() || {};
    const isAdmin = admins[email.replace(/\./g, '_')] === true;
    currentUser = { uid: user.uid, email: user.email, name: userData.name, role: isAdmin ? 'admin' : 'user', status: userData.status };
    console.log("Current user:", currentUser);
    toggleLoading('btnLogin', false, dft);
    showMainApp();
  }).catch(err => { toggleLoading('btnLogin', false, dft); alert('লগইন ব্যর্থ: ' + err.message); });
});

// ---------- REGISTRATION ----------
document.getElementById('btnSendOTP').addEventListener('click', () => {
  const enroll = document.getElementById('regEnroll').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const unit = document.getElementById('regUnit').value;
  const line = document.getElementById('regLine').value;
  const password = document.getElementById('regPassword').value;
  const dft = `<i class="fas fa-paper-plane"></i> ওটিপি পাঠান`;
  if (!enroll || !name || !email || !unit || !line || !password) { alert('সকল ঘর পূরণ করুন।'); return; }
  if (password.length < 6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষর।'); return; }
  tempRegistrationData = { enroll, name, email, unit, line, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("OTP:", generatedOTP);
  toggleLoading('btnSendOTP', true, dft);
  fetch(appsScriptURL, { method:"POST", mode:"no-cors", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ to_email:email, to_name:name, otp_code:generatedOTP, type:"REGISTRATION" }) })
  .then(() => { toggleLoading('btnSendOTP', false, dft); document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি পাঠানো হয়েছে।`; switchAuthView(otpView); })
  .catch(err => { toggleLoading('btnSendOTP', false, dft); alert('ওটিপি পাঠাতে সমস্যা।'); console.error(err); });
});

document.getElementById('btnVerifyOTP').addEventListener('click', () => {
  const userOTP = document.getElementById('otpInput').value.trim();
  const dft = `<i class="fas fa-circle-check"></i> যাচাই ও রেজিস্ট্রেশন`;
  if (userOTP !== generatedOTP) { alert('ভুল ওটিপি!'); return; }
  toggleLoading('btnVerifyOTP', true, dft);
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
  .then(async (uc) => {
    const uid = uc.user.uid;
    await set(ref(database, 'users/' + uid), {
      enroll: tempRegistrationData.enroll,
      name: tempRegistrationData.name,
      email: tempRegistrationData.email,
      unit: tempRegistrationData.unit,
      line: tempRegistrationData.line,
      status: 'pending',
      role: 'user',
      createdAt: new Date().toISOString()
    });
    await signOut(auth);
    toggleLoading('btnVerifyOTP', false, dft);
    alert('রেজিস্ট্রেশন সফল! অনুমোদনের পর লগইন করুন।');
    document.getElementById('otpInput').value = '';
    switchAuthView(loginView);
  }).catch(err => { toggleLoading('btnVerifyOTP', false, dft); alert('রেজিস্ট্রেশন ব্যর্থ: ' + err.message); });
});

// ---------- MAIN APP ----------
function showMainApp() {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  mainAppView.style.display = 'flex'; mainAppView.classList.add('active');
  document.getElementById('loggedUserName').textContent = currentUser.name;
  document.getElementById('adminApprovalsMenu').style.display = currentUser.role==='admin' ? 'block' : 'none';
  document.getElementById('editUsersMenu').style.display = currentUser.role==='admin' ? 'block' : 'none';
  switchSubView('dashboard');
  document.querySelectorAll('.nav-menu li a[data-view]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const vid = link.getAttribute('data-view');
      switchSubView(vid);
      document.querySelectorAll('.nav-menu li a').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await signOut(auth);
    mainAppView.style.display = 'none'; mainAppView.classList.remove('active');
    switchAuthView(loginView);
    currentUser = { uid:null, email:null, name:null, role:'user', status:null };
  });
  document.getElementById('btnUpdatePassword').addEventListener('click', () => {
    const np = document.getElementById('newPass').value, cp = document.getElementById('confirmNewPass').value;
    if (!np || !cp) { alert('উভয় ঘর পূরণ করুন।'); return; }
    if (np.length<6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষর।'); return; }
    if (np!==cp) { alert('পাসওয়ার্ড মেলেনি।'); return; }
    toggleLoading('btnUpdatePassword', true, `<i class="fas fa-floppy-disk"></i> আপডেট`);
    updatePassword(auth.currentUser, np).then(() => {
      toggleLoading('btnUpdatePassword', false, `<i class="fas fa-floppy-disk"></i> আপডেট`);
      alert('পাসওয়ার্ড আপডেট সফল।');
      document.getElementById('newPass').value = ''; document.getElementById('confirmNewPass').value = '';
    }).catch(err => { toggleLoading('btnUpdatePassword', false, `<i class="fas fa-floppy-disk"></i> আপডেট`); alert('ব্যর্থ: '+err.message); });
  });
}

function switchSubView(vid) {
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(vid + '-view');
  if (target) {
    target.classList.add('active');
    console.log("View:", vid);
    if (vid==='customerList') initCustomerList();
    else if (vid==='addCustomer') initAddCustomerForm();
    else if (vid==='editUsers') loadEditUsers();
    else if (vid==='userApprovals') loadPendingUsers();
  }
}

// ---------- CUSTOMER LIST (admin sees all, can edit/delete) ----------
function initCustomerList() {
  const actionsDiv = document.getElementById('customerActions');
  actionsDiv.innerHTML = '';
  if (currentUser.role==='admin') {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary'; addBtn.style.width = 'auto';
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Customer';
    addBtn.addEventListener('click', ()=>{ clearCustomerForm(); switchSubView('addCustomer'); });
    actionsDiv.appendChild(addBtn);
  }
  loadCustomerTable();
}

function loadCustomerTable() {
  const container = document.getElementById('customerTableContainer');
  onValue(ref(database, 'customers'), (snap) => {
    const customers = snap.val();
    container.innerHTML = '';
    if (!customers) { container.innerHTML='<p class="empty-message">কোনো কাস্টমার নেই।</p>'; return; }
    let filtered;
    if (currentUser.role === 'admin') {
      filtered = Object.entries(customers);
    } else {
      filtered = Object.entries(customers).filter(([_, c]) => {
        if (!c.salesEmails) return false;
        const emails = Array.isArray(c.salesEmails) ? c.salesEmails : c.salesEmails.split(',').map(e=>e.trim());
        return emails.includes(currentUser.email);
      });
    }
    if (filtered.length===0) { container.innerHTML='<p class="empty-message">কোনো কাস্টমার নেই।</p>'; return; }
    const table = document.createElement('table'); table.className='data-table';
    table.innerHTML = `<thead><tr><th>Code</th><th>Name</th><th>Warehouse</th><th>Unit</th><th>Line</th><th>Region</th><th>Area</th><th>Point</th><th>ERP Code</th>${currentUser.role==='admin'?'<th>Action</th>':''}</tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    filtered.forEach(([key, cust])=> {
      const r = document.createElement('tr');
      r.innerHTML = `<td>${cust.customerCode||''}</td><td>${cust.customerName||''}</td><td>${cust.warehouse||''}</td><td>${cust.unit||''}</td><td>${cust.line||''}</td><td>${cust.region||''}</td><td>${cust.area||''}</td><td>${cust.point||''}</td><td>${cust.erpCode||''}</td>${currentUser.role==='admin'?`<td><button class="btn-edit edit-cust-btn" data-id="${key}">এডিট</button> <button class="btn-delete delete-cust-btn" data-id="${key}">ডিলিট</button></td>`:''}`;
      tbody.appendChild(r);
    });
    container.appendChild(table);
    if (currentUser.role==='admin') {
      document.querySelectorAll('.edit-cust-btn').forEach(b => b.addEventListener('click', () => editCustomer(b.dataset.id, customers[b.dataset.id])));
      document.querySelectorAll('.delete-cust-btn').forEach(b => b.addEventListener('click', () => {
        if (confirm('এই কাস্টমার ডিলিট করবেন?')) remove(ref(database, 'customers/'+b.dataset.id)).then(()=> alert('ডিলিট সফল')).catch(err=> alert('ত্রুটি: '+err.message));
      }));
    }
  });
}

function editCustomer(id, data) {
  document.getElementById('editCustomerId').value = id;
  document.getElementById('customerFormTitle').textContent = 'কাস্টমার এডিট করুন';
  document.getElementById('custCode').value = data.customerCode || '';
  document.getElementById('custName').value = data.customerName || '';
  document.getElementById('custWarehouse').value = data.warehouse || '';
  document.getElementById('custUnit').value = data.unit || '';
  updateLineDropdown('custUnit','custLine');
  document.getElementById('custLine').value = data.line || '';
  document.getElementById('custRegion').value = data.region || '';
  document.getElementById('custArea').value = data.area || '';
  document.getElementById('custPoint').value = data.point || '';
  document.getElementById('custErpCode').value = data.erpCode || '';
  document.getElementById('custSalesEmails').value = (Array.isArray(data.salesEmails)? data.salesEmails.join(', ') : data.salesEmails) || '';
  document.getElementById('btnCancelCustomerEdit').style.display = 'inline-flex';
  switchSubView('addCustomer');
}

function clearCustomerForm() {
  document.getElementById('editCustomerId').value = '';
  document.getElementById('customerFormTitle').textContent = 'নতুন কাস্টমার যোগ করুন';
  ['custCode','custName','custWarehouse','custRegion','custArea','custPoint','custErpCode','custSalesEmails'].forEach(id=> document.getElementById(id).value='');
  document.getElementById('custUnit').value='';
  document.getElementById('custLine').innerHTML='<option value="">প্রথমে Unit সিলেক্ট করুন</option>';
  document.getElementById('btnCancelCustomerEdit').style.display = 'none';
}

function initAddCustomerForm() {
  document.getElementById('custUnit').addEventListener('change', ()=> updateLineDropdown('custUnit','custLine'));
  document.getElementById('btnSaveCustomer').onclick = saveCustomer;
  document.getElementById('btnCancelCustomerEdit').onclick = ()=> { clearCustomerForm(); switchSubView('customerList'); };
  document.getElementById('btnBackToCustomerList').onclick = ()=> { clearCustomerForm(); switchSubView('customerList'); };
  // CSV
  const csvArea = document.getElementById('csvUploadArea');
  const csvInput = document.getElementById('csvFileInput');
  csvArea.addEventListener('click', ()=> csvInput.click());
  csvArea.addEventListener('dragover', e=>{ e.preventDefault(); csvArea.style.borderColor='#2a5298'; });
  csvArea.addEventListener('dragleave', ()=> csvArea.style.borderColor='#94a3b8';);
  csvArea.addEventListener('drop', e=>{
    e.preventDefault(); csvArea.style.borderColor='#94a3b8';
    if (e.dataTransfer.files.length) { csvInput.files = e.dataTransfer.files; handleCSV(e.dataTransfer.files[0]); }
  });
  csvInput.addEventListener('change', e=>{ if(e.target.files.length) handleCSV(e.target.files[0]); });
  document.getElementById('btnUploadCSV').addEventListener('click', uploadCSV);
}

function saveCustomer() {
  const id = document.getElementById('editCustomerId').value;
  const code = document.getElementById('custCode').value.trim();
  const name = document.getElementById('custName').value.trim();
  const warehouse = document.getElementById('custWarehouse').value.trim();
  const unit = document.getElementById('custUnit').value;
  const line = document.getElementById('custLine').value;
  const region = document.getElementById('custRegion').value.trim();
  const area = document.getElementById('custArea').value.trim();
  const point = document.getElementById('custPoint').value.trim();
  const erp = document.getElementById('custErpCode').value.trim();
  const emailsRaw = document.getElementById('custSalesEmails').value.trim();
  if (!code||!name||!warehouse||!unit||!line||!region||!area||!emailsRaw) { alert('আবশ্যক ক্ষেত্র পূরণ করুন।'); return; }
  const emails = emailsRaw.split(',').map(e=>e.trim()).filter(e=>e);
  if (!emails.length) { alert('ইমেইল দিন।'); return; }
  const data = { customerCode:code, customerName:name, warehouse, unit, line, region, area, point:point||'', erpCode:erp||'', salesEmails:emails, updatedAt: new Date().toISOString() };
  if (id) {
    data.updatedBy = currentUser.email;
    toggleLoading('btnSaveCustomer', true, `<i class="fas fa-save"></i> আপডেট`);
    update(ref(database, 'customers/'+id), data).then(()=>{
      toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ`);
      alert('কাস্টমার আপডেট হয়েছে!'); clearCustomerForm(); switchSubView('customerList');
    }).catch(err=>{ toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ`); alert('ত্রুটি: '+err.message); });
  } else {
    data.createdBy = currentUser.email; data.createdAt = new Date().toISOString();
    toggleLoading('btnSaveCustomer', true, `<i class="fas fa-save"></i> সেভ`);
    push(ref(database,'customers')).then(ref=> set(ref, data)).then(()=>{
      toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ`);
      alert('কাস্টমার যোগ হয়েছে!'); clearCustomerForm();
    }).catch(err=>{ toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ`); alert('ত্রুটি: '+err.message); });
  }
}

// CSV functions
function handleCSV(file) {
  const reader = new FileReader();
  reader.onload = e => {
    const lines = e.target.result.split('\n').filter(l=>l.trim());
    if (lines.length<2) { alert('অন্তত একটি ডাটা রো দরকার।'); return; }
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
    const req = ['customercode','customername','warehouse','unit','line','region','area','salesemails'];
    if (req.some(r=>!headers.includes(r))) { alert('কলাম missing: '+req.filter(r=>!headers.includes(r)).join(', ')); return; }
    csvData = [];
    for (let i=1; i<lines.length; i++) {
      const cols = lines[i].split(',').map(c=>c.trim());
      if (cols.length<headers.length) continue;
      const obj = {}; headers.forEach((h,idx)=> obj[h]=cols[idx]);
      if (!obj.customercode||!obj.customername||!obj.warehouse||!obj.unit||!obj.line||!obj.region||!obj.area||!obj.salesemails) continue;
      obj.salesemails = obj.salesemails.split(';').map(e=>e.trim()).filter(e=>e);
      csvData.push(obj);
    }
    document.getElementById('csvPreview').innerHTML = `<p>${csvData.length} টি কাস্টমার পাওয়া গেছে।</p>`;
    document.getElementById('btnUploadCSV').style.display = 'inline-block';
  };
  reader.readAsText(file);
}
async function uploadCSV() {
  if (!csvData.length) return;
  toggleLoading('btnUploadCSV', true, `<i class="fas fa-upload"></i> ইম্পোর্ট`);
  let ok=0, fail=0;
  for (const row of csvData) {
    const key = push(ref(database,'customers')).key;
    const data = { customerCode:row.customercode, customerName:row.customername, warehouse:row.warehouse, unit:row.unit, line:row.line, region:row.region, area:row.area, point:row.point||'', erpCode:row.erpcode||'', salesEmails:row.salesemails, createdBy:currentUser.email, createdAt:new Date().toISOString() };
    try { await set(ref(database,'customers/'+key), data); ok++; } catch(err) { fail++; }
  }
  toggleLoading('btnUploadCSV', false, `<i class="fas fa-upload"></i> ইম্পোর্ট`);
  document.getElementById('csvStatus').innerText = `ইম্পোর্ট: ${ok} সফল, ${fail} ব্যর্থ।`;
  csvData=[]; document.getElementById('btnUploadCSV').style.display='none'; document.getElementById('csvPreview').innerHTML='';
}

// ---------- EDIT USERS ----------
function loadEditUsers() {
  const container = document.getElementById('editUsersContainer');
  onValue(ref(database,'users'), snap=>{
    const users = snap.val(); container.innerHTML='';
    if (!users) { container.innerHTML='<p class="empty-message">কোনো ইউজার নেই।</p>'; return; }
    const table = document.createElement('table'); table.className='data-table';
    table.innerHTML = `<thead><tr><th>UID</th><th>নাম</th><th>ইমেইল</th><th>Enroll</th><th>Unit</th><th>Line</th><th>Status</th><th>Action</th></tr></thead><tbody></tbody>`;
    const tbody = table.querySelector('tbody');
    Object.entries(users).forEach(([uid,u])=> {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${uid.substring(0,8)}...</td><td>${u.name}</td><td>${u.email}</td><td>${u.enroll}</td><td>${u.unit||''}</td><td>${u.line||''}</td><td>${u.status}</td><td><button class="btn-edit edit-user-btn" data-uid="${uid}">এডিট</button> <button class="btn-delete delete-user-btn" data-uid="${uid}">ডিলিট</button></td>`;
      tbody.appendChild(row);
    });
    container.appendChild(table);
    container.querySelectorAll('.edit-user-btn').forEach(b => b.addEventListener('click', ()=> showEditUserForm(b.dataset.uid, users[b.dataset.uid])));
    container.querySelectorAll('.delete-user-btn').forEach(b => b.addEventListener('click', ()=>{
      if (confirm('ডিলিট করবেন?')) remove(ref(database,'users/'+b.dataset.uid)).then(()=> alert('ডিলিট সফল')).catch(err=> alert('ত্রুটি: '+err.message));
    }));
  });
}
function showEditUserForm(uid, user) {
  const container = document.getElementById('editUsersContainer');
  const div = document.createElement('div'); div.className='card';
  div.innerHTML = `<h3>ইউজার এডিট: ${user.name}</h3>
    <div class="form-grid">
      <div class="input-group"><label>নাম</label><input id="editName" value="${user.name}"></div>
      <div class="input-group"><label>Unit</label><select id="editUnit">${Object.keys(unitLines).map(u=>`<option value="${u}" ${user.unit===u?'selected':''}>${u}</option>`).join('')}</select></div>
      <div class="input-group"><label>Line</label><select id="editLine">${(unitLines[user.unit]||[]).map(l=>`<option value="${l}" ${user.line===l?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="input-group"><label>Status</label><select id="editStatus"><option value="pending" ${user.status==='pending'?'selected':''}>Pending</option><option value="approved" ${user.status==='approved'?'selected':''}>Approved</option><option value="rejected" ${user.status==='rejected'?'selected':''}>Rejected</option></select></div>
    </div>
    <div class="btn-row"><button class="btn btn-primary" id="btnUpdateUser">আপডেট</button><button class="btn btn-link" id="btnCancelEdit">বাতিল</button></div>`;
  container.innerHTML=''; container.appendChild(div);
  document.getElementById('editUnit').addEventListener('change', function() { const sel=document.getElementById('editLine'); sel.innerHTML=''; (unitLines[this.value]||[]).forEach(l=>{ const o=document.createElement('option'); o.value=l; o.text=l; sel.appendChild(o); }); });
  document.getElementById('btnCancelEdit').addEventListener('click', ()=> loadEditUsers());
  document.getElementById('btnUpdateUser').addEventListener('click', async ()=>{
    const data = { name: document.getElementById('editName').value, unit: document.getElementById('editUnit').value, line: document.getElementById('editLine').value, status: document.getElementById('editStatus').value };
    try { await update(ref(database,'users/'+uid), data); alert('আপডেট সফল'); loadEditUsers(); } catch(err) { alert('ব্যর্থ: '+err.message); }
  });
}

// ---------- USER APPROVALS ----------
function loadPendingUsers() {
  const container = document.getElementById('pendingUsersContainer');
  onValue(ref(database,'users'), snap=>{
    const users = snap.val(); container.innerHTML='';
    if (!users) { container.innerHTML='<p class="empty-message">কোনো ইউজার নেই।</p>'; return; }
    let found=false;
    const table = document.createElement('table'); table.className='data-table';
    table.innerHTML = `<thead><tr><th>নাম</th><th>ইমেইল</th><th>Enroll</th><th>Unit</th><th>Line</th><th>Action</th></tr></thead><tbody></tbody>`;
    const tbody=table.querySelector('tbody');
    Object.entries(users).forEach(([uid,u])=>{
      if (u.status==='pending') { found=true;
        const row=document.createElement('tr');
        row.innerHTML=`<td>${u.name}</td><td>${u.email}</td><td>${u.enroll}</td><td>${u.unit||''}</td><td>${u.line||''}</td><td><button class="btn-approve" data-uid="${uid}">Approve</button> <button class="btn-reject" data-uid="${uid}">Reject</button></td>`;
        tbody.appendChild(row);
      }
    });
    if (!found) { container.innerHTML='<p class="empty-message">কোনো পেন্ডিং ইউজার নেই।</p>'; return; }
    container.appendChild(table);
    container.querySelectorAll('.btn-approve').forEach(b=> b.addEventListener('click', async e=>{ await update(ref(database,'users/'+e.target.dataset.uid),{status:'approved'}); alert('অনুমোদিত'); }));
    container.querySelectorAll('.btn-reject').forEach(b=> b.addEventListener('click', async e=>{ await update(ref(database,'users/'+e.target.dataset.uid),{status:'rejected'}); alert('বাতিল'); }));
  });
}