import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
let resetOTP = null;
let resetTargetEmail = "";
let tempRegistrationData = {};

const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const otpView = document.getElementById('otp-view');
const resetOtpView = document.getElementById('reset-otp-view');
const newPasswordView = document.getElementById('new-password-view');

document.getElementById('goToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('goToLogin').addEventListener('click', () => switchView(loginView));
document.getElementById('backToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('backToLoginFromReset').addEventListener('click', () => switchView(loginView));

function switchView(targetView) {
  [loginView, registerView, otpView, resetOtpView, newPasswordView].forEach(view => view.classList.remove('active'));
  targetView.classList.add('active');
}

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

const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

// ---------- LOGIN ----------
document.getElementById('btnLogin').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const defaultHtml = `<i class="fas fa-right-to-bracket"></i> লগইন`;
  if(!email || !password) { alert('দয়া করে আপনার লগইন আইডি এবং পাসওয়ার্ড প্রদান করুন।'); return; }
  toggleLoading('btnLogin', true, defaultHtml);
  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন সফল হয়েছে!');
    })
    .catch(err => {
      toggleLoading('btnLogin', false, defaultHtml);
      alert('লগইন ব্যর্থ: ' + err.message);
    });
});

// ---------- FORGOT PASSWORD (SEND OTP) – mode: "cors" ----------
document.getElementById('btnForgotPassword').addEventListener('click', () => {
  const email = document.getElementById('loginEmail').value.trim();
  const defaultHtml = `<i class="fas fa-key"></i> পাসওয়ার্ড ভুলে গেছেন?`;
  if(!email) { alert('পাসওয়ার্ড রিসেট করতে প্রথমে ইমেইল দিন।'); return; }
  toggleLoading('btnForgotPassword', true, defaultHtml);
  resetTargetEmail = email;
  resetOTP = Math.floor(100000 + Math.random() * 900000).toString();

  fetch(appsScriptURL, {
    method: "POST",
    mode: "cors",                     // ✅ CORS মোডে ফেরত
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_email: resetTargetEmail,
      otp_code: resetOTP,
      type: "PASSWORD_RESET"
    })
  })
  .then(response => response.json())
  .then(data => {
    toggleLoading('btnForgotPassword', false, defaultHtml);
    if (data.status === "success") {
      document.getElementById('reset-otp-message').innerText = `${resetTargetEmail} ঠিকানায় পাসওয়ার্ড রিসেট কোড পাঠানো হয়েছে।`;
      switchView(resetOtpView);
    } else {
      alert('ওটিপি পাঠাতে ব্যর্থ: ' + (data.message || 'অজানা ত্রুটি'));
    }
  })
  .catch(err => {
    toggleLoading('btnForgotPassword', false, defaultHtml);
    alert('ওটিপি পাঠাতে সমস্যা হয়েছে।');
    console.error(err);
  });
});

// ---------- VERIFY RESET OTP ----------
document.getElementById('btnVerifyResetOtp').addEventListener('click', () => {
  const enteredOtp = document.getElementById('resetOtpInput').value.trim();
  const defaultHtml = `<i class="fas fa-unlock-keyhole"></i> কোড যাচাই করুন`;
  if(enteredOtp !== resetOTP) { alert('ভুল ওটিপি কোড!'); return; }
  toggleLoading('btnVerifyResetOtp', true, defaultHtml);
  setTimeout(() => {
    toggleLoading('btnVerifyResetOtp', false, defaultHtml);
    document.getElementById('resetOtpInput').value = "";
    switchView(newPasswordView);
  }, 800);
});

// ---------- SAVE NEW PASSWORD (mode: "cors" + response.json()) ----------
document.getElementById('btnSaveNewPassword').addEventListener('click', () => {
  const newPassword = document.getElementById('newPasswordInput').value;
  const confirmPassword = document.getElementById('confirmPasswordInput').value;
  const defaultHtml = `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড সংরক্ষণ করুন`;

  if(!newPassword || !confirmPassword) { alert('দয়া করে দুটি ঘরই পূরণ করুন।'); return; }
  if(newPassword.length < 6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।'); return; }
  if(newPassword !== confirmPassword) { alert('পাসওয়ার্ড দুটি মেলেনি!'); return; }

  toggleLoading('btnSaveNewPassword', true, defaultHtml);

  fetch(appsScriptURL, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
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
    if (data.status === "success") {
      alert('পাসওয়ার্ড সফলভাবে রিসেট হয়েছে! এখন নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
      document.getElementById('newPasswordInput').value = "";
      document.getElementById('confirmPasswordInput').value = "";
      resetOTP = null;
      resetTargetEmail = "";
      switchView(loginView);
    } else {
      alert('পাসওয়ার্ড আপডেট ব্যর্থ: ' + (data.message || 'অজানা ত্রুটি'));
    }
  })
  .catch(err => {
    toggleLoading('btnSaveNewPassword', false, defaultHtml);
    alert('সার্ভারে যোগাযোগে সমস্যা হয়েছে। বিস্তারিত: ' + err.message);
    console.error(err);
  });
});

// ---------- SEND REGISTRATION OTP (mode: "cors") ----------
document.getElementById('btnSendOTP').addEventListener('click', () => {
  const enroll = document.getElementById('regEnroll').value.trim();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const salesLine = document.getElementById('regSalesLine').value;
  const unit = document.getElementById('regUnit').value;
  const password = document.getElementById('regPassword').value;
  const defaultHtml = `<i class="fas fa-paper-plane"></i> ওটিপি কোড পাঠান`;
  if(!enroll || !name || !email || !salesLine || !unit || !password) { alert('সব ঘর পূরণ করুন।'); return; }
  if(password.length < 6) { alert('পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।'); return; }
  tempRegistrationData = { enroll, name, email, salesLine, unit, password };
  generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
  toggleLoading('btnSendOTP', true, defaultHtml);
  fetch(appsScriptURL, {
    method: "POST",
    mode: "cors",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to_email: email, to_name: name, otp_code: generatedOTP, type: "REGISTRATION" })
  })
  .then(response => response.json())
  .then(data => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    if (data.status === "success") {
      document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি কোডটি পাঠানো হয়েছে।`;
      switchView(otpView);
    } else {
      alert('ওটিপি পাঠাতে ব্যর্থ: ' + (data.message || 'অজানা ত্রুটি'));
    }
  })
  .catch(err => {
    toggleLoading('btnSendOTP', false, defaultHtml);
    alert("মেইল পাঠাতে সমস্যা হয়েছে।");
    console.error(err);
  });
});

// ---------- VERIFY OTP AND SIGNUP ----------
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
  const userOTP = document.getElementById('otpInput').value.trim();
  const defaultHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও অ্যাকাউন্ট তৈরি`;
  if(userOTP !== generatedOTP) { alert('ভুল ওটিপি কোড!'); return; }
  toggleLoading('btnVerifyOTP', true, defaultHtml);
  createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
    .then(userCredential => {
      const uid = userCredential.user.uid;
      set(ref(database, 'users/' + uid), {
        enroll: tempRegistrationData.enroll,
        name: tempRegistrationData.name,
        email: tempRegistrationData.email,
        salesLine: tempRegistrationData.salesLine,
        unit: tempRegistrationData.unit,
        createdAt: new Date().toISOString()
      }).then(() => {
        toggleLoading('btnVerifyOTP', false, defaultHtml);
        alert('অভিনন্দন! আপনার অ্যাকাউন্টটি সফলভাবে রেজিস্টার্ড হয়েছে।');
        document.getElementById('otpInput').value = "";
        switchView(loginView);
      }).catch(dbErr => {
        toggleLoading('btnVerifyOTP', false, defaultHtml);
        alert('ডাটাবেজে তথ্য সংরক্ষণে ত্রুটি: ' + dbErr.message);
      });
    })
    .catch(authErr => {
      toggleLoading('btnVerifyOTP', false, defaultHtml);
      alert('অথেন্টিকেশন ব্যর্থ: ' + authErr.message);
    });
});