import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

console.log("[SYSTEM] Initializing Firebase Configuration...");
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
console.log("[SYSTEM] Firebase Modules Ready.");

let generatedOTP = null;
let resetOTP = null;
let resetTargetEmail = "";
let tempRegistrationData = {};

// UI Views
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const otpView = document.getElementById('otp-view');
const resetOtpView = document.getElementById('reset-otp-view');
const newPasswordView = document.getElementById('new-password-view');

// ⚠️ আপনার গুগল অ্যাপস স্ক্রিপ্টের New Deployment URL টি এখানে ডাবল কোটেশনের ভেতরে বসান
const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

// View Router Helper
function switchView(targetView) {
  console.log("[ROUTER] Navigating view to ID: " + targetView.id);
  [loginView, registerView, otpView, resetOtpView, newPasswordView].forEach(view => view.classList.remove('active'));
  targetView.classList.add('active');
}

// Event Listeners for Nav
document.getElementById('goToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('goToLogin').addEventListener('click', () => switchView(loginView));
document.getElementById('backToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('backToLoginFromReset').addEventListener('click', () => switchView(loginView));

function toggleLoading(buttonId, isProcessing, defaultHtml) {
  const btn = document.getElementById(buttonId);
  if (isProcessing) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং হচ্ছে...`;
  } else {
    btn.disabled = false;
    btn.innerHTML = defaultHtml;
  }
}

// =========================================================================
// INTERACTION A: USER LOGIN
// =========================================================================
document.getElementById('btnLogin').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const defaultHtml = `<i class="fas fa-right-to-bracket"></i> লগইন`;
  
  console.log("[LOGIN] Attempting Client Login for: " + email);
  if(!email || !password) { alert('দয়া করে আপনার লগইন আইডি এবং পাসওয়ার্ড প্রদান করুন।'); return; }
  
  toggleLoading('btnLogin', true, defaultHtml);
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      toggleLoading('btnLogin', false, defaultHtml);
      console.log("[LOGIN SUCCESS] Logged in UID: " + userCredential.user.uid);
      alert('লগইন সফল হয়েছে!');
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      console.error("[LOGIN ERROR] Failed authentication:", err);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// =========================================================================
// INTERACTION B: FORGOT PASSWORD (TRIGGER ENGINE & SEND OTP)
// =========================================================================
document.getElementById('btnForgotPassword').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const defaultHtml = `<i class="fas fa-key"></i> পাসওয়ার্ড ভুলে গেছেন?`;
  
  console.log("[FORGOT PASS] Reset flow initiated for email: " + email);
  if(!email) { alert('পাসওয়ার্ড রিসেট করতে প্রথমে ইমেইল দিন।'); return; }
  
  toggleLoading('btnForgotPassword', true, defaultHtml);
  resetTargetEmail = email;
  resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("[FORGOT PASS] Generated Random Reset OTP Token: " + resetOTP);

  console.log("[FORGOT PASS] Dispatching API Call to Apps Script (no-cors mode)...");
  fetch(appsScriptURL, {
    method: "POST",
    mode: "no-cors", 
    body: JSON.stringify({
      to_email: resetTargetEmail,
      otp_code: resetOTP,
      type: "PASSWORD_RESET"
    })
  })
  .then(() => {
    console.log("[FORGOT PASS API] Fetch request successfully finalized.");
    toggleLoading('btnForgotPassword', false, defaultHtml);
    document.getElementById('reset-otp-message').innerText = `${resetTargetEmail} ঠিকানায় পাসওয়ার্ড রিসেট কোড পাঠানো হয়েছে।`;
    switchView(resetOtpView);
  })
  .catch(err => {
    toggleLoading('btnForgotPassword', false, defaultHtml);
    console.error("[FORGOT PASS API ERROR] Pipeline failed:", err);
    alert('ওটিপি পাঠাতে সমস্যা হয়েছে।');
  });
});

// =========================================================================
// INTERACTION C: VERIFY RESET OTP (LOCAL CLIENT VAL)
// =========================================================================
document.getElementById('btnVerifyResetOtp').addEventListener('click', () => {
  const enteredOtp = document.getElementById('resetOtpInput').value.trim();
  const defaultHtml = `<i class="fas fa-unlock-keyhole"></i> কোড যাচাই করুন`;
  
  console.log("[RESET OTP VERIFY] User submitted code: " + enteredOtp + " | Expected: " + resetOTP);
  if(enteredOtp !== resetOTP) { 
    console.warn("[RESET OTP VERIFY] Verification mismatch.");
    alert('ভুল ওটিপি কোড!'); 
    return; 
  }
  
  toggleLoading('btnVerifyResetOtp', true, defaultHtml);
  setTimeout(() => {
    toggleLoading('btnVerifyResetOtp', false, defaultHtml);
    console.log("[RESET OTP VERIFY] Local check passed. Opening new password view.");
    document.getElementById('resetOtpInput').value = "";
    switchView(newPasswordView);
  }, 800);
});

// =========================================================================
// INTERACTION D: COMMIT NEW PASSWORD TO FIREBASE VIA API REQEUST
// =========================================================================
document.getElementById('btnSaveNewPassword').addEventListener('click', () => {
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;
  const defaultHtml = `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড সংরক্ষণ করুন`;

  console.log("[SAVE NEW PASS] Validating data parameters...");
  if(!newPassword || !confirmPassword) { alert('দয়া করে দুটি ঘরই পূরণ করুন।'); return; }
  if(newPassword.length < 6) { alert('পাসওয়ার্ড নূন্যতম ۶ অক্ষরের হতে হবে।'); return; }
  if(newPassword !== confirmPassword) { alert('পাসওয়ার্ড দুটি মেলেনি!'); return; }

  toggleLoading('btnSaveNewPassword', true, defaultHtml);
  console.log("[SAVE NEW PASS] Committing secure POST to Backend API Endpoint...");

  fetch(appsScriptURL, {
    method: "POST",
    body: JSON.stringify({
      action: "PASSWORD_RESET_CONFIRM",
      email: resetTargetEmail,
      otp: resetOTP,
      new_password: newPassword
    })
  })
  .then(response => response.json())
  .then(data => {
    toggleLoading('btnSaveNewPassword', false, defaultHtml);
    console.log("[SAVE NEW PASS API] Parsing result status:", data);
    if (data.status === "success") {
      alert('পাসওয়ার্ড সফলভাবে রিসেট হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      document.getElementById('newPasswordInput').value = "";
      document.getElementById('confirmPasswordInput').value = "";
      resetOTP = null;
      resetTargetEmail = "";
      switchView(loginView);
    } else {
      console.warn("[SAVE NEW PASS API ERROR] Server rejected request: " + data.message);
      alert('পাসওয়ার্ড আপডেট ব্যর্থ: ' + (data.message || 'অজানা ত্রুটি'));
    }
  })
  .catch(err => {
    toggleLoading('btnSaveNewPassword', false, defaultHtml);
    console.error("[SAVE NEW PASS CRITICAL ERROR] Pipeline aborted:", err);
    alert('সার্ভারে যোগাযোগে সমস্যা হয়েছে। বিস্তারিত ব্রাউজার কনসোলে দেখুন।');
  });
});

// =========================================================================
// INTERACTION E: SEND REGISTRATION OTP
// =========================================================================
document.getElementById('btnSendOTP').addEventListener('click', () => {
  const enroll = document.getElementById('regEnroll').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const salesLine = document.getElementById('regSalesLine').value;
  const unit = document.getElementById('regUnit').value;
  const password = document.getElementById('regPassword').value;
  const defaultHtml = `<i class="fas fa-paper-plane"></i> ওটিপি কোড পাঠান`;
  
  console.log("[REGISTRATION] Validating register input variables...");
  if(!enroll || !name || !email || !salesLine || !unit || !password) { alert('সব ঘর পূরণ করুন।'); return; }
  if(password.length < 6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।'); return; }
  
  tempRegistrationData = { enroll, name, email, salesLine, unit, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  console.log("[REGISTRATION] Generated Registration Token: " + generatedOTP);
  
  toggleLoading('btnSendOTP', true, defaultHtml);
  console.log("[REGISTRATION API] Dispatched fetch pipeline to engine (no-cors mode)...");
  
  fetch(appsScriptURL, {
    method: "POST",
    mode: "no-cors",
    body: JSON.stringify({ to_email: email, to_name: name, otp_code: generatedOTP, type: "REGISTRATION" })
  })
  .then(() => {
    console.log("[REGISTRATION API] Fetch stream terminated cleanly.");
    toggleLoading('btnSendOTP', false, defaultHtml);
    document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি কোডটি পাঠানো হয়েছে।`;
    switchView(otpView);
  })
  .catch(err => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    console.error("[REGISTRATION API ERROR] Engine failure:", err);
    alert("মেইল পাঠাতে সমস্যা হয়েছে।");
  });
});

// =========================================================================
// INTERACTION F: VERIFY REGISTRATION OTP AND ACCOUNT CREATION
// =========================================================================
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
  const userOTP = document.getElementById('otpInput').value.trim();
  const defaultHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও অ্যাকাউন্ট তৈরি`;
  
  console.log("[REG OTP VERIFY] Submitted OTP Code: " + userOTP + " | Expected: " + generatedOTP);
  if(userOTP !== generatedOTP) { 
    console.warn("[REG OTP VERIFY] Invalid OTP token code block triggered.");
    alert('ভুল ওটিপি কোড!'); 
    return; 
  }
  
  toggleLoading('btnVerifyOTP', true, defaultHtml);
  console.log("[REG AUTH] Initializing Firebase Auth Account Node Creation...");
  
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
    .then(userCredential => {
      const uid = userCredential.user.uid;
      console.log("[REG AUTH SUCCESS] Created Auth Record. Assigned UID: " + uid);
      console.log("[REG DB] Binding user meta payload records into Realtime Database...");
      
      set(ref(database, 'users/' + uid), {
        enroll: tempRegistrationData.enroll,
        name: tempRegistrationData.name,
        email: tempRegistrationData.email,
        salesLine: tempRegistrationData.salesLine,
        unit: tempRegistrationData.unit,
        createdAt: new Date().toISOString()
      }).then(() => {
        toggleLoading('btnVerifyOTP', false, defaultHtml);
        console.log("[REG DB SUCCESS] Meta indexing successfully completed.");
        alert('অভিনন্দন! আপনার অ্যাকাউন্টটি সফলভাবে রেজিস্টার্ড হয়েছে।');
        document.getElementById('otpInput').value = "";
        tempRegistrationData = {};
        generatedOTP = null;
        switchView(loginView);
      }).catch(dbErr => {
        toggleLoading('btnVerifyOTP', false, defaultHtml);
        console.error("[REG DB CRITICAL ERROR] Data indexing failed:", dbErr);
        alert('ডাটাবেজে তথ্য সংরক্ষণে ত্রুটি: ' + dbErr.message);
      });
    })
    .catch(authErr => {
      toggleLoading('btnVerifyOTP', false, defaultHtml);
      console.error("[REG AUTH ERROR] Auth payload generation rejected:", authErr);
      alert('অথেন্টিকেশন ব্যর্থ: ' + authErr.message);
    });
});