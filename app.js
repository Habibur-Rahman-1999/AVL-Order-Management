import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set, get, update, onValue, off } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Current logged-in user data
let currentUser = {
  uid: null,
  email: null,
  name: null,
  role: 'user', // 'admin' or 'user'
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
}

// Google Apps Script URL (OTP sender)
const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

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
      // Fetch user record from Realtime Database
      const userRef = ref(database, 'users/' + user.uid);
      const snap = await get(userRef);
      if (!snap.exists()) {
        // If no record, maybe admin but not in users node? We'll check admins list.
        // But we still need a record; we can create one if admin doesn't exist.
        // For safety, let's sign out and show error.
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট ডাটাবেইজে পাওয়া যায়নি। প্রশাসকের সাথে যোগাযোগ করুন।');
        return;
      }
      const userData = snap.val();
      
      // Check approval status
      if (userData.status !== 'approved') {
        await signOut(auth);
        toggleLoading('btnLogin', false, defaultHtml);
        alert('আপনার অ্যাকাউন্ট এখনো অনুমোদিত হয়নি। অ্যাডমিনের অনুমোদন প্রয়োজন।');
        return;
      }
      
      // Determine role: if email exists in admins node, assign 'admin', else role from userData (should be 'user')
      const adminsRef = ref(database, 'admins');
      const adminsSnap = await get(adminsRef);
      const admins = adminsSnap.val() || {};
      const isAdmin = Object.keys(admins).some(key => admins[key] === true && key === email.replace(/\./g, '_'));
      
      currentUser = {
        uid: user.uid,
        email: user.email,
        name: userData.name,
        role: isAdmin ? 'admin' : 'user',
        status: userData.status
      };
      
      toggleLoading('btnLogin', false, defaultHtml);
      // Switch to main application
      showMainApp();
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// ---------- REGISTRATION (SEND OTP) ----------
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
  
  // Create Firebase Auth user
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
    .then(async (userCredential) => {
      const uid = userCredential.user.uid;
      // Save user data with status 'pending'
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
      
      // Sign out the newly created user (they must be approved first)
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
  // Hide all auth views
  document.querySelectorAll('.auth-view').forEach(v => v.classList.remove('active'));
  mainAppView.style.display = 'flex';  // because it's flex container
  mainAppView.classList.add('active');
  
  // Set logged-in user name
  document.getElementById('loggedUserName').textContent = currentUser.name;
  
  // Show admin menu if admin
  if (currentUser.role === 'admin') {
    document.getElementById('adminApprovalsMenu').style.display = 'block';
  } else {
    document.getElementById('adminApprovalsMenu').style.display = 'none';
  }
  
  // Activate default dashboard view
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  document.getElementById('dashboard-view').classList.add('active');
  
  // Navigation click handlers
  const navLinks = document.querySelectorAll('.nav-menu li a[data-view]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = link.getAttribute('data-view');
      switchSubView(viewId);
      // Update active class
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
    // Clear currentUser
    currentUser = { uid: null, email: null, name: null, role: 'user', status: null };
  });
  
  // Password update (Reset Password inside app)
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
  
  // If admin, load pending users
  if (currentUser.role === 'admin') {
    loadPendingUsers();
  }
}

function switchSubView(viewId) {
  document.querySelectorAll('.sub-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId + '-view');
  if (target) target.classList.add('active');
}

// ---------- ADMIN: LOAD PENDING USERS ----------
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
    table.className = 'approval-table';
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
    
    // Attach event listeners for approve/reject
    container.querySelectorAll('.btn-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.target.getAttribute('data-uid');
        if (confirm('এই ইউজারকে অনুমোদন করতে চান?')) {
          await update(ref(database, 'users/' + uid), { status: 'approved' });
          alert('ইউজার অনুমোদিত হয়েছে।');
        }
      });
    });
    
    container.querySelectorAll('.btn-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.target.getAttribute('data-uid');
        if (confirm('এই ইউজারকে বাতিল করতে চান? (ইমেইলটি পুনরায় ব্যবহার করা যাবে না)')) {
          await update(ref(database, 'users/' + uid), { status: 'rejected' });
          alert('ইউজার বাতিল করা হয়েছে।');
        }
      });
    });
  });
}