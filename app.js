import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Config
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
let csvData = []; // for CSV preview

// View switching for auth
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

// Google Apps Script URL
const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

// Toggle loading helper
function toggleLoading(buttonId, isLoading, defaultHtml) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং হচ্ছে...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultHtml;
  }
}

console.log("AVL App initialized");

// ---------- LOGIN ----------
document.getElementById('btnLogin').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const defaultHtml = `<i class="fas fa-right-to-bracket"></i> লগইন`;
  if (!email || !password) {
    alert('ইমেইল ও পাসওয়ার্ড প্রদান করুন।');
    return;
  }
  toggleLoading('btnLogin', true, defaultHtml);
  
  signInWithEmailAndPassword(auth, email, password)
    .then(async (userCredential) => {
      const user = userCredential.user;
      console.log("Logged in UID:", user.uid);
      const userRef = ref(database, 'users/' + user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট ডাটাবেইজে পাওয়া যায়নি। প্রশাসকের সাথে যোগাযোগ করুন।');
        return;
      }
      const userData = snap.val();
      
      if (userData.status !== 'approved') {
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট এখনো অনুমোদিত হয়নি। অ্যাডমিনের অনুমোদন প্রয়োজন।');
        return;
      }
      
      // Determine role: check admins node
      const adminsRef = ref(database, 'admins');
      const adminsSnap = await get(adminsRef);
      const admins = adminsSnap.val() || {};
      const emailKey = email.replace(/\./g, '_');
      const isAdmin = admins.hasOwnProperty(emailKey) && admins[emailKey] === true;
      
      currentUser = {
        uid: user.uid,
        email: user.email,
        name: userData.name,
        role: isAdmin ? 'admin' : 'user',
        status: userData.status
      };
      console.log("Current user set:", currentUser);
      
      toggleLoading('btnLogin', false, defaultHtml);
      showMainApp();
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// ---------- REGISTRATION SEND OTP ----------
document.getElementById('btnSendOTP').addEventListener('click', () => {
  const enroll = document.getElementById('regEnroll').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const salesLine = document.getElementById('regSalesLine').value;
  const unit = document.getElementById('regUnit').value;
  const password = document.getElementById('regPassword').value;
  const defaultHtml = `<i class="fas fa-paper-plane"></i> ওটিপি কোড পাঠান`;
  
  if (!enroll || !name || !email || !salesLine || !unit || !password) {
    alert('সকল ঘর পূরণ করুন।');
    return;
  }
  if (password.length < 6) {
    alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
    return;
  }
  
  tempRegistrationData = { enroll, name, email, salesLine, unit, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("Generated OTP:", generatedOTP);
  
  toggleLoading('btnSendOTP', true, defaultHtml);
  
  fetch(appsScriptURL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_email: email,
      to_name: name,
      otp_code: generatedOTP,
      type: "REGISTRATION"
    })
  })
  .then(() => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি পাঠানো হয়েছে।`;
    switchAuthView(otpView);
  })
  .catch(err => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    alert('ওটিপি পাঠাতে সমস্যা হয়েছে।');
    console.error(err);
  });
});

// ---------- VERIFY OTP & REGISTER ----------
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
  const userOTP = document.getElementById('otpInput').value.trim();
  const defaultHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও রেজিস্ট্রেশন জমা দিন`;
  
  if (userOTP !== generatedOTP) {
    alert('ভুল ওটিপি!');
    return;
  }
  
  toggleLoading('btnVerifyOTP', true, defaultHtml);
  
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
    .then(async (userCredential) => {
      const uid = userCredential.user.uid;
      console.log("New user UID:", uid);
      await set(ref(database, 'users/' + uid), {
        enroll: tempRegistrationData.enroll,
        name: tempRegistrationData.name,
        email: tempRegistrationData.email,
        salesLine: tempRegistrationData.salesLine,
        unit: tempRegistrationData.unit,
        status: 'pending',
        role: 'user',
        createdAt: new Date().toISOString()
      });
      
      await signOut(auth);
      toggleLoading('btnVerifyOTP', false, defaultHtml);
      alert('রেজিস্ট্রেশন সফল হয়েছে! অ্যাডমিনের অনুমোদনের পর আপনি লগইন করতে পারবেন।');
      document.getElementById('otpInput').value = '';
      switchAuthView(loginView);
    })
    .catch(err => {
      toggleLoading('btnVerifyOTP', false, defaultHtml);
      alert('রেজিস্ট্রেশন ব্যর্থ: ' + err.message);
    });
});

// ---------- MAIN APP ----------
function showMainApp() {
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  mainAppView.style.display = 'flex';
  mainAppView.classList.add('active');
  
  document.getElementById('loggedUserName').textContent = currentUser.name;
  
  // Show admin-only menus
  if (currentUser.role === 'admin') {
    document.getElementById('adminApprovalsMenu').style.display = 'block';
    document.getElementById('editUsersMenu').style.display = 'block';
  } else {
    document.getElementById('adminApprovalsMenu').style.display = 'none';
    document.getElementById('editUsersMenu').style.display = 'none';
  }
  
  // Activate default dashboard
  switchSubView('dashboard');
  
  // Navigation click handlers
  const navLinks = document.querySelectorAll('.nav-menu li a[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = link.getAttribute('data-view');
      switchSubView(viewId);
      navLinks.forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });
  
  // Logout
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await signOut(auth);
    mainAppView.style.display = 'none';
    mainAppView.classList.remove('active');
    switchAuthView(loginView);
    currentUser = { uid: null, email: null, name: null, role: 'user', status: null };
  });
  
  // Password update
  document.getElementById('btnUpdatePassword').addEventListener('click', () => {
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmNewPass').value;
    if (!newPass || !confirmPass) {
      alert('উভয় ঘর পূরণ করুন।');
      return;
    }
    if (newPass.length < 6) {
      alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
      return;
    }
    if (newPass !== confirmPass) {
      alert('পাসওয়ার্ড মেলেনি।');
      return;
    }
    toggleLoading('btnUpdatePassword', true, `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড আপডেট`);
    updatePassword(auth.currentUser, newPass)
      .then(() => {
        toggleLoading('btnUpdatePassword', false, `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড আপডেট`);
        alert('পাসওয়ার্ড সফলভাবে আপডেট হয়েছে।');
        document.getElementById('newPass').value = '';
        document.getElementById('confirmNewPass').value = '';
      })
      .catch(err => {
        toggleLoading('btnUpdatePassword', false, `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড আপডেট`);
        alert('আপডেট ব্যর্থ: ' + err.message);
      });
  });
  
  // Initialize customer list (if view is customerList)
  // We'll load on switch
  if (currentUser.role === 'admin') {
    loadPendingUsers();
  }
}

function switchSubView(viewId) {
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId + '-view');
  if (target) {
    target.classList.add('active');
    console.log("Switched to sub-view:", viewId);
    // Specific initializations
    if (viewId === 'customerList') {
      initCustomerList();
    } else if (viewId === 'addCustomer') {
      initAddCustomerForm();
    } else if (viewId === 'editUsers') {
      loadEditUsers();
    } else if (viewId === 'userApprovals') {
      loadPendingUsers();
    }
  }
}

// ---------- CUSTOMER LIST ----------
function initCustomerList() {
  const actionsDiv = document.getElementById('customerActions');
  actionsDiv.innerHTML = '';
  if (currentUser.role === 'admin') {
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-primary';
    addBtn.style.width = 'auto';
    addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Customer';
    addBtn.addEventListener('click', () => switchSubView('addCustomer'));
    actionsDiv.appendChild(addBtn);
  }
  loadCustomerTable();
}

function loadCustomerTable() {
  const container = document.getElementById('customerTableContainer');
  const customersRef = ref(database, 'customers');
  onValue(customersRef, (snapshot) => {
    const customers = snapshot.val();
    container.innerHTML = '';
    if (!customers) {
      container.innerHTML = '<p class="empty-message">কোনো কাস্টমার নেই।</p>';
      return;
    }
    
    // Filter customers based on user's email (sales persons)
    const filtered = Object.entries(customers).filter(([key, cust]) => {
      if (!cust.salesEmails) return false;
      const emails = Array.isArray(cust.salesEmails) ? cust.salesEmails : cust.salesEmails.split(',').map(e => e.trim());
      return emails.includes(currentUser.email);
    });
    
    if (filtered.length === 0) {
      container.innerHTML = '<p class="empty-message">আপনার জন্য কোনো কাস্টমার নেই।</p>';
      return;
    }
    
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Code</th><th>Name</th><th>Warehouse</th><th>Unit</th><th>Line</th><th>Region</th><th>Area</th><th>Point</th><th>ERP Code</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    filtered.forEach(([key, cust]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${cust.customerCode || ''}</td>
        <td>${cust.customerName || ''}</td>
        <td>${cust.warehouse || ''}</td>
        <td>${cust.unit || ''}</td>
        <td>${cust.line || ''}</td>
        <td>${cust.region || ''}</td>
        <td>${cust.area || ''}</td>
        <td>${cust.point || ''}</td>
        <td>${cust.erpCode || ''}</td>
      `;
      tbody.appendChild(row);
    });
    container.appendChild(table);
  });
}

// ---------- ADD CUSTOMER FORM ----------
function initAddCustomerForm() {
  // Unit change -> Line dropdown
  const unitSelect = document.getElementById('custUnit');
  const lineSelect = document.getElementById('custLine');
  unitSelect.addEventListener('change', () => {
    const unit = unitSelect.value;
    lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
    const lines = {
      'AFBL': ['A','B','C'],
      'ADL': ['D','UHT'],
      'AEEL': ['E'],
      'AALL': ['AG'],
      'AHHL': ['H'],
      'ABEL': ['BC','SP']
    };
    if (lines[unit]) {
      lines[unit].forEach(l => {
        const opt = document.createElement('option');
        opt.value = l; opt.text = l;
        lineSelect.appendChild(opt);
      });
    }
  });
  
  document.getElementById('btnSaveCustomer').onclick = () => saveCustomer();
  document.getElementById('btnBackToCustomerList').onclick = () => switchSubView('customerList');
  
  // CSV upload handling
  const csvArea = document.getElementById('csvUploadArea');
  const csvFileInput = document.getElementById('csvFileInput');
  csvArea.addEventListener('click', () => csvFileInput.click());
  csvArea.addEventListener('dragover', (e) => { e.preventDefault(); csvArea.style.borderColor = '#2a5298'; });
  csvArea.addEventListener('dragleave', () => { csvArea.style.borderColor = '#a0aec0'; });
  csvArea.addEventListener('drop', (e) => {
    e.preventDefault();
    csvArea.style.borderColor = '#a0aec0';
    if (e.dataTransfer.files.length) {
      csvFileInput.files = e.dataTransfer.files;
      handleCSVFile(e.dataTransfer.files[0]);
    }
  });
  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleCSVFile(e.target.files[0]);
  });
  
  document.getElementById('btnUploadCSV').addEventListener('click', uploadCSV);
}

function saveCustomer() {
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
  
  if (!code || !name || !warehouse || !unit || !line || !region || !area || !emailsRaw) {
    alert('অনুগ্রহ করে আবশ্যক ক্ষেত্রগুলি পূরণ করুন।');
    return;
  }
  
  const emails = emailsRaw.split(',').map(e => e.trim()).filter(e => e);
  if (emails.length === 0) {
    alert('অন্তত একটি সেলস পারসন ইমেইল দিন।');
    return;
  }
  
  const customerData = {
    customerCode: code,
    customerName: name,
    warehouse,
    unit,
    line,
    region,
    area,
    point: point || '',
    erpCode: erp || '',
    salesEmails: emails,
    createdBy: currentUser.email,
    createdAt: new Date().toISOString()
  };
  
  console.log("Saving customer:", customerData);
  toggleLoading('btnSaveCustomer', true, `<i class="fas fa-save"></i> সেভ করুন`);
  const newRef = push(ref(database, 'customers'));
  set(newRef, customerData)
    .then(() => {
      toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ করুন`);
      alert('কাস্টমার সফলভাবে যোগ করা হয়েছে!');
      clearCustomerForm();
    })
    .catch(err => {
      toggleLoading('btnSaveCustomer', false, `<i class="fas fa-save"></i> সেভ করুন`);
      alert('সেভ করতে সমস্যা হয়েছে: ' + err.message);
    });
}

function clearCustomerForm() {
  ['custCode','custName','custWarehouse','custRegion','custArea','custPoint','custErpCode','custSalesEmails'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('custUnit').value = '';
  document.getElementById('custLine').innerHTML = '<option value="">প্রথমে Unit সিলেক্ট করুন</option>';
}

// CSV Handling
function handleCSVFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target.result;
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      alert('CSV ফাইলে অন্তত একটি ডাটা রো থাকতে হবে।');
      return;
    }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const required = ['customercode','customername','warehouse','unit','line','region','area','salesemails'];
    const missing = required.filter(r => !headers.includes(r));
    if (missing.length) {
      alert('আবশ্যক কলাম নেই: ' + missing.join(', '));
      return;
    }
    csvData = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < headers.length) continue;
      const obj = {};
      headers.forEach((h, idx) => { obj[h] = cols[idx]; });
      if (!obj.customercode || !obj.customername || !obj.warehouse || !obj.unit || !obj.line || !obj.region || !obj.area || !obj.salesemails) {
        continue;
      }
      obj.salesemails = obj.salesemails.split(';').map(e => e.trim()).filter(e => e); // support semicolon in CSV
      csvData.push(obj);
    }
    document.getElementById('csvPreview').innerHTML = `<p>${csvData.length} টি কাস্টমার পাওয়া গেছে।</p>`;
    document.getElementById('btnUploadCSV').style.display = 'inline-block';
    console.log("CSV parsed:", csvData);
  };
  reader.readAsText(file);
}

async function uploadCSV() {
  if (!csvData.length) return;
  toggleLoading('btnUploadCSV', true, `<i class="fas fa-upload"></i> CSV থেকে ইম্পোর্ট করুন`);
  const updates = {};
  const customersRef = ref(database, 'customers');
  let success = 0, failed = 0;
  
  for (const row of csvData) {
    const newKey = push(customersRef).key;
    const customerData = {
      customerCode: row.customercode,
      customerName: row.customername,
      warehouse: row.warehouse,
      unit: row.unit,
      line: row.line,
      region: row.region,
      area: row.area,
      point: row.point || '',
      erpCode: row.erpcode || '',
      salesEmails: row.salesemails,
      createdBy: currentUser.email,
      createdAt: new Date().toISOString()
    };
    try {
      await set(ref(database, 'customers/' + newKey), customerData);
      success++;
    } catch (err) {
      console.error("CSV row failed:", err);
      failed++;
    }
  }
  toggleLoading('btnUploadCSV', false, `<i class="fas fa-upload"></i> CSV থেকে ইম্পোর্ট করুন`);
  document.getElementById('csvStatus').innerText = `ইম্পোর্ট সম্পন্ন: ${success} সফল, ${failed} ব্যর্থ।`;
  csvData = [];
  document.getElementById('btnUploadCSV').style.display = 'none';
  document.getElementById('csvPreview').innerHTML = '';
}

// ---------- EDIT USERS (Admin) ----------
function loadEditUsers() {
  const container = document.getElementById('editUsersContainer');
  const usersRef = ref(database, 'users');
  onValue(usersRef, (snapshot) => {
    const users = snapshot.val();
    container.innerHTML = '';
    if (!users) {
      container.innerHTML = '<p class="empty-message">কোনো ইউজার নেই।</p>';
      return;
    }
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead>
        <tr><th>UID</th><th>নাম</th><th>ইমেইল</th><th>Enroll</th><th>Sales Line</th><th>Unit</th><th>Status</th><th>Action</th></tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    Object.entries(users).forEach(([uid, user]) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${uid.substring(0,8)}...</td>
        <td>${user.name}</td>
        <td>${user.email}</td>
        <td>${user.enroll}</td>
        <td>${user.salesLine}</td>
        <td>${user.unit}</td>
        <td>${user.status}</td>
        <td><button class="btn-edit edit-user-btn" data-uid="${uid}">এডিট</button></td>
      `;
      tbody.appendChild(row);
    });
    container.appendChild(table);
    
    // Edit button handlers
    container.querySelectorAll('.edit-user-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = btn.dataset.uid;
        const user = users[uid];
        showEditUserForm(uid, user);
      });
    });
  });
}

function showEditUserForm(uid, user) {
  const container = document.getElementById('editUsersContainer');
  const form = document.createElement('div');
  form.className = 'inline-form';
  form.innerHTML = `
    <h3>ইউজার এডিট: ${user.name}</h3>
    <div class="row">
      <div class="input-group">
        <label>নাম</label>
        <input type="text" id="editName" value="${user.name}">
      </div>
      <div class="input-group">
        <label>Sales Line</label>
        <select id="editSalesLine">
          <option value="Beverage" ${user.salesLine==='Beverage'?'selected':''}>Beverage</option>
          <option value="Food" ${user.salesLine==='Food'?'selected':''}>Food</option>
          <option value="Dairy" ${user.salesLine==='Dairy'?'selected':''}>Dairy</option>
          <option value="Commodity" ${user.salesLine==='Commodity'?'selected':''}>Commodity</option>
        </select>
      </div>
    </div>
    <div class="row">
      <div class="input-group">
        <label>Unit</label>
        <select id="editUnit">
          <option value="AVL" ${user.unit==='AVL'?'selected':''}>AVL</option>
          <option value="AFBL" ${user.unit==='AFBL'?'selected':''}>AFBL</option>
        </select>
      </div>
      <div class="input-group">
        <label>Status</label>
        <select id="editStatus">
          <option value="pending" ${user.status==='pending'?'selected':''}>Pending</option>
          <option value="approved" ${user.status==='approved'?'selected':''}>Approved</option>
          <option value="rejected" ${user.status==='rejected'?'selected':''}>Rejected</option>
        </select>
      </div>
    </div>
    <button class="btn btn-primary" id="btnUpdateUser">আপডেট করুন</button>
    <button class="btn btn-link" id="btnCancelEdit">বাতিল</button>
  `;
  container.innerHTML = '';
  container.appendChild(form);
  
  document.getElementById('btnCancelEdit').addEventListener('click', () => loadEditUsers());
  document.getElementById('btnUpdateUser').addEventListener('click', async () => {
    const newData = {
      name: document.getElementById('editName').value,
      salesLine: document.getElementById('editSalesLine').value,
      unit: document.getElementById('editUnit').value,
      status: document.getElementById('editStatus').value
    };
    console.log("Updating user", uid, newData);
    try {
      await update(ref(database, 'users/' + uid), newData);
      alert('ইউজার আপডেট সফল হয়েছে।');
      loadEditUsers();
    } catch (err) {
      alert('আপডেট ব্যর্থ: ' + err.message);
    }
  });
}

// ---------- USER APPROVALS (Admin) ----------
function loadPendingUsers() {
  const container = document.getElementById('pendingUsersContainer');
  const usersRef = ref(database, 'users');
  onValue(usersRef, (snapshot) => {
    const users = snapshot.val();
    container.innerHTML = '';
    if (!users) {
      container.innerHTML = '<p class="empty-message">কোনো ইউজার নেই।</p>';
      return;
    }
    let pendingFound = false;
    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = `
      <thead><tr><th>নাম</th><th>ইমেইল</th><th>Enroll ID</th><th>Sales Line</th><th>Unit</th><th>Action</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');
    Object.entries(users).forEach(([uid, user]) => {
      if (user.status === 'pending') {
        pendingFound = true;
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.enroll}</td>
          <td>${user.salesLine}</td>
          <td>${user.unit}</td>
          <td>
            <button class="btn-approve" data-uid="${uid}">Approve</button>
            <button class="btn-reject" data-uid="${uid}">Reject</button>
          </td>
        `;
        tbody.appendChild(row);
      }
    });
    if (!pendingFound) {
      container.innerHTML = '<p class="empty-message">কোনো পেন্ডিং ইউজার নেই।</p>';
      return;
    }
    container.appendChild(table);
    
    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.target.dataset.uid;
        if (confirm('এই ইউজারকে অনুমোদন করতে চান?')) {
          await update(ref(database, 'users/' + uid), { status: 'approved' });
          alert('ইউজার অনুমোদিত হয়েছে।');
        }
      });
    });
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.target.dataset.uid;
        if (confirm('এই ইউজারকে বাতিল করতে চান?')) {
          await update(ref(database, 'users/' + uid), { status: 'rejected' });
          alert('ইউজার বাতিল করা হয়েছে।');
        }
      });
    });
  });
}