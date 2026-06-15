import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, off, push, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

let generatedOTP = null;
let tempRegistrationData = {};
let allUsersCache = {};
let allItemsCache = {};
let allCustomersCache = {};
let allOrdersCache = {};
let currentUser = { uid: null, email: null, name: null, role: 'user', status: null };
let selectedSalespersons = [];
let draftItems = [];

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
  if (view === registerView) loadUnitDropdowns();
}

async function loadUnitDropdowns() {
  const unitSelect = document.getElementById('regUnit');
  const lineSelect = document.getElementById('regSalesLine');
  const unitsRef = ref(database, 'units');
  unitSelect.innerHTML = '<option value="" disabled selected>লোড হচ্ছে...</option>';
  try {
    const snapshot = await get(unitsRef);
    const units = snapshot.val();
    unitSelect.innerHTML = '<option value="" disabled selected>ইউনিট সিলেক্ট করুন</option>';
    if (units) {
      Object.entries(units).forEach(([unitId, unit]) => {
        const option = document.createElement('option');
        option.value = unitId;
        option.textContent = unit.shortCode;
        unitSelect.appendChild(option);
      });
    } else {
      unitSelect.innerHTML = '<option value="" disabled>কোনো ইউনিট নেই</option>';
    }
    unitSelect.addEventListener('change', async () => {
      const selectedUnitId = unitSelect.value;
      lineSelect.innerHTML = '<option value="" disabled selected>লোড হচ্ছে...</option>';
      lineSelect.disabled = true;
      if (!selectedUnitId) return;
      const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
      const unitData = unitSnap.val();
      if (unitData && unitData.salesLines && unitData.salesLines.length > 0) {
        lineSelect.innerHTML = '<option value="" disabled selected>সেলস লাইন সিলেক্ট করুন</option>';
        unitData.salesLines.forEach(line => {
          const opt = document.createElement('option');
          opt.value = line;
          opt.textContent = line;
          lineSelect.appendChild(opt);
        });
        lineSelect.disabled = false;
      } else {
        lineSelect.innerHTML = '<option value="" disabled>এই ইউনিটে কোনো সেলস লাইন নেই</option>';
      }
    });
  } catch (error) {
    console.error('ইউনিট লোড করতে ব্যর্থ:', error);
    unitSelect.innerHTML = '<option value="" disabled>লোড ব্যর্থ</option>';
  }
}

const appsScriptURL = "https://script.google.com/macros/s/AKfycby4WFu5qoOuYFfiFFC1oDuHFQR2aVMZj4mBdBLQR_m6mxEOv31Gss5zfph1GcJuLeS65g/exec";

function toggleLoading(buttonId, isLoading, defaultHtml) {
  const btn = document.getElementById(buttonId);
  if (isLoading) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং হচ্ছে...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultHtml;
  }
}

function isPasswordStrong(password) {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return strongRegex.test(password);
}

async function isEnrollDuplicate(enroll) {
  const usersRef = ref(database, 'users');
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    const users = snapshot.val();
    return Object.values(users).some(user => user.enroll === enroll);
  }
  return false;
}

function isValidName(name) {
  return /^[A-Za-z\s]+$/.test(name);
}

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
      const userRef = ref(database, 'users/' + user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট ডাটাবেইজে পাওয়া যায়নি।');
        return;
      }
      const userData = snap.val();
      if (userData.status !== 'approved') {
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট এখনো অনুমোদিত হয়নি।');
        return;
      }
      const adminsRef = ref(database, 'admins');
      const adminsSnap = await get(adminsRef);
      const admins = adminsSnap.val() || {};
      const isAdmin = Object.keys(admins).some(key => admins[key] === true && key === email.replace(/\./g, '_'));
      currentUser = {
        uid: user.uid,
        email: user.email,
        name: userData.name,
        role: isAdmin ? 'admin' : (userData.role || 'sales'),
        status: userData.status
        salesLine: userData.salesLine || '' // ✅ নতুন লাইন
      };
      toggleLoading('btnLogin', false, defaultHtml);
      showMainApp();
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// ---------- REGISTRATION ----------
document.getElementById('btnSendOTP').addEventListener('click', async () => {
  const enroll = document.getElementById('regEnroll').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const unitSelect = document.getElementById('regUnit');
  const unitId = unitSelect.value;
  const unitShortCode = unitSelect.options[unitSelect.selectedIndex]?.text || '';
  const salesLine = document.getElementById('regSalesLine').value;
  const role = document.getElementById('regRole').value;
  const password = document.getElementById('regPassword').value;
  const defaultHtml = `<i class="fas fa-paper-plane"></i> ওটিপি কোড পাঠান`;

  if (!enroll || !name || !email || !unitId || !salesLine || !role || !password) {
    alert('সকল ঘর পূরণ করুন।');
    return;
  }
  if (!/^\d+$/.test(enroll)) { alert('Enroll ID শুধুমাত্র সংখ্যা হতে হবে।'); return; }
  if (!isValidName(name)) { alert('নাম শুধুমাত্র ইংরেজি অক্ষর ও স্পেস হতে পারে।'); return; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { alert('সঠিক ইমেইল ফরম্যাট প্রদান করুন।'); return; }
  if (!isPasswordStrong(password)) {
    alert('পাসওয়ার্ডে অন্তত ৮ অক্ষর, একটি বড় হাতের, একটি ছোট হাতের, একটি সংখ্যা ও একটি বিশেষ চিহ্ন থাকতে হবে।');
    return;
  }
  const duplicate = await isEnrollDuplicate(enroll);
  if (duplicate) { alert('এই Enroll ID ইতিমধ্যে নিবন্ধিত।'); return; }

  tempRegistrationData = { enroll, name, email, unitId, unitShortCode, salesLine, role, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  
  toggleLoading('btnSendOTP', true, defaultHtml);
  fetch(appsScriptURL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_email: email, to_name: name, otp_code: generatedOTP, type: "REGISTRATION" })
  })
  .then(() => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি পাঠানো হয়েছে।`;
    switchAuthView(otpView);
  })
  .catch(err => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    alert('ওটিপি পাঠাতে সমস্যা হয়েছে।');
  });
});

document.getElementById('btnVerifyOTP').addEventListener('click', () => {
  const userOTP = document.getElementById('otpInput').value.trim();
  const defaultHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও রেজিস্ট্রেশন জমা দিন`;
  if (userOTP !== generatedOTP) { alert('ভুল ওটিপি!'); return; }
  toggleLoading('btnVerifyOTP', true, defaultHtml);
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
    .then(async (userCredential) => {
      const uid = userCredential.user.uid;
      await set(ref(database, 'users/' + uid), {
        enroll: tempRegistrationData.enroll,
        name: tempRegistrationData.name,
        email: tempRegistrationData.email,
        unitId: tempRegistrationData.unitId,
        unitShortCode: tempRegistrationData.unitShortCode,
        salesLine: tempRegistrationData.salesLine,
        role: tempRegistrationData.role,
        status: 'pending',
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
  
  if (currentUser.role === 'admin') {
    document.getElementById('adminApprovalsMenu').style.display = 'block';
    document.getElementById('adminManageUnitsMenu').style.display = 'block';
  } else if (currentUser.role === 'manager') {
    document.getElementById('adminApprovalsMenu').style.display = 'none';
    document.getElementById('adminManageUnitsMenu').style.display = 'block';
  } else {
    document.getElementById('adminApprovalsMenu').style.display = 'none';
    document.getElementById('adminManageUnitsMenu').style.display = 'none';
  }
  
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  document.getElementById('dashboard-view').classList.add('active');
  
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
  
  document.getElementById('btnLogout').addEventListener('click', async () => {
    await signOut(auth);
    mainAppView.style.display = 'none';
    mainAppView.classList.remove('active');
    switchAuthView(loginView);
    currentUser = { uid: null, email: null, name: null, role: 'user', status: null };
  });
  
  document.getElementById('btnUpdatePassword').addEventListener('click', () => {
    const newPass = document.getElementById('newPass').value;
    const confirmPass = document.getElementById('confirmNewPass').value;
    if (!newPass || !confirmPass) { alert('উভয় ঘর পূরণ করুন।'); return; }
    if (newPass.length < 6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।'); return; }
    if (newPass !== confirmPass) { alert('পাসওয়ার্ড মেলেনি।'); return; }
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
}

function switchSubView(viewId) {
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId + '-view');
  if (target) target.classList.add('active');
  if (viewId === 'manageUnits') loadManageUnits();
  else if (viewId === 'userApprovals') loadUserManagement();
  else if (viewId === 'itemList') {
    loadItemFormUnits();
    loadItems();
    const createBtn = document.getElementById('btnShowCreateItem');
    if (createBtn) createBtn.style.display = (currentUser.role === 'sales') ? 'none' : 'inline-block';
  }
  else if (viewId === 'customerList') {
    // ইউজার ক্যাশ লোড (নিশ্চিত করতে get ব্যবহার করো)
    if (!allUsersCache || Object.keys(allUsersCache).length === 0) {
      const usersRef = ref(database, 'users');
      get(usersRef).then(snapshot => {
        allUsersCache = snapshot.val() || {};
        // ক্যাশ লোড হওয়ার পর সার্চ হ্যান্ডলার কল (একবার)
        if (!customerFormListenersAttached) {
          handleSalespersonSearch();
          customerFormListenersAttached = true;
        }
      });
    } else {
      // আগেই লোডেড থাকলে সরাসরি কল
      if (!customerFormListenersAttached) {
        handleSalespersonSearch();
        customerFormListenersAttached = true;
      }
    }
    loadCustomerFormUnits();
    loadCustomers();
    const createCustBtn = document.getElementById('btnShowCreateCustomer');
    if (createCustBtn) createCustBtn.style.display = (currentUser.role === 'sales') ? 'none' : 'inline-block';
  }
  else if (viewId === 'orderForm') {
    // নিশ্চিত করো আইটেম ক্যাশ লোড হয়েছে
    if (!allItemsCache || Object.keys(allItemsCache).length === 0) {
      // আইটেম লোড (একবার)
      const itemsRef = ref(database, 'items');
      onValue(itemsRef, (snapshot) => {
        allItemsCache = snapshot.val() || {};
      });
    }
    // কাস্টমার ক্যাশও লোড করো (পরবর্তী সমস্যার জন্য)
    if (!allCustomersCache || Object.keys(allCustomersCache).length === 0) {
      const custRef = ref(database, 'customers');
      onValue(custRef, (snapshot) => {
        allCustomersCache = snapshot.val() || {};
      });
    }
    draftItems = [];
    renderDraftTable();
  }
  else if (viewId === 'myOrders') loadMyOrders();
}

// ========== USER MANAGEMENT ==========
function loadUserManagement() {
  const container = document.getElementById('allUsersContainer');
  const usersRef = ref(database, 'users');
  const searchInput = document.getElementById('userSearchInput');
  const exportBtn = document.getElementById('btnExportUsers');

  onValue(usersRef, async (snapshot) => {
    allUsersCache = snapshot.val() || {};
    const adminsRef = ref(database, 'admins');
    const adminsSnap = await get(adminsRef);
    const admins = adminsSnap.val() || {};
    applyFilter(searchInput.value.trim().toLowerCase(), admins);
  });

  searchInput.addEventListener('input', async () => {
    const term = searchInput.value.trim().toLowerCase();
    const adminsRef = ref(database, 'admins');
    const adminsSnap = await get(adminsRef);
    const admins = adminsSnap.val() || {};
    applyFilter(term, admins);
  });

  exportBtn.addEventListener('click', () => {
    exportUsersToCSV(allUsersCache);
  });
}

function applyFilter(term, admins) {
  if (!allUsersCache) {
    document.getElementById('allUsersContainer').innerHTML = '<p class="empty-message">লোড হচ্ছে...</p>';
    return;
  }
  let filtered = allUsersCache;
  if (term) {
    filtered = {};
    Object.entries(allUsersCache).forEach(([uid, user]) => {
      if (String(user.enroll).toLowerCase().includes(term) || String(user.email).toLowerCase().includes(term)) {
        filtered[uid] = user;
      }
    });
  }
  renderUserTable(filtered, admins);
}

function renderUserTable(users, admins = {}) {
  const container = document.getElementById('allUsersContainer');
  container.innerHTML = '';
  if (!users || Object.keys(users).length === 0) {
    container.innerHTML = '<p class="empty-message">কোনো ইউজার পাওয়া যায়নি।</p>';
    return;
  }
  const table = document.createElement('table');
  table.className = 'approval-table';
  table.innerHTML = `
    <thead>
      <tr><th>নাম</th><th>ইমেইল</th><th>Enroll ID</th><th>Sales Line</th><th>Unit</th><th>Role</th><th>Status</th><th>Actions</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  Object.entries(users).forEach(([uid, user]) => {
    let displayRole = user.role || 'sales';
    const userEmailKey = user.email?.replace(/\./g, '_');
    if (admins && userEmailKey && admins[userEmailKey] === true) displayRole = 'admin';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.enroll}</td>
      <td>${user.salesLine || ''}</td>
      <td>${user.unitShortCode || user.unit || ''}</td>
      <td>${displayRole}</td>
      <td>${user.status}</td>
      <td>
        <button class="btn-edit-user" data-uid="${uid}" style="background:#f59e0b; color:#fff; border:none; padding:4px 10px; border-radius:4px; margin-right:4px;">Edit</button>
        <button class="btn-delete-user" data-uid="${uid}" style="background:#dc2626; color:#fff; border:none; padding:4px 10px; border-radius:4px;">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });
  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);
  attachUserActions(users);
}

function attachUserActions(users) {
  document.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const uid = e.target.getAttribute('data-uid');
      const user = users[uid];
      if (!user) return;
      openEditUserModal(uid, user);
    });
  });
  document.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('এই ইউজারকে সম্পূর্ণ মুছে ফেলতে চান?')) return;
      const uid = e.target.getAttribute('data-uid');
      try {
        await set(ref(database, 'users/' + uid), null);
        alert('ইউজার ডিলিট করা হয়েছে।');
      } catch (err) { alert('ডিলিট করতে সমস্যা: ' + err.message); }
    });
  });
}

function exportUsersToCSV(users) {
  if (!users || Object.keys(users).length === 0) {
    alert('এক্সপোর্ট করার মতো কোনো ইউজার নেই।');
    return;
  }
  const rows = [['Name', 'Email', 'Enroll ID', 'Sales Line', 'Unit', 'Role', 'Status']];
  Object.values(users).forEach(user => {
    rows.push([
      user.name || '', user.email || '', user.enroll || '',
      user.salesLine || '', user.unitShortCode || user.unit || '',
      user.role || 'sales', user.status || ''
    ]);
  });
  let csvContent = '';
  rows.forEach(row => {
    const escapedRow = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `users_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

// ========== EDIT USER MODAL ==========
let editingUserId = null;
const modal = document.getElementById('editUserModal');
const btnCloseModal = document.getElementById('btnCloseModal');
const btnSaveEdit = document.getElementById('btnSaveEditUser');

btnCloseModal.addEventListener('click', () => {
  modal.style.display = 'none';
  editingUserId = null;
});
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
    editingUserId = null;
  }
});

async function openEditUserModal(uid, userData) {
  editingUserId = uid;
  document.getElementById('editUserName').value = userData.name || '';
  document.getElementById('editUserEmail').value = userData.email || '';
  document.getElementById('editUserEnroll').value = userData.enroll || '';
  document.getElementById('editUserRole').value = userData.role || 'sales';
  document.getElementById('editUserStatus').value = userData.status || 'pending';

  const unitSelect = document.getElementById('editUserUnit');
  const lineSelect = document.getElementById('editUserSalesLine');
  const unitsRef = ref(database, 'units');
  const unitsSnap = await get(unitsRef);
  const units = unitsSnap.val() || {};

  unitSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
  Object.entries(units).forEach(([unitId, unit]) => {
    const option = document.createElement('option');
    option.value = unitId;
    option.textContent = unit.shortCode;
    if (unitId === userData.unitId) option.selected = true;
    unitSelect.appendChild(option);
  });

  const updateLines = async () => {
    const selectedUnitId = unitSelect.value;
    lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
    if (!selectedUnitId) return;
    const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
    const unitData = unitSnap.val();
    if (unitData && unitData.salesLines) {
      unitData.salesLines.forEach(line => {
        const opt = document.createElement('option');
        opt.value = line;
        opt.textContent = line;
        if (line === userData.salesLine) opt.selected = true;
        lineSelect.appendChild(opt);
      });
    }
  };
  unitSelect.addEventListener('change', updateLines);
  if (unitSelect.value) await updateLines();
  modal.style.display = 'flex';
}

btnSaveEdit.addEventListener('click', async () => {
  if (!editingUserId) return;
  const updatedData = {
    name: document.getElementById('editUserName').value.trim(),
    email: document.getElementById('editUserEmail').value.trim(),
    enroll: document.getElementById('editUserEnroll').value.trim(),
    role: document.getElementById('editUserRole').value,
    status: document.getElementById('editUserStatus').value,
    unitId: document.getElementById('editUserUnit').value,
    unitShortCode: document.getElementById('editUserUnit').selectedOptions[0]?.text || '',
    salesLine: document.getElementById('editUserSalesLine').value,
  };
  if (!updatedData.name || !updatedData.email || !updatedData.enroll) {
    alert('নাম, ইমেইল, Enroll ID ফাঁকা রাখা যাবে না।');
    return;
  }
  try {
    await update(ref(database, 'users/' + editingUserId), updatedData);
    alert('ইউজার আপডেট সফল হয়েছে।');
    modal.style.display = 'none';
    editingUserId = null;
  } catch (err) { alert('আপডেট ব্যর্থ: ' + err.message); }
});

// ========== MANAGE UNITS ==========
function loadManageUnits() {
  const container = document.getElementById('manageUnitsContainer');
  const unitsRef = ref(database, 'units');
  container.innerHTML = '<p>লোড হচ্ছে...</p>';
  onValue(unitsRef, (snapshot) => {
    const units = snapshot.val();
    container.innerHTML = '';
    const formHtml = `
      <div class="add-unit-form" style="background:#fff; padding: 20px; border-radius: 10px; margin-bottom: 25px; box-shadow: 0 2px 6px rgba(0,0,0,0.08);">
        <h3 style="margin-bottom:15px; color:#1e3c72;">নতুন ইউনিট যোগ করুন</h3>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <input type="text" id="newUnitName" placeholder="ইউনিটের পূর্ণ নাম" style="flex:1; min-width:200px; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
          <input type="text" id="newUnitCode" placeholder="শর্ট কোড (যেমন: AFBL)" style="flex:1; min-width:150px; padding:10px; border:1px solid #e2e8f0; border-radius:6px;">
          <button id="btnAddUnit" class="btn btn-primary" style="width:auto; padding: 10px 20px;">ইউনিট যুক্ত করুন</button>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', formHtml);
    if (!units) {
      container.insertAdjacentHTML('beforeend', '<p class="empty-message">এখনো কোনো ইউনিট নেই।</p>');
    } else {
      Object.entries(units).forEach(([unitId, unit]) => {
        const unitCard = document.createElement('div');
        unitCard.className = 'unit-card';
        unitCard.style.cssText = 'background:#fff; padding:20px; border-radius:10px; margin-bottom:20px; box-shadow:0 2px 6px rgba(0,0,0,0.08);';
        let salesLinesHtml = '';
        if (unit.salesLines && unit.salesLines.length > 0) {
          salesLinesHtml = '<ul style="list-style:none; padding-left:0;">';
          unit.salesLines.forEach((line, index) => {
            salesLinesHtml += `
              <li style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #f1f5f9;">
                <span style="flex:1;">${line}</span>
                <button class="btn-edit-line" data-unit-id="${unitId}" data-index="${index}" style="background:#f59e0b; color:#fff; border:none; padding:4px 10px; border-radius:4px;">Edit</button>
                <button class="btn-delete-line" data-unit-id="${unitId}" data-index="${index}" style="background:#e53e3e; color:#fff; border:none; padding:4px 10px; border-radius:4px;">Delete</button>
              </li>
            `;
          });
          salesLinesHtml += '</ul>';
        } else {
          salesLinesHtml = '<p style="color:#64748b;">কোনো সেলস লাইন নেই।</p>';
        }
        unitCard.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h3 style="margin:0; color:#1e3c72;">${unit.name} (${unit.shortCode})</h3>
            <button class="btn-delete-unit" data-unit-id="${unitId}" style="background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:6px;">Delete Unit</button>
          </div>
          <div style="margin-top:10px;">
            <strong style="color:#334155;">সেলস লাইন:</strong>
            <div style="margin-top:10px;">${salesLinesHtml}</div>
            <div class="add-line-row" style="margin-top:12px; display:flex; gap:10px;">
              <input type="text" class="input-add-line" placeholder="নতুন সেলস লাইন যোগ করুন" style="flex:1; padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
              <button class="btn-add-line" data-unit-id="${unitId}" style="background:#38a169; color:#fff; border:none; padding:8px 14px; border-radius:6px;">Add Line</button>
            </div>
          </div>
        `;
        container.appendChild(unitCard);
      });
    }
    document.getElementById('btnAddUnit').addEventListener('click', async () => {
      const name = document.getElementById('newUnitName').value.trim();
      const code = document.getElementById('newUnitCode').value.trim();
      if (!name || !code) { alert('নাম ও কোড পূরণ করুন।'); return; }
      try {
        await push(ref(database, 'units'), { name, shortCode: code, salesLines: [] });
        document.getElementById('newUnitName').value = '';
        document.getElementById('newUnitCode').value = '';
      } catch (err) { alert('ইউনিট যোগ করতে সমস্যা: ' + err.message); }
    });
    attachUnitEventListeners();
  });
}

function attachUnitEventListeners() {
  document.querySelectorAll('.btn-add-line').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const unitId = e.target.getAttribute('data-unit-id');
      const inputField = e.target.parentElement.querySelector('.input-add-line');
      const newLine = inputField.value.trim();
      if (!newLine) { alert('সেলস লাইন লিখুন।'); return; }
      try {
        const unitRef = ref(database, 'units/' + unitId);
        const snap = await get(unitRef);
        if (snap.exists()) {
          const unit = snap.val();
          const updatedLines = unit.salesLines ? [...unit.salesLines, newLine] : [newLine];
          await update(unitRef, { salesLines: updatedLines });
          inputField.value = '';
        }
      } catch (err) { alert('লাইন যোগ করতে সমস্যা: ' + err.message); }
    });
  });

  document.querySelectorAll('.btn-edit-line').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const unitId = e.target.getAttribute('data-unit-id');
      const index = parseInt(e.target.getAttribute('data-index'));
      const unitRef = ref(database, 'units/' + unitId);
      const snap = await get(unitRef);
      if (snap.exists()) {
        const unit = snap.val();
        const currentLine = unit.salesLines[index];
        const newLine = prompt('সেলস লাইন এডিট করুন:', currentLine);
        if (newLine !== null && newLine.trim() !== '') {
          try {
            const updatedLines = [...unit.salesLines];
            updatedLines[index] = newLine.trim();
            await update(unitRef, { salesLines: updatedLines });
          } catch (err) { alert('এডিট করতে সমস্যা: ' + err.message); }
        }
      }
    });
  });

  document.querySelectorAll('.btn-delete-line').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('এই সেলস লাইনটি মুছে ফেলতে চান?')) return;
      const unitId = e.target.getAttribute('data-unit-id');
      const index = parseInt(e.target.getAttribute('data-index'));
      const unitRef = ref(database, 'units/' + unitId);
      const snap = await get(unitRef);
      if (snap.exists()) {
        const unit = snap.val();
        const updatedLines = unit.salesLines.filter((_, i) => i !== index);
        try { await update(unitRef, { salesLines: updatedLines }); }
        catch (err) { alert('ডিলিট করতে সমস্যা: ' + err.message); }
      }
    });
  });

  document.querySelectorAll('.btn-delete-unit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('সম্পূর্ণ ইউনিটটি মুছে ফেলতে চান?')) return;
      const unitId = e.target.getAttribute('data-unit-id');
      try {
        await set(ref(database, 'units/' + unitId), null);
        alert('ইউনিট মুছে ফেলা হয়েছে।');
      } catch (err) { alert('মুছতে সমস্যা: ' + err.message); }
    });
  });
}

// ========== ITEM MANAGEMENT ==========
let itemFormListenersAttached = false;

async function loadItemFormUnits() {
  const unitSelect = document.getElementById('itemUnit');
  const lineSelect = document.getElementById('itemLine');
  const unitsRef = ref(database, 'units');
  unitSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
  try {
    const snapshot = await get(unitsRef);
    const units = snapshot.val();
    if (units) {
      Object.entries(units).forEach(([unitId, unit]) => {
        const option = document.createElement('option');
        option.value = unitId;
        option.textContent = unit.shortCode;
        unitSelect.appendChild(option);
      });
    }
    unitSelect.addEventListener('change', async () => {
      const selectedUnitId = unitSelect.value;
      lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
      lineSelect.disabled = true;
      if (!selectedUnitId) return;
      const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
      const unitData = unitSnap.val();
      if (unitData && unitData.salesLines) {
        unitData.salesLines.forEach(line => {
          const opt = document.createElement('option');
          opt.value = line;
          opt.textContent = line;
          lineSelect.appendChild(opt);
        });
        lineSelect.disabled = false;
      }
    });
  } catch (err) { console.error(err); }
}

function toggleTradeFields() {
  const category = document.getElementById('newTradeCategory').value;
  document.getElementById('freeFields').style.display = (category === 'free') ? 'block' : 'none';
  document.getElementById('discountFields').style.display = (category === 'discount') ? 'block' : 'none';
  calculateAffectedPrice();
}

function toggleDiscountValueField() {
  const type = document.getElementById('discountType').value;
  const container = document.getElementById('discountValueContainer');
  const label = document.getElementById('discountValueLabel');
  if (type) {
    container.style.display = 'block';
    label.textContent = type === 'percentage' ? 'শতকরা হার (%)' : 'পরিমাণ (টাকা)';
    document.getElementById('discountValue').value = '';
  } else {
    container.style.display = 'none';
  }
  calculateAffectedPrice();
}

function calculateAffectedPrice() {
  const distPrice = parseFloat(document.getElementById('newDistributorPrice').value) || 0;
  const category = document.getElementById('newTradeCategory').value;
  let affected = distPrice;
  if (category === 'free') {
    affected = distPrice;
  } else if (category === 'discount') {
    const type = document.getElementById('discountType').value;
    const val = parseFloat(document.getElementById('discountValue').value) || 0;
    if (type === 'percentage') {
      affected = distPrice - (distPrice * val / 100);
    } else if (type === 'amount') {
      affected = distPrice - val;
    }
    if (affected < 0) affected = 0;
  } else if (category === 'no_offer') {
    affected = distPrice;
  }
  document.getElementById('affectedDistributorPrice').value = affected.toFixed(2);
}

function clearItemForm() {
  document.getElementById('newItemCode').value = '';
  document.getElementById('newItemDescription').value = '';
  document.getElementById('newItemUOM').value = '';
  document.getElementById('newDistributorPrice').value = '';
  document.getElementById('newTradeCategory').value = '';
  document.getElementById('freeMainQty').value = '';
  document.getElementById('freeFreeQty').value = '';
  document.getElementById('freeItemCode').value = '';
  document.getElementById('discountType').value = '';
  document.getElementById('discountValue').value = '';
  document.getElementById('affectedDistributorPrice').value = '';
  document.getElementById('itemUnit').value = '';
  document.getElementById('itemLine').innerHTML = '<option value="">প্রথমে ইউনিট সিলেক্ট করুন</option>';
  document.getElementById('itemLine').disabled = true;
  document.getElementById('freeFields').style.display = 'none';
  document.getElementById('discountFields').style.display = 'none';
  document.getElementById('discountValueContainer').style.display = 'none';
}

document.getElementById('btnShowCreateItem').addEventListener('click', () => {
  const form = document.getElementById('createItemFormContainer');
  form.style.display = 'block';
  loadItemFormUnits();
  if (!itemFormListenersAttached) {
    document.getElementById('newTradeCategory').addEventListener('change', toggleTradeFields);
    document.getElementById('discountType').addEventListener('change', toggleDiscountValueField);
    document.getElementById('newDistributorPrice').addEventListener('input', calculateAffectedPrice);
    document.getElementById('discountValue').addEventListener('input', calculateAffectedPrice);
    itemFormListenersAttached = true;
  }
});

document.getElementById('btnCancelItem').addEventListener('click', () => {
  document.getElementById('createItemFormContainer').style.display = 'none';
  clearItemForm();
});

document.getElementById('btnSaveItem').addEventListener('click', async () => {
  const itemCode = document.getElementById('newItemCode').value.trim();
  const description = document.getElementById('newItemDescription').value.trim();
  const uom = document.getElementById('newItemUOM').value.trim();
  const distPrice = parseFloat(document.getElementById('newDistributorPrice').value);
  const tradeCategory = document.getElementById('newTradeCategory').value;
  const unitId = document.getElementById('itemUnit').value;
  const unitShortCode = document.getElementById('itemUnit').selectedOptions[0]?.text || '';
  const line = document.getElementById('itemLine').value;
  const affectedPrice = parseFloat(document.getElementById('affectedDistributorPrice').value);

  if (!itemCode || !description || !uom || isNaN(distPrice) || !tradeCategory || !unitId || !line) {
    alert('সব আবশ্যক ঘর পূরণ করুন।');
    return;
  }

  const freeDetails = tradeCategory === 'free' ? {
    mainQty: parseInt(document.getElementById('freeMainQty').value) || 0,
    freeQty: parseInt(document.getElementById('freeFreeQty').value) || 0,
    freeItemCode: document.getElementById('freeItemCode').value.trim()
  } : {};

  const discountDetails = tradeCategory === 'discount' ? {
    type: document.getElementById('discountType').value,
    value: parseFloat(document.getElementById('discountValue').value) || 0
  } : {};

  try {
    const itemsRef = ref(database, 'items');
    await push(itemsRef, {
      itemCode,
      description,
      uom,
      distributorPrice: distPrice,
      tradeCategory,
      freeDetails,
      discountDetails,
      affectedDistributorPrice: affectedPrice,
      unitId,
      unitShortCode,
      line
    });
    alert('আইটেম সংরক্ষিত হয়েছে।');
    clearItemForm();
    document.getElementById('createItemFormContainer').style.display = 'none';
  } catch (err) {
    alert('সংরক্ষণে সমস্যা: ' + err.message);
  }
});

function loadItems() {
  const container = document.getElementById('itemsTableContainer');
  const itemsRef = ref(database, 'items');
  const searchInput = document.getElementById('itemSearchInput');
  const exportBtn = document.getElementById('btnExportItems');

  onValue(itemsRef, (snapshot) => {
    allItemsCache = snapshot.val() || {};
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterItems(term);
    renderItemsTable(filtered);
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterItems(term);
    renderItemsTable(filtered);
  });

  exportBtn.addEventListener('click', () => {
    exportItemsToCSV(allItemsCache);
  });
}

function filterItems(term) {
  if (!allItemsCache) return {};
  if (!term) return allItemsCache;
  const filtered = {};
  Object.entries(allItemsCache).forEach(([id, item]) => {
    if (String(item.itemCode).toLowerCase().includes(term) || String(item.description).toLowerCase().includes(term)) {
      filtered[id] = item;
    }
  });
  return filtered;
}

function renderItemsTable(items) {
  const container = document.getElementById('itemsTableContainer');
  container.innerHTML = '';

  if (!items || Object.keys(items).length === 0) {
    container.innerHTML = '<p class="empty-message">কোনো আইটেম পাওয়া যায়নি।</p>';
    return;
  }

  // ✅ সেলস ইউজার হলে শুধু নিজের লাইনের আইটেম ফিল্টার করো
  if (currentUser.role === 'sales' && currentUser.salesLine) {
    const filteredItems = {};
    Object.entries(items).forEach(([id, item]) => {
      if (item.line === currentUser.salesLine) {
        filteredItems[id] = item;
      }
    });
    items = filteredItems;
    
    // যদি ফিল্টার করার পর কোনো আইটেম না থাকে
    if (Object.keys(items).length === 0) {
      container.innerHTML = '<p class="empty-message">আপনার লাইনে কোনো আইটেম নেই।</p>';
      return;
    }
  }

  const table = document.createElement('table');
  table.className = 'approval-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>কোড</th><th>বিবরণ</th><th>UOM</th><th>ডিস্ট্রি. প্রাইস</th>
        <th>ট্রেড ক্যাট.</th><th>অ্যাফে. প্রাইস</th><th>ইউনিট</th><th>লাইন</th><th>অ্যাকশন</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  Object.entries(items).forEach(([id, item]) => {
    const row = document.createElement('tr');
    let actionButtons = '';
    if (currentUser.role !== 'sales') {
      actionButtons = `
        <button class="btn-edit-item" data-id="${id}" style="background:#f59e0b; color:#fff; border:none; padding:4px 10px; border-radius:4px; margin-right:4px;">Edit</button>
        <button class="btn-delete-item" data-id="${id}" style="background:#dc2626; color:#fff; border:none; padding:4px 10px; border-radius:4px;">Delete</button>
      `;
    } else {
      actionButtons = '—';
    }

    row.innerHTML = `
      <td>${item.itemCode}</td>
      <td>${item.description}</td>
      <td>${item.uom}</td>
      <td>${item.distributorPrice}</td>
      <td>${item.tradeCategory}</td>
      <td>${item.affectedDistributorPrice}</td>
      <td>${item.unitShortCode || ''}</td>
      <td>${item.line}</td>
      <td>${actionButtons}</td>
    `;
    tbody.appendChild(row);
  });

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

  attachItemActions(items);
}

function attachItemActions(items) {
  document.querySelectorAll('.btn-edit-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const item = items[id];
      if (!item) return;
      openEditItemModal(id, item);
    });
  });
  document.querySelectorAll('.btn-delete-item').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('আইটেমটি মুছে ফেলতে চান?')) return;
      const id = e.target.getAttribute('data-id');
      try {
        await remove(ref(database, 'items/' + id));
        alert('আইটেম ডিলিট করা হয়েছে।');
      } catch (err) { alert('ডিলিট ব্যর্থ: ' + err.message); }
    });
  });
}

function exportItemsToCSV(items) {
  if (!items || Object.keys(items).length === 0) {
    alert('এক্সপোর্ট করার মতো কোনো আইটেম নেই।');
    return;
  }
  const rows = [['Item Code', 'Description', 'UOM', 'Distributor Price', 'Trade Category', 'Affected Price', 'Unit', 'Line']];
  Object.values(items).forEach(item => {
    rows.push([
      item.itemCode || '', item.description || '', item.uom || '',
      item.distributorPrice || '', item.tradeCategory || '',
      item.affectedDistributorPrice || '', item.unitShortCode || '', item.line || ''
    ]);
  });
  let csvContent = '';
  rows.forEach(row => {
    const escapedRow = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `items_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

// ========== EDIT ITEM MODAL ==========
const editItemModal = document.getElementById('editItemModal');
let editingItemId = null;

document.getElementById('btnCloseEditItemModal').addEventListener('click', () => {
  editItemModal.style.display = 'none';
  editingItemId = null;
});

async function openEditItemModal(id, item) {
  editingItemId = id;
  const content = document.getElementById('editItemFormContent');
  
  content.innerHTML = `
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>আইটেম কোড</label>
        <input type="text" id="editItemCode" value="${item.itemCode}">
      </div>
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>আইটেম বর্ণনা</label>
        <input type="text" id="editItemDescription" value="${item.description}">
      </div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:150px;">
        <label>UOM</label>
        <input type="text" id="editItemUOM" value="${item.uom}">
      </div>
      <div class="input-group" style="flex:1; min-width:150px;">
        <label>ডিস্ট্রিবিউটর প্রাইস</label>
        <input type="number" id="editDistributorPrice" value="${item.distributorPrice}">
      </div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>ট্রেড ক্যাটাগরি</label>
        <select id="editTradeCategory">
          <option value="free" ${item.tradeCategory==='free'?'selected':''}>Free</option>
          <option value="discount" ${item.tradeCategory==='discount'?'selected':''}>Discount</option>
          <option value="no_offer" ${item.tradeCategory==='no_offer'?'selected':''}>No Offer</option>
        </select>
      </div>
    </div>

    <div id="editFreeFields" style="display:${item.tradeCategory==='free'?'block':'none'};">
      <h4>ফ্রি অফার</h4>
      <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
        <div class="input-group" style="flex:1; min-width:150px;">
          <label>মেইন কোয়ান্টিটি</label>
          <input type="number" id="editFreeMainQty" value="${item.freeDetails?.mainQty || ''}">
        </div>
        <div class="input-group" style="flex:1; min-width:150px;">
          <label>ফ্রি কোয়ান্টিটি</label>
          <input type="number" id="editFreeFreeQty" value="${item.freeDetails?.freeQty || ''}">
        </div>
        <div class="input-group" style="flex:1; min-width:200px;">
          <label>ফ্রি আইটেম কোড</label>
          <input type="text" id="editFreeItemCode" value="${item.freeDetails?.freeItemCode || ''}">
        </div>
      </div>
    </div>

    <div id="editDiscountFields" style="display:${item.tradeCategory==='discount'?'block':'none'};">
      <h4>ডিসকাউন্ট</h4>
      <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
        <div class="input-group" style="flex:1; min-width:200px;">
          <label>ডিসকাউন্ট টাইপ</label>
          <select id="editDiscountType">
            <option value="percentage" ${item.discountDetails?.type==='percentage'?'selected':''}>Percentage</option>
            <option value="amount" ${item.discountDetails?.type==='amount'?'selected':''}>Amount</option>
          </select>
        </div>
        <div class="input-group" style="flex:1; min-width:200px;">
          <label>ভ্যালু</label>
          <input type="number" id="editDiscountValue" value="${item.discountDetails?.value || ''}">
        </div>
      </div>
    </div>

    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>অ্যাফেক্টেড প্রাইস</label>
        <input type="number" id="editAffectedPrice" value="${item.affectedDistributorPrice}" readonly>
      </div>
    </div>

    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>ইউনিট</label>
        <select id="editItemUnit">
          <option value="">লোড হচ্ছে...</option>
        </select>
      </div>
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>লাইন</label>
        <select id="editItemLine">
          <option value="">প্রথমে ইউনিট সিলেক্ট করুন</option>
        </select>
      </div>
    </div>
  `;

  const unitSelect = document.getElementById('editItemUnit');
  const lineSelect = document.getElementById('editItemLine');
  const unitsRef = ref(database, 'units');
  let units = {};
  try {
    const unitsSnap = await get(unitsRef);
    units = unitsSnap.val() || {};
  } catch (err) { console.error('ইউনিট লোড করতে ব্যর্থ:', err); }
  unitSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
  Object.entries(units).forEach(([unitId, unit]) => {
    const opt = document.createElement('option');
    opt.value = unitId;
    opt.textContent = unit.shortCode;
    if (unitId === item.unitId) opt.selected = true;
    unitSelect.appendChild(opt);
  });

  const updateEditLines = async () => {
    const selectedUnitId = unitSelect.value;
    lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
    if (!selectedUnitId) return;
    try {
      const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
      const unitData = unitSnap.val();
      if (unitData && Array.isArray(unitData.salesLines)) {
        unitData.salesLines.forEach(line => {
          const opt = document.createElement('option');
          opt.value = line;
          opt.textContent = line;
          if (line === item.line) opt.selected = true;
          lineSelect.appendChild(opt);
        });
      }
    } catch (err) { console.error('সেলস লাইন লোড করতে ব্যর্থ:', err); }
  };
  unitSelect.addEventListener('change', updateEditLines);
  try { if (unitSelect.value) await updateEditLines(); } catch (e) { console.error('updateEditLines error:', e); }

  const recalcEdit = () => {
    const distEl = document.getElementById('editDistributorPrice');
    const catEl = document.getElementById('editTradeCategory');
    const affEl = document.getElementById('editAffectedPrice');
    if (!distEl || !catEl || !affEl) return;
    const dist = parseFloat(distEl.value) || 0;
    const cat = catEl.value;
    let aff = dist;
    if (cat === 'discount') {
      const discTypeEl = document.getElementById('editDiscountType');
      const discValEl = document.getElementById('editDiscountValue');
      if (discTypeEl && discValEl) {
        const type = discTypeEl.value;
        const val = parseFloat(discValEl.value) || 0;
        aff = type === 'percentage' ? dist - (dist * val / 100) : dist - val;
        if (aff < 0) aff = 0;
      }
    }
    affEl.value = aff.toFixed(2);
  };

  const edDistPrice = document.getElementById('editDistributorPrice');
  if (edDistPrice) edDistPrice.addEventListener('input', recalcEdit);
  const edTradeCat = document.getElementById('editTradeCategory');
  if (edTradeCat) {
    edTradeCat.addEventListener('change', () => {
      const freeFields = document.getElementById('editFreeFields');
      const discFields = document.getElementById('editDiscountFields');
      if (freeFields) freeFields.style.display = edTradeCat.value === 'free' ? 'block' : 'none';
      if (discFields) discFields.style.display = edTradeCat.value === 'discount' ? 'block' : 'none';
      recalcEdit();
    });
  }
  const edDiscType = document.getElementById('editDiscountType');
  if (edDiscType) edDiscType.addEventListener('change', recalcEdit);
  const edDiscVal = document.getElementById('editDiscountValue');
  if (edDiscVal) edDiscVal.addEventListener('input', recalcEdit);

  editItemModal.style.display = 'flex';
}

document.getElementById('btnSaveEditItem').addEventListener('click', async () => {
  if (!editingItemId) return;
  const updatedItem = {
    itemCode: document.getElementById('editItemCode')?.value?.trim() || '',
    description: document.getElementById('editItemDescription')?.value?.trim() || '',
    uom: document.getElementById('editItemUOM')?.value?.trim() || '',
    distributorPrice: parseFloat(document.getElementById('editDistributorPrice')?.value) || 0,
    tradeCategory: document.getElementById('editTradeCategory')?.value || '',
    unitId: document.getElementById('editItemUnit')?.value || '',
    unitShortCode: document.getElementById('editItemUnit')?.selectedOptions?.[0]?.text || '',
    line: document.getElementById('editItemLine')?.value || '',
    affectedDistributorPrice: parseFloat(document.getElementById('editAffectedPrice')?.value) || 0,
    freeDetails: document.getElementById('editTradeCategory')?.value === 'free' ? {
      mainQty: parseInt(document.getElementById('editFreeMainQty')?.value) || 0,
      freeQty: parseInt(document.getElementById('editFreeFreeQty')?.value) || 0,
      freeItemCode: document.getElementById('editFreeItemCode')?.value?.trim() || ''
    } : {},
    discountDetails: document.getElementById('editTradeCategory')?.value === 'discount' ? {
      type: document.getElementById('editDiscountType')?.value || '',
      value: parseFloat(document.getElementById('editDiscountValue')?.value) || 0
    } : {}
  };
  if (!updatedItem.itemCode || !updatedItem.description || !updatedItem.uom || isNaN(updatedItem.distributorPrice) || !updatedItem.tradeCategory || !updatedItem.unitId || !updatedItem.line) {
    alert('সব আবশ্যক ফিল্ড পূরণ করুন।');
    return;
  }
  try {
    await update(ref(database, 'items/' + editingItemId), updatedItem);
    alert('আইটেম আপডেট সফল হয়েছে।');
    editItemModal.style.display = 'none';
    editingItemId = null;
  } catch (err) { alert('আপডেট ব্যর্থ: ' + err.message); }
});

// ========== CUSTOMER MANAGEMENT ==========
let customerFormListenersAttached = false;

async function loadCustomerFormUnits() {
  const unitSelect = document.getElementById('newCustUnit');
  const lineSelect = document.getElementById('newCustLine');
  const unitsRef = ref(database, 'units');
  unitSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
  try {
    const snapshot = await get(unitsRef);
    const units = snapshot.val();
    if (units) {
      Object.entries(units).forEach(([unitId, unit]) => {
        const option = document.createElement('option');
        option.value = unitId;
        option.textContent = unit.shortCode;
        unitSelect.appendChild(option);
      });
    }
    unitSelect.addEventListener('change', async () => {
      const selectedUnitId = unitSelect.value;
      lineSelect.innerHTML = '<option value="">প্রথমে ইউনিট সিলেক্ট করুন</option>';
      lineSelect.disabled = true;
      if (!selectedUnitId) return;
      const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
      const unitData = unitSnap.val();
      if (unitData && unitData.salesLines) {
        lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
        unitData.salesLines.forEach(line => {
          const opt = document.createElement('option');
          opt.value = line;
          opt.textContent = line;
          lineSelect.appendChild(opt);
        });
        lineSelect.disabled = false;
      }
    });
  } catch (err) { console.error(err); }
}

function handleSalespersonSearch() {
  const searchInput = document.getElementById('salespersonSearch');
  const resultsContainer = document.getElementById('salespersonSearchResults');
  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    if (!term || !allUsersCache) {
      resultsContainer.style.display = 'none';
      return;
    }
    const filtered = Object.entries(allUsersCache).filter(([uid, user]) => {
      return (user.enroll && String(user.enroll).toLowerCase().includes(term)) ||
             (user.name && user.name.toLowerCase().includes(term)) ||
             (user.email && user.email.toLowerCase().includes(term));
    });
    if (filtered.length === 0) {
      resultsContainer.innerHTML = '<div style="padding:8px;">কোনো ফলাফল নেই</div>';
      resultsContainer.style.display = 'block';
      return;
    }
    resultsContainer.innerHTML = filtered.map(([uid, user]) => {
      return `<div data-uid="${uid}" style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #e2e8f0;" class="sp-result-item">
        ${user.name} (${user.enroll}) - ${user.email}
      </div>`;
    }).join('');
    resultsContainer.style.display = 'block';
    // Add click listeners to each result
    document.querySelectorAll('.sp-result-item').forEach(item => {
      item.addEventListener('click', () => {
        const uid = item.getAttribute('data-uid');
        const user = allUsersCache[uid];
        if (user && !selectedSalespersons.some(sp => sp.uid === uid)) {
          selectedSalespersons.push({ uid, name: user.name, enroll: user.enroll });
          renderSelectedSalespersons();
          searchInput.value = '';
          resultsContainer.style.display = 'none';
        }
      });
    });
  });
  // Hide results when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#salespersonSearch') && !e.target.closest('#salespersonSearchResults')) {
      resultsContainer.style.display = 'none';
    }
  });
}

function renderSelectedSalespersons() {
  const container = document.getElementById('selectedSalespersons');
  container.innerHTML = selectedSalespersons.map((sp, index) => {
    return `<span class="salesperson-tag">
      ${sp.name} (${sp.enroll})
      <span class="remove-tag" data-index="${index}">&times;</span>
    </span>`;
  }).join('');
  // Add remove listeners
  document.querySelectorAll('.remove-tag').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      selectedSalespersons.splice(index, 1);
      renderSelectedSalespersons();
    });
  });
}

function clearCustomerForm() {
  document.getElementById('newCustCode').value = '';
  document.getElementById('newCustName').value = '';
  document.getElementById('newCustWarehouse').value = '';
  document.getElementById('newCustUnit').value = '';
  document.getElementById('newCustLine').innerHTML = '<option value="">প্রথমে ইউনিট সিলেক্ট করুন</option>';
  document.getElementById('newCustLine').disabled = true;
  document.getElementById('newCustRegion').value = '';
  document.getElementById('newCustArea').value = '';
  document.getElementById('newCustPoint').value = '';
  document.getElementById('newCustStatus').value = 'active';
  selectedSalespersons = [];
  renderSelectedSalespersons();
  document.getElementById('salespersonSearch').value = '';
  document.getElementById('salespersonSearchResults').style.display = 'none';
}

document.getElementById('btnShowCreateCustomer').addEventListener('click', () => {
  const form = document.getElementById('createCustomerFormContainer');
  form.style.display = 'block';
  loadCustomerFormUnits();
  // handleSalespersonSearch() আর কল করতে হবে না, কারণ সেটা switchSubView-এ হয়েছে
});

document.getElementById('btnCancelCustomer').addEventListener('click', () => {
  document.getElementById('createCustomerFormContainer').style.display = 'none';
  clearCustomerForm();
});

document.getElementById('btnSaveCustomer').addEventListener('click', async () => {
  const custCode = document.getElementById('newCustCode').value.trim();
  const custName = document.getElementById('newCustName').value.trim();
  const warehouse = document.getElementById('newCustWarehouse').value.trim();
  const unitId = document.getElementById('newCustUnit').value;
  const unitShortCode = document.getElementById('newCustUnit').selectedOptions[0]?.text || '';
  const line = document.getElementById('newCustLine').value;
  const region = document.getElementById('newCustRegion').value.trim();
  const area = document.getElementById('newCustArea').value.trim();
  const point = document.getElementById('newCustPoint').value.trim();
  const status = document.getElementById('newCustStatus').value;
  const salespersons = selectedSalespersons.map(sp => sp.uid);

  if (!custCode || !custName || !warehouse || !unitId || !line || !region || !area) {
    alert('সব আবশ্যক ঘর পূরণ করুন।');
    return;
  }

  // Check duplicate customer code
  if (allCustomersCache) {
    const exists = Object.values(allCustomersCache).some(cust => cust.custCode === custCode);
    if (exists) {
      alert('এই কাস্টমার কোড ইতিমধ্যে আছে।');
      return;
    }
  }

  try {
    const customersRef = ref(database, 'customers');
    await push(customersRef, {
      custCode,
      custName,
      warehouse,
      unitId,
      unitShortCode,
      line,
      region,
      area,
      point: point || '',
      status,
      salespersons,
      createdBy: currentUser.uid,
      createdAt: new Date().toISOString()
    });
    alert('কাস্টমার সংরক্ষিত হয়েছে।');
    clearCustomerForm();
    document.getElementById('createCustomerFormContainer').style.display = 'none';
  } catch (err) {
    alert('সংরক্ষণে সমস্যা: ' + err.message);
  }
});

function loadCustomers() {
  const container = document.getElementById('customersTableContainer');
  const customersRef = ref(database, 'customers');
  const searchInput = document.getElementById('customerSearchInput');
  const exportBtn = document.getElementById('btnExportCustomers');

  onValue(customersRef, (snapshot) => {
    allCustomersCache = snapshot.val() || {};
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterCustomers(term);
    renderCustomersTable(filtered);
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterCustomers(term);
    renderCustomersTable(filtered);
  });

  exportBtn.addEventListener('click', () => {
    exportCustomersToCSV(allCustomersCache);
  });
}

function filterCustomers(term) {
  if (!allCustomersCache) return {};
  if (!term) return allCustomersCache;
  const filtered = {};
  Object.entries(allCustomersCache).forEach(([id, cust]) => {
    if (String(cust.custCode).toLowerCase().includes(term) || String(cust.custName).toLowerCase().includes(term)) {
      filtered[id] = cust;
    }
  });
  return filtered;
}

function renderCustomersTable(customers) {
  const container = document.getElementById('customersTableContainer');
  container.innerHTML = '';

  if (!customers || Object.keys(customers).length === 0) {
    container.innerHTML = '<p class="empty-message">কোনো কাস্টমার পাওয়া যায়নি।</p>';
    return;
  }

  // Filter by access: sales only see assigned customers
  let visibleCustomers = customers;
  if (currentUser.role === 'sales') {
    visibleCustomers = {};
    Object.entries(customers).forEach(([id, cust]) => {
      if (cust.salespersons && cust.salespersons.includes(currentUser.uid)) {
        visibleCustomers[id] = cust;
      }
    });
  }

  const table = document.createElement('table');
  table.className = 'approval-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>কোড</th><th>নাম</th><th>গুদাম</th><th>ইউনিট</th><th>লাইন</th>
        <th>অঞ্চল</th><th>এলাকা</th><th>পয়েন্ট</th><th>স্ট্যাটাস</th><th>অ্যাকশন</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  Object.entries(visibleCustomers).forEach(([id, cust]) => {
    const row = document.createElement('tr');
    let actionButtons = '';
    if (currentUser.role !== 'sales') {
      actionButtons = `
        <button class="btn-edit-customer" data-id="${id}" style="background:#f59e0b; color:#fff; border:none; padding:4px 10px; border-radius:4px; margin-right:4px;">Edit</button>
        <button class="btn-delete-customer" data-id="${id}" style="background:#dc2626; color:#fff; border:none; padding:4px 10px; border-radius:4px;">Delete</button>
      `;
    } else {
      actionButtons = '—';
    }
    row.innerHTML = `
      <td>${cust.custCode}</td>
      <td>${cust.custName}</td>
      <td>${cust.warehouse}</td>
      <td>${cust.unitShortCode || ''}</td>
      <td>${cust.line}</td>
      <td>${cust.region}</td>
      <td>${cust.area}</td>
      <td>${cust.point || ''}</td>
      <td>${cust.status}</td>
      <td>${actionButtons}</td>
    `;
    tbody.appendChild(row);
  });

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);

  attachCustomerActions(customers);
}

function attachCustomerActions(customers) {
  document.querySelectorAll('.btn-edit-customer').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const cust = customers[id];
      if (!cust) return;
      openEditCustomerModal(id, cust);
    });
  });
  document.querySelectorAll('.btn-delete-customer').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('কাস্টমারটি মুছে ফেলতে চান?')) return;
      const id = e.target.getAttribute('data-id');
      try {
        await remove(ref(database, 'customers/' + id));
        alert('কাস্টমার ডিলিট করা হয়েছে।');
      } catch (err) { alert('ডিলিট ব্যর্থ: ' + err.message); }
    });
  });
}

function exportCustomersToCSV(customers) {
  if (!customers || Object.keys(customers).length === 0) {
    alert('এক্সপোর্ট করার মতো কোনো কাস্টমার নেই।');
    return;
  }
  const rows = [['Code', 'Name', 'Warehouse', 'Unit', 'Line', 'Region', 'Area', 'Point', 'Status']];
  Object.values(customers).forEach(cust => {
    rows.push([
      cust.custCode || '', cust.custName || '', cust.warehouse || '',
      cust.unitShortCode || '', cust.line || '', cust.region || '',
      cust.area || '', cust.point || '', cust.status || ''
    ]);
  });
  let csvContent = '';
  rows.forEach(row => {
    const escapedRow = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `customers_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}

// ========== EDIT CUSTOMER MODAL ==========
const editCustomerModal = document.getElementById('editCustomerModal');
let editingCustomerId = null;

document.getElementById('btnCloseEditCustomerModal').addEventListener('click', () => {
  editCustomerModal.style.display = 'none';
  editingCustomerId = null;
});

async function openEditCustomerModal(id, cust) {
  editingCustomerId = id;
  const content = document.getElementById('editCustomerFormContent');
  
  content.innerHTML = `
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;"><label>কোড</label><input type="text" id="editCustCode" value="${cust.custCode}"></div>
      <div class="input-group" style="flex:1; min-width:200px;"><label>নাম</label><input type="text" id="editCustName" value="${cust.custName}"></div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;"><label>গুদাম</label><input type="text" id="editCustWarehouse" value="${cust.warehouse}"></div>
      <div class="input-group" style="flex:1; min-width:200px;"><label>ইউনিট</label><select id="editCustUnit"><option value="">লোড...</option></select></div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;"><label>লাইন</label><select id="editCustLine"><option value="">প্রথমে ইউনিট সিলেক্ট করুন</option></select></div>
      <div class="input-group" style="flex:1; min-width:200px;"><label>অঞ্চল</label><input type="text" id="editCustRegion" value="${cust.region}"></div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;"><label>এলাকা</label><input type="text" id="editCustArea" value="${cust.area}"></div>
      <div class="input-group" style="flex:1; min-width:200px;"><label>পয়েন্ট</label><input type="text" id="editCustPoint" value="${cust.point || ''}"></div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>সেলস পারসন</label>
        <div id="editSalespersonsContainer"></div>
      </div>
    </div>
    <div class="form-row" style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:15px;">
      <div class="input-group" style="flex:1; min-width:200px;">
        <label>স্ট্যাটাস</label>
        <select id="editCustStatus">
          <option value="active" ${cust.status==='active'?'selected':''}>Active</option>
          <option value="inactive" ${cust.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
    </div>
  `;

  // Load unit dropdown for edit
  const unitSelect = document.getElementById('editCustUnit');
  const lineSelect = document.getElementById('editCustLine');
  const unitsRef = ref(database, 'units');
  const unitsSnap = await get(unitsRef);
  const units = unitsSnap.val() || {};
  unitSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
  Object.entries(units).forEach(([unitId, unit]) => {
    const opt = document.createElement('option');
    opt.value = unitId;
    opt.textContent = unit.shortCode;
    if (unitId === cust.unitId) opt.selected = true;
    unitSelect.appendChild(opt);
  });
  const updateLines = async () => {
    const selectedUnitId = unitSelect.value;
    lineSelect.innerHTML = '<option value="">সিলেক্ট করুন</option>';
    if (!selectedUnitId) return;
    const unitSnap = await get(ref(database, 'units/' + selectedUnitId));
    const unitData = unitSnap.val();
    if (unitData && unitData.salesLines) {
      unitData.salesLines.forEach(line => {
        const opt = document.createElement('option');
        opt.value = line;
        opt.textContent = line;
        if (line === cust.line) opt.selected = true;
        lineSelect.appendChild(opt);
      });
    }
  };
  unitSelect.addEventListener('change', updateLines);
  if (unitSelect.value) await updateLines();

  // Salespersons display (readonly for simplicity; could add search later)
  const spContainer = document.getElementById('editSalespersonsContainer');
  const spUids = cust.salespersons || [];
  let spHtml = '';
  spUids.forEach(uid => {
    const user = allUsersCache[uid];
    if (user) {
      spHtml += `<span class="salesperson-tag">${user.name} (${user.enroll})</span> `;
    }
  });
  spContainer.innerHTML = spHtml || 'কোনো সেলস পারসন নেই';

  editCustomerModal.style.display = 'flex';
}

document.getElementById('btnSaveEditCustomer').addEventListener('click', async () => {
  if (!editingCustomerId) return;
  const updatedCust = {
    custCode: document.getElementById('editCustCode')?.value?.trim() || '',
    custName: document.getElementById('editCustName')?.value?.trim() || '',
    warehouse: document.getElementById('editCustWarehouse')?.value?.trim() || '',
    unitId: document.getElementById('editCustUnit')?.value || '',
    unitShortCode: document.getElementById('editCustUnit')?.selectedOptions?.[0]?.text || '',
    line: document.getElementById('editCustLine')?.value || '',
    region: document.getElementById('editCustRegion')?.value?.trim() || '',
    area: document.getElementById('editCustArea')?.value?.trim() || '',
    point: document.getElementById('editCustPoint')?.value?.trim() || '',
    status: document.getElementById('editCustStatus')?.value || 'active',
    // salespersons remain unchanged in this simple edit; could be extended
  };
  if (!updatedCust.custCode || !updatedCust.custName || !updatedCust.warehouse || !updatedCust.unitId || !updatedCust.line || !updatedCust.region || !updatedCust.area) {
    alert('সব আবশ্যক ফিল্ড পূরণ করুন।');
    return;
  }
  try {
    await update(ref(database, 'customers/' + editingCustomerId), updatedCust);
    alert('কাস্টমার আপডেট সফল হয়েছে।');
    editCustomerModal.style.display = 'none';
    editingCustomerId = null;
  } catch (err) { alert('আপডেট ব্যর্থ: ' + err.message); }
});

// ========== ORDER FORM ==========
document.getElementById('btnLoadCustomer').addEventListener('click', async () => {
  const code = document.getElementById('orderCustomerCode').value.trim();
  if (!code) return;
  let customer = null;
  if (allCustomersCache) {
    customer = Object.values(allCustomersCache).find(c => c.custCode === code);
  }
  if (!customer) {
    alert('কাস্টমার পাওয়া যায়নি।');
    return;
  }
  // Role-based access for sales
  if (currentUser.role === 'sales') {
    const isAssigned = customer.salespersons && customer.salespersons.includes(currentUser.uid);
    if (!isAssigned) {
      alert('আপনি এই কাস্টমারকে অ্যাক্সেস করতে পারবেন না।');
      return;
    }
  }
  document.getElementById('custName').textContent = customer.custName;
  document.getElementById('custWarehouse').textContent = customer.warehouse;
  document.getElementById('custRegion').textContent = customer.region;
  document.getElementById('custArea').textContent = customer.area;
  document.getElementById('custUnit').textContent = customer.unitShortCode || '';
  document.getElementById('custLine').textContent = customer.line;
  document.getElementById('customerInfo').style.display = 'block';
  window.selectedCustomer = customer; // store for order submission
});

document.getElementById('btnSearchItem').addEventListener('click', () => {
  const searchTerm = document.getElementById('orderItemSearch').value.trim().toLowerCase();
  if (!searchTerm || !allItemsCache) return;
  const item = Object.values(allItemsCache).find(it => 
    String(it.itemCode).toLowerCase() === searchTerm ||
    (it.description && it.description.toLowerCase().includes(searchTerm))
  );
  if (!item) {
    alert('আইটেম পাওয়া যায়নি।');
    return;
  }
  document.getElementById('itemDesc').textContent = item.description;
  document.getElementById('itemPrice').textContent = item.affectedDistributorPrice || item.distributorPrice;
  document.getElementById('itemDetails').style.display = 'block';
  window.selectedItem = item;
});

function renderDraftTable() {
  const tbody = document.querySelector('#draftOrderTable tbody');
  tbody.innerHTML = '';
  let total = 0;
  draftItems.forEach((item, index) => {
    const itemTotal = item.quantity * item.price;
    total += itemTotal;
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.itemCode}</td>
      <td>${item.description}</td>
      <td><input type="number" value="${item.quantity}" min="1" class="draft-qty" data-index="${index}" style="width:80px;"></td>
      <td>${item.price}</td>
      <td>${itemTotal.toFixed(2)}</td>
      <td><button class="btn-delete-draft" data-index="${index}" style="background:#dc2626; color:#fff; border:none; padding:4px 10px; border-radius:4px;">বাদ দিন</button></td>
    `;
    tbody.appendChild(row);
  });
  document.getElementById('draftTotal').textContent = total.toFixed(2);

  // Add event listeners for quantity change
  document.querySelectorAll('.draft-qty').forEach(input => {
    input.addEventListener('input', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      const newQty = parseInt(e.target.value) || 1;
      draftItems[index].quantity = newQty;
      renderDraftTable();
    });
  });
  document.querySelectorAll('.btn-delete-draft').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      draftItems.splice(index, 1);
      renderDraftTable();
    });
  });
}

document.getElementById('btnAddToDraft').addEventListener('click', () => {
  if (!window.selectedItem) {
    alert('প্রথমে একটি আইটেম খুঁজুন।');
    return;
  }
  const quantity = parseInt(document.getElementById('itemQuantity').value) || 1;
  const item = window.selectedItem;
  const existing = draftItems.find(di => di.itemCode === item.itemCode);
  if (existing) {
    existing.quantity += quantity;
  } else {
    draftItems.push({
      itemCode: item.itemCode,
      description: item.description,
      price: parseFloat(item.affectedDistributorPrice || item.distributorPrice),
      quantity: quantity,
    });
  }
  renderDraftTable();
  document.getElementById('itemQuantity').value = 1;
});

document.getElementById('btnSubmitOrder').addEventListener('click', async () => {
  if (!window.selectedCustomer) {
    alert('কাস্টমার লোড করা হয়নি।');
    return;
  }
  if (draftItems.length === 0) {
    alert('ড্রাফট অর্ডার খালি।');
    return;
  }
  const orderData = {
    customerCode: window.selectedCustomer.custCode,
    customerName: window.selectedCustomer.custName,
    warehouse: window.selectedCustomer.warehouse,
    region: window.selectedCustomer.region,
    area: window.selectedCustomer.area,
    unit: window.selectedCustomer.unitShortCode || '',
    line: window.selectedCustomer.line,
    items: draftItems,
    total: draftItems.reduce((sum, di) => sum + di.quantity * di.price, 0),
    createdBy: currentUser.uid,
    createdByName: currentUser.name,
    createdAt: new Date().toISOString()
  };
  try {
    const ordersRef = ref(database, 'orders');
    await push(ordersRef, orderData);
    alert('অর্ডার সাবমিট হয়েছে।');
    draftItems = [];
    renderDraftTable();
    window.selectedCustomer = null;
    window.selectedItem = null;
    document.getElementById('customerInfo').style.display = 'none';
    document.getElementById('itemDetails').style.display = 'none';
    document.getElementById('orderCustomerCode').value = '';
    document.getElementById('orderItemSearch').value = '';
  } catch (err) {
    alert('অর্ডার সাবমিট ব্যর্থ: ' + err.message);
  }
});

// ========== MY ORDERS ==========
function loadMyOrders() {
  const container = document.getElementById('myOrdersContainer');
  const ordersRef = ref(database, 'orders');
  const searchInput = document.getElementById('orderSearchInput');
  const exportBtn = document.getElementById('btnExportOrders');

  onValue(ordersRef, (snapshot) => {
    allOrdersCache = snapshot.val() || {};
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterOrders(term);
    renderOrdersTable(filtered);
  });

  searchInput.addEventListener('input', () => {
    const term = searchInput.value.trim().toLowerCase();
    const filtered = filterOrders(term);
    renderOrdersTable(filtered);
  });

  exportBtn.addEventListener('click', () => {
    exportOrdersToCSV(allOrdersCache);
  });
}

function filterOrders(term) {
  let visible = allOrdersCache;
  // Role-based: sales see only own orders
  if (currentUser.role === 'sales') {
    visible = {};
    Object.entries(allOrdersCache).forEach(([id, order]) => {
      if (order.createdBy === currentUser.uid) {
        visible[id] = order;
      }
    });
  }
  if (!term) return visible;
  const filtered = {};
  Object.entries(visible).forEach(([id, order]) => {
    if (String(order.customerCode).toLowerCase().includes(term) || String(id).toLowerCase().includes(term)) {
      filtered[id] = order;
    }
  });
  return filtered;
}

function renderOrdersTable(orders) {
  const container = document.getElementById('myOrdersContainer');
  container.innerHTML = '';

  if (!orders || Object.keys(orders).length === 0) {
    container.innerHTML = '<p class="empty-message">কোনো অর্ডার পাওয়া যায়নি।</p>';
    return;
  }

  const table = document.createElement('table');
  table.className = 'approval-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>অর্ডার আইডি</th><th>কাস্টমার কোড</th><th>কাস্টমার</th><th>মোট</th><th>তারিখ</th><th>ক্রেতা</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  Object.entries(orders).forEach(([id, order]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${id}</td>
      <td>${order.customerCode}</td>
      <td>${order.customerName}</td>
      <td>${order.total?.toFixed(2)}</td>
      <td>${new Date(order.createdAt).toLocaleDateString('bn-BD')}</td>
      <td>${order.createdByName || ''}</td>
    `;
    tbody.appendChild(row);
  });

  const tableWrapper = document.createElement('div');
  tableWrapper.className = 'table-responsive';
  tableWrapper.appendChild(table);
  container.appendChild(tableWrapper);
}

function exportOrdersToCSV(orders) {
  if (!orders || Object.keys(orders).length === 0) {
    alert('এক্সপোর্ট করার মতো কোনো অর্ডার নেই।');
    return;
  }
  const rows = [['Order ID', 'Customer Code', 'Customer Name', 'Total', 'Date', 'Created By']];
  Object.entries(orders).forEach(([id, order]) => {
    rows.push([
      id, order.customerCode || '', order.customerName || '',
      order.total || '', new Date(order.createdAt).toLocaleDateString('bn-BD'),
      order.createdByName || ''
    ]);
  });
  let csvContent = '';
  rows.forEach(row => {
    const escapedRow = row.map(cell => `"${String(cell).replace(/"/g, '""')}"`);
    csvContent += escapedRow.join(',') + '\n';
  });
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `orders_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
}