import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, off, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let allUsersCache = {}; // ক্যাশে রাখব যাতে সার্চ ও এক্সপোর্ট সহজ হয়

// Current logged-in user data
let currentUser = {
  uid: null,
  email: null,
  name: null,
  role: 'user', // 'admin', 'manager', or 'sales'
  status: null
};

// View switching for auth phases
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

  if (view === registerView) {
    loadUnitDropdowns();  // ইউনিট ড্রপডাউন লোড করো
  }
}

// ইউনিট ড্রপডাউন পপুলেট করার ফাংশন
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
        option.value = unitId;  // আমরা unitId রাখব, shortCode দেখাব
        option.textContent = unit.shortCode;
        unitSelect.appendChild(option);
      });
    } else {
      unitSelect.innerHTML = '<option value="" disabled>কোনো ইউনিট নেই</option>';
    }

    // ইউনিট সিলেক্টের ইভেন্ট লিসেনার (সেলস লাইন পপুলেট)
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

// Google Apps Script URL (OTP sender)
const appsScriptURL = "https://script.google.com/macros/s/AKfycby4WFu5qoOuYFfiFFC1oDuHFQR2aVMZj4mBdBLQR_m6mxEOv31Gss5zfph1GcJuLeS65g/exec";

// Button loading helper
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

// স্ট্রং পাসওয়ার্ড চেক
function isPasswordStrong(password) {
  const strongRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{8,}$/;
  return strongRegex.test(password);
}

// Enroll ID ডুপ্লিকেট চেক
async function isEnrollDuplicate(enroll) {
  const usersRef = ref(database, 'users');
  const snapshot = await get(usersRef);
  if (snapshot.exists()) {
    const users = snapshot.val();
    return Object.values(users).some(user => user.enroll === enroll);
  }
  return false;
}

// নাম ভ্যালিডেশন (শুধু ইংরেজি অক্ষর ও স্পেস)
function isValidName(name) {
  const nameRegex = /^[A-Za-z\s]+$/;
  return nameRegex.test(name);
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
      };
      
      toggleLoading('btnLogin', false, defaultHtml);
      showMainApp();
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// ---------- REGISTRATION (SEND OTP) ----------
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
  if (!/^\d+$/.test(enroll)) {
    alert('Enroll ID শুধুমাত্র সংখ্যা হতে হবে।');
    return;
  }
  if (!isValidName(name)) {
    alert('নাম শুধুমাত্র ইংরেজি অক্ষর ও স্পেস হতে পারে।');
    return;
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    alert('সঠিক ইমেইল ফরম্যাট প্রদান করুন।');
    return;
  }
  if (!isPasswordStrong(password)) {
    alert('পাসওয়ার্ডে অন্তত ৮ অক্ষর, একটি বড় হাতের, একটি ছোট হাতের, একটি সংখ্যা ও একটি বিশেষ চিহ্ন (যেমন !@#$%) থাকতে হবে।');
    return;
  }
  const duplicate = await isEnrollDuplicate(enroll);
  if (duplicate) {
    alert('এই Enroll ID ইতিমধ্যে নিবন্ধিত।');
    return;
  }

  tempRegistrationData = { enroll, name, email, unitId, unitShortCode, salesLine, role, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  
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

// ---------- MAIN APP LOGIC ----------
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
}

function switchSubView(viewId) {
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId + '-view');
  if (target) target.classList.add('active');

  if (viewId === 'manageUnits') {
    loadManageUnits();
  } else if (viewId === 'userApprovals') {
    loadUserManagement();
  }
}

// ========== USER MANAGEMENT ==========
function loadUserManagement() {
  const container = document.getElementById('allUsersContainer');
  const usersRef = ref(database, 'users');
  
  onValue(usersRef, (snapshot) => {
    allUsersCache = snapshot.val() || {};
    renderUserTable(allUsersCache);
  });

  document.getElementById('userSearchInput').addEventListener('input', (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (!allUsersCache) return;
    const filtered = {};
    Object.entries(allUsersCache).forEach(([uid, user]) => {
      if (String(user.enroll).toLowerCase().includes(term) || String(user.email).toLowerCase().includes(term)) {
        filtered[uid] = user;
      }
    });
    renderUserTable(filtered);
  });

  document.getElementById('btnExportUsers').addEventListener('click', () => {
    exportUsersToCSV(allUsersCache);
  });
}

function renderUserTable(users) {
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
      <tr>
        <th>নাম</th>
        <th>ইমেইল</th>
        <th>Enroll ID</th>
        <th>Sales Line</th>
        <th>Unit</th>
        <th>Role</th>
        <th>Status</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  Object.entries(users).forEach(([uid, user]) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.email}</td>
      <td>${user.enroll}</td>
      <td>${user.salesLine || ''}</td>
      <td>${user.unitShortCode || user.unit || ''}</td>
      <td>${user.role || 'sales'}</td>
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
      if (!confirm('এই ইউজারকে সম্পূর্ণ মুছে ফেলতে চান? এটি পরবর্তীতে আর ফেরত আনা যাবে না।')) return;
      const uid = e.target.getAttribute('data-uid');
      try {
        await set(ref(database, 'users/' + uid), null);
        alert('ইউজার ডিলিট করা হয়েছে।');
      } catch (err) {
        alert('ডিলিট করতে সমস্যা: ' + err.message);
      }
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
      user.name || '',
      user.email || '',
      user.enroll || '',
      user.salesLine || '',
      user.unitShortCode || user.unit || '',
      user.role || 'sales',
      user.status || ''
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
  } catch (err) {
    alert('আপডেট ব্যর্থ: ' + err.message);
  }
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
                <button class="btn-edit-line" data-unit-id="${unitId}" data-index="${index}" style="background:#f59e0b; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Edit</button>
                <button class="btn-delete-line" data-unit-id="${unitId}" data-index="${index}" style="background:#e53e3e; color:#fff; border:none; padding:4px 10px; border-radius:4px; cursor:pointer;">Delete</button>
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
            <button class="btn-delete-unit" data-unit-id="${unitId}" style="background:#dc2626; color:#fff; border:none; padding:6px 14px; border-radius:6px; cursor:pointer;">Delete Unit</button>
          </div>
          <div style="margin-top:10px;">
            <strong style="color:#334155;">সেলস লাইন:</strong>
            <div style="margin-top:10px;">
              ${salesLinesHtml}
            </div>
            <div class="add-line-row" style="margin-top:12px; display:flex; gap:10px;">
              <input type="text" class="input-add-line" placeholder="নতুন সেলস লাইন যোগ করুন" style="flex:1; padding:8px; border:1px solid #e2e8f0; border-radius:6px;">
              <button class="btn-add-line" data-unit-id="${unitId}" style="background:#38a169; color:#fff; border:none; padding:8px 14px; border-radius:6px; cursor:pointer;">Add Line</button>
            </div>
          </div>
        `;

        container.appendChild(unitCard);
      });
    }

    document.getElementById('btnAddUnit').addEventListener('click', async () => {
      const name = document.getElementById('newUnitName').value.trim();
      const code = document.getElementById('newUnitCode').value.trim();
      if (!name || !code) {
        alert('নাম ও কোড পূরণ করুন।');
        return;
      }
      try {
        const newUnitRef = ref(database, 'units');
        await push(newUnitRef, {
          name: name,
          shortCode: code,
          salesLines: []
        });
        document.getElementById('newUnitName').value = '';
        document.getElementById('newUnitCode').value = '';
      } catch (err) {
        alert('ইউনিট যোগ করতে সমস্যা: ' + err.message);
      }
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
      if (!newLine) {
        alert('সেলস লাইন লিখুন।');
        return;
      }
      try {
        const unitRef = ref(database, 'units/' + unitId);
        const snap = await get(unitRef);
        if (snap.exists()) {
          const unit = snap.val();
          const updatedLines = unit.salesLines ? [...unit.salesLines, newLine] : [newLine];
          await update(unitRef, { salesLines: updatedLines });
          inputField.value = '';
        }
      } catch (err) {
        alert('লাইন যোগ করতে সমস্যা: ' + err.message);
      }
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
          } catch (err) {
            alert('এডিট করতে সমস্যা: ' + err.message);
          }
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
        try {
          await update(unitRef, { salesLines: updatedLines });
        } catch (err) {
          alert('ডিলিট করতে সমস্যা: ' + err.message);
        }
      }
    });
  });

  document.querySelectorAll('.btn-delete-unit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (!confirm('সম্পূর্ণ ইউনিটটি মুছে ফেলতে চান? এর সমস্ত সেলস লাইনও চলে যাবে।')) return;
      const unitId = e.target.getAttribute('data-unit-id');
      try {
        await set(ref(database, 'units/' + unitId), null);
        alert('ইউনিট মুছে ফেলা হয়েছে।');
      } catch (err) {
        alert('মুছতে সমস্যা: ' + err.message);
      }
    });
  });
}