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

// Global state controller for temporary registration session data
let generatedOTP = null;
let tempRegistrationData = {};

// View Elements Dom References
const loginView = document.getElementById('login-view');
const registerView = document.getElementById('register-view');
const otpView = document.getElementById('otp-view');

// Dynamic Navigation Controls
document.getElementById('goToRegister').addEventListener('click', () => switchView(registerView));
document.getElementById('goToLogin').addEventListener('click', () => switchView(loginView));
document.getElementById('backToRegister').addEventListener('click', () => switchView(registerView));

function switchView(targetView) {
    [loginView, registerView, otpView].forEach(view => view.classList.remove('active'));
    targetView.classList.add('active');
}

// ---------------- LOGIN LOGIC ----------------
document.getElementById('btnLogin').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if(!email || !password) {
        alert('দয়া করে আপনার লগইন আইডি এবং পাসওয়ার্ড প্রদান করুন।');
        return;
    }
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert('লগইন সফল হয়েছে!');
            console.log("Session Verified:", userCredential.user.uid);
        })
        .catch(err => alert('লগইন ব্যর্থ: ' + err.message));
});

// ---------------- SEND OTP LOGIC ----------------
document.getElementById('btnSendOTP').addEventListener('click', () => {
    const enroll = document.getElementById('regEnroll').value.trim();
    const name = document.getElementById('regName').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const salesLine = document.getElementById('regSalesLine').value;
    const unit = document.getElementById('regUnit').value;
    const password = document.getElementById('regPassword').value;

    // Direct Validation Check Filters
    if(!enroll || !name || !email || !salesLine || !unit || !password) {
        alert('ফর্মের প্রতিটি ঘর সঠিক তথ্য দিয়ে পূরণ করুন।');
        return;
    }
    if(password.length < 6) {
        alert('নিরাপত্তার স্বার্থে পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }

    // Capture state values inside object memory
    tempRegistrationData = { enroll, name, email, salesLine, unit, password };

    // Generate secure 6-digit verification sequence
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();

    document.getElementById('otp-message').innerText = `${email} ঠিকানায় কোড পাঠানো হচ্ছে...`;
    switchView(otpView);

    // আপনার দেওয়া লাইভ গুগল অ্যাপস স্ক্রিপ্ট ওয়েব অ্যাপ ইউআরএল
    const appsScriptURL = "https://script.google.com/macros/s/AKfycbwGKhmUhDeuk_8T7SJZd0IigF1auDOxSHwek60udvjG-iZVNESpS1eonTwmTbQFiUhgsw/exec";

    // Safe & Secure API Forwarder Call
    fetch(appsScriptURL, {
        method: "POST",
        mode: "no-cors", 
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            to_email: email,
            to_name: name,
            otp_code: generatedOTP
        })
    })
    .then(() => {
        document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি কোডটি পাঠানো হয়েছে।`;
    })
    .catch((error) => {
        alert("গুগল স্ক্রিপ্টের মাধ্যমে মেইল পাঠাতে সমস্যা হয়েছে।");
        console.error(error);
    });
});

// ---------------- VERIFY OTP AND SIGNUP LOGIC ----------------
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
    const userOTP = document.getElementById('otpInput').value.trim();

    if(userOTP !== generatedOTP) {
        alert('ভুল ওটিপি কোড! দয়া করে সঠিক কোডটি পুনরায় চেক করুন।');
        return;
    }

    // OTP matched perfectly! Processing account deployment inside Firebase Engine
    createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;

            // Target node route inside Realtime Database matching UID reference block
            set(ref(database, 'users/' + uid), {
                enroll: tempRegistrationData.enroll,
                name: tempRegistrationData.name,
                email: tempRegistrationData.email,
                salesLine: tempRegistrationData.salesLine,
                unit: tempRegistrationData.unit,
                createdAt: new Date().toISOString()
            }).then(() => {
                alert('অভিনন্দন! আপনার অ্যাকাউন্টটি সফলভাবে ভেরিফাইড এবং রেজিস্টার্ড হয়েছে।');
                document.getElementById('otpInput').value = "";
                switchView(loginView);
            }).catch(dbErr => {
                alert('ডাটাবেজে তথ্য সংরক্ষণে ত্রুটি: ' + dbErr.message);
            });
        })
        .catch((authErr) => {
            alert('অথেন্টিকেশন প্রসেস ব্যর্থ হয়েছে: ' + authErr.message);
        });
});