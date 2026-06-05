import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getDatabase, ref, set } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Firebase Config Properties
const firebaseConfig = {
  apiKey: "AIzaSyBRNwi-pA8OSq7__Rn4Hg5X_280W9AexH0",
  authDomain: "avl-order-management.firebaseapp.com",
  databaseURL: "https://avl-order-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "avl-order-management",
  storageBucket: "avl-order-management.firebasestorage.app",
  messagingSenderId: "825754454601",
  appId: "1:825754454601:web:360c6c265f1f6b11b50d98"
};

// Initialize Core Framework components
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

// Global state controller for temporary operations
let generatedOTP = null;
let resetOTP = null;
let resetTargetEmail = "";
let tempRegistrationData = {};

// View Elements Dom References
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const otpView = document.getElementById('otp-view');
const resetOtpView = document.getElementById('reset-otp-view');
const newPasswordView = document.getElementById('new-password-view');

// Dynamic Navigation Controls
document.getElementById('goToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('goToLogin').addEventListener('click', () => switchView(loginView));
document.getElementById('backToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('backToLoginFromReset').addEventListener('click', () => switchView(loginView));

function switchView(targetView) {
    [loginView, registerView, otpView, resetOtpView, newPasswordView].forEach(view => view.classList.remove('active'));
    targetView.classList.add('active');
}

// Global Loading Animation Toggle Handler Component
function toggleLoading(buttonId, isProcessing, defaultHtml) {
    const targetButton = document.getElementById(buttonId);
    if (isProcessing) {
        targetButton.disabled = true;
        targetButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং হচ্ছে...`;
    } else {
        targetButton.disabled = false;
        targetButton.innerHTML = defaultHtml;
    }
}

// আপনার লাইভ গুগল অ্যাপস স্ক্রিপ্ট ওয়েব অ্যাপ ইউআরএল
const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

// ---------------- LOGIN LOGIC ----------------
document.getElementById('btnLogin').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const defaultBtnHtml = `<i class="fas fa-right-to-bracket"></i> লগইন`;
    
    if(!email || !password) {
        alert('দয়া করে আপনার লগইন আইডি এবং পাসওয়ার্ড প্রদান করুন।');
        return;
    }
    
    toggleLoading('btnLogin', true, defaultBtnHtml);
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            toggleLoading('btnLogin', false, defaultBtnHtml);
            alert('লগইন সফল হয়েছে!');
            console.log("Session Verified:", userCredential.user.uid);
        })
        .catch(err => {
            toggleLoading('btnLogin', false, defaultBtnHtml);
            alert('লগইন ব্যর্থ: ' + err.message);
        });
});

// ---------------- CUSTOM PASSWORD RESET ROUTE (SEND OTP VIA APPSCRIPT) ----------------
document.getElementById('btnForgotPassword').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const defaultBtnHtml = `<i class="fas fa-key"></i> পাসওয়ার্ড ভুলে গেছেন?`;

    if(!email) {
        alert('পাসওয়ার্ড রিসেট করতে প্রথমে "ইউজার আইডি / ইমেইল" এর ঘরে আপনার অফিশিয়াল ইমেইলটি লিখুন।');
        return;
    }

    toggleLoading('btnForgotPassword', true, defaultBtnHtml);
    resetTargetEmail = email;

    // পাসওয়ার্ড রিসেটের ওটিপি জেনারেট করা
    resetOTP = Math.floor(100000 + Math.random() * 900000).toString();

    // অ্যাপস্ক্রিপ্ট এ ওটিপি রিকোয়েস্ট পাঠানো
    fetch(appsScriptURL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            to_email: resetTargetEmail,
            otp_code: resetOTP,
            type: "PASSWORD_RESET" // এখানে মেইল ফিল্টারিং হ্যান্ডেল হবে
        })
    })
    .then(() => {
        toggleLoading('btnForgotPassword', false, defaultBtnHtml);
        document.getElementById('reset-otp-message').innerText = `${resetTargetEmail} ঠিকানায় পাসওয়ার্ড রিসেট কোড পাঠানো হয়েছে।`;
        switchView(resetOtpView);
    })
    .catch((error) => {
        toggleLoading('btnForgotPassword', false, defaultBtnHtml);
        alert("গুগল স্ক্রিপ্টের মাধ্যমে রিসেট ওটিপি পাঠাতে সমস্যা হয়েছে।");
        console.error(error);
    });
});

// ---------------- VERIFY RESET OTP LOGIC ----------------
document.getElementById('btnVerifyResetOtp').addEventListener('click', () => {
    const enteredOtp = document.getElementById('resetOtpInput').value.trim();
    const defaultBtnHtml = `<i class="fas fa-unlock-keyhole"></i> কোড যাচাই করুন`;

    if(enteredOtp !== resetOTP) {
        alert('ভুল ওটিপি কোড! দয়া করে সঠিক কোডটি পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnVerifyResetOtp', true, defaultBtnHtml);
    setTimeout(() => {
        toggleLoading('btnVerifyResetOtp', false, defaultBtnHtml);
        alert('ওটিপি কোড সফলভাবে ভেরিফাইড হয়েছে! এখন নতুন পাসওয়ার্ড সেট করুন।');
        document.getElementById('resetOtpInput').value = "";
        switchView(newPasswordView);
    }, 800);
});

// ---------------- SAVE NEW PASSWORD LOGIC ----------------
document.getElementById('btnSaveNewPassword').addEventListener('click', () => {
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    const defaultBtnHtml = `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড সংরক্ষণ করুন`;

    if(!newPassword || !confirmPassword) {
        alert('দয়া করে দুটি ঘরই পূরণ করুন।');
        return;
    }
    if(newPassword.length < 6) {
        alert('নিরাপত্তার স্বার্থে পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }
    if(newPassword !== confirmPassword) {
        alert('পাসওয়ার্ড দুটি মেলেনি! পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnSaveNewPassword', true, defaultBtnHtml);

    // ফায়ারবেস রিয়েল-টাইম ডাটাবেজে পাসওয়ার্ড সিঙ্ক নোড আপডেট করা
    const emailKey = resetTargetEmail.replace(/[.#$\[\]]/g, "_");
    
    set(ref(database, 'password_resets/' + emailKey), {
        email: resetTargetEmail,
        updatedPassword: newPassword,
        updatedAt: new Date().toISOString()
    })
    .then(() => {
        toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
        alert('আপনার নতুন পাসওয়ার্ডটি সফলভাবে সিস্টেমে সংরক্ষিত হয়েছে। অনুগ্রহ করে নতুন পাসওয়ার্ড দিয়ে লগইন করুন!');
        document.getElementById('newPasswordInput').value = "";
        document.getElementById('confirmPasswordInput').value = "";
        switchView(loginView);
    })
    .catch(err => {
        toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
        alert('পাসওয়ার্ড সংরক্ষণে সমস্যা হয়েছে: ' + err.message);
    });
});

// ---------------- SEND REGISTRATION OTP LOGIC ----------------
document.getElementById('btnSendOTP').addEventListener('click', () => {
    const enroll = document.getElementById('regEnroll').value.trim();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const salesLine = document.getElementById('regSalesLine').value;
    const unit = document.getElementById('regUnit').value;
    const password = document.getElementById('regPassword').value;
    const defaultBtnHtml = `<i class="fas fa-paper-plane"></i> ওটিপি কোড পাঠান`;

    if(!enroll || !name || !email || !salesLine || !unit || !password) {
        alert('ফর্মের প্রতিটি ঘর সঠিক তথ্য দিয়ে পূরণ করুন।');
        return;
    }
    if(password.length < 6) {
        alert('নিরাপত্তার স্বার্থে পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }

    tempRegistrationData = { enroll, name, email, salesLine, unit, password };
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    toggleLoading('btnSendOTP', true, defaultBtnHtml);

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
        toggleLoading('btnSendOTP', false, defaultBtnHtml);
        document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি কোডটি পাঠানো হয়েছে।`;
        switchView(otpView);
    })
    .catch((error) => {
        toggleLoading('btnSendOTP', false, defaultBtnHtml);
        alert("গুগল স্ক্রিপ্টের মাধ্যমে মেইল পাঠাতে সমস্যা হয়েছে।");
        console.error(error);
    });
});

// ---------------- VERIFY OTP AND SIGNUP LOGIC ----------------
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
    const userOTP = document.getElementById('otpInput').value.trim();
    const defaultBtnHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও অ্যাকাউন্ট তৈরি`;

    if(userOTP !== generatedOTP) {
        alert('ভুল ওটিপি কোড! দয়া করে সঠিক কোডটি পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnVerifyOTP', true, defaultBtnHtml);

    createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;

            set(ref(database, 'users/' + uid), {
                enroll: tempRegistrationData.enroll,
                name: tempRegistrationData.name,
                email: tempRegistrationData.email,
                salesLine: tempRegistrationData.salesLine,
                unit: tempRegistrationData.unit,
                createdAt: new Date().toISOString()
            }).then(() => {
                toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
                alert('অভিনন্দন! আপনার অ্যাকাউন্টটি সফলভাবে ভেরিফাইড এবং রেজিস্টার্ড হয়েছে।');
                document.getElementById('otpInput').value = "";
                switchView(loginView);
            }).catch(dbErr => {
                toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
                alert('ডাটাবেজে তথ্য সংরক্ষণে ত্রুটি: ' + dbErr.message);
            });
        })
        .catch((authErr) => {
            toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
            alert('অথেন্টিকেশন প্রসেস ব্যর্থ হয়েছে: ' + authErr.message);
        });
});