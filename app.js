import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updatePassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
console.log("Firebase initialized successfully");

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
document.getElementById('goToRegister').addEventListener('click', () => {
  console.log("Navigating to Register view");
  switchView(registerView);
});
document.getElementById('goToLogin').addEventListener('click', () => {
  console.log("Navigating to Login view");
  switchView(loginView);
});
document.getElementById('backToRegister').addEventListener('click', () => {
  console.log("Back to Register view from OTP");
  switchView(registerView);
});
document.getElementById('backToLoginFromReset').addEventListener('click', () => {
  console.log("Back to Login from Reset OTP");
  switchView(loginView);
});

function switchView(targetView) {
    console.log("Switching to view:", targetView.id);
    [loginView, registerView, otpView, resetOtpView, newPasswordView].forEach(view => view.classList.remove('active'));
    targetView.classList.add('active');
}

// Global Loading Animation Toggle Handler Component
function toggleLoading(buttonId, isProcessing, defaultHtml) {
    const targetButton = document.getElementById(buttonId);
    if (isProcessing) {
        console.log(`Loading started on button ${buttonId}`);
        targetButton.disabled = true;
        targetButton.innerHTML = `<i class="fas fa-spinner fa-spin"></i> প্রসেসিং হচ্ছে...`;
    } else {
        console.log(`Loading ended on button ${buttonId}`);
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
    
    console.log("Login attempt for email:", email);
    if(!email || !password) {
        console.warn("Login validation failed: missing email or password");
        alert('দয়া করে আপনার লগইন আইডি এবং পাসওয়ার্ড প্রদান করুন।');
        return;
    }
    
    toggleLoading('btnLogin', true, defaultBtnHtml);
    
    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            console.log("Login successful, UID:", userCredential.user.uid);
            toggleLoading('btnLogin', false, defaultBtnHtml);
            alert('লগইন সফল হয়েছে!');
            // You can redirect or update UI here
        })
        .catch(err => {
            console.error("Login error:", err);
            toggleLoading('btnLogin', false, defaultBtnHtml);
            alert('লগইন ব্যর্থ: ' + err.message);
        });
});

// ---------------- CUSTOM PASSWORD RESET ROUTE (SEND OTP VIA APPSCRIPT) ----------------
document.getElementById('btnForgotPassword').addEventListener('click', () => {
    const email = document.getElementById('loginEmail').value.trim();
    const defaultBtnHtml = `<i class="fas fa-key"></i> পাসওয়ার্ড ভুলে গেছেন?`;

    console.log("Forgot password initiated for:", email);
    if(!email) {
        console.warn("No email provided for password reset");
        alert('পাসওয়ার্ড রিসেট করতে প্রথমে "ইউজার আইডি / ইমেইল" এর ঘরে আপনার অফিশিয়াল ইমেইলটি লিখুন।');
        return;
    }

    toggleLoading('btnForgotPassword', true, defaultBtnHtml);
    resetTargetEmail = email;

    // পাসওয়ার্ড রিসেটের ওটিপি জেনারেট করা
    resetOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated reset OTP:", resetOTP);

    // অ্যাপস্ক্রিপ্ট এ ওটিপি রিকোয়েস্ট পাঠানো
    fetch(appsScriptURL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            to_email: resetTargetEmail,
            otp_code: resetOTP,
            type: "PASSWORD_RESET"
        })
    })
    .then(() => {
        console.log("Reset OTP request sent to Apps Script");
        toggleLoading('btnForgotPassword', false, defaultBtnHtml);
        document.getElementById('reset-otp-message').innerText = `${resetTargetEmail} ঠিকানায় পাসওয়ার্ড রিসেট কোড পাঠানো হয়েছে।`;
        switchView(resetOtpView);
    })
    .catch((error) => {
        console.error("Error sending reset OTP:", error);
        toggleLoading('btnForgotPassword', false, defaultBtnHtml);
        alert("গুগল স্ক্রিপ্টের মাধ্যমে রিসেট ওটিপি পাঠাতে সমস্যা হয়েছে।");
    });
});

// ---------------- VERIFY RESET OTP LOGIC ----------------
document.getElementById('btnVerifyResetOtp').addEventListener('click', () => {
    const enteredOtp = document.getElementById('resetOtpInput').value.trim();
    const defaultBtnHtml = `<i class="fas fa-unlock-keyhole"></i> কোড যাচাই করুন`;
    console.log("Verifying reset OTP:", enteredOtp, "Expected:", resetOTP);

    if(enteredOtp !== resetOTP) {
        console.warn("OTP mismatch");
        alert('ভুল ওটিপি কোড! দয়া করে সঠিক কোডটি পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnVerifyResetOtp', true, defaultBtnHtml);
    setTimeout(() => {
        console.log("Reset OTP verified successfully");
        toggleLoading('btnVerifyResetOtp', false, defaultBtnHtml);
        alert('ওটিপি কোড সফলভাবে ভেরিফাইড হয়েছে! এখন নতুন পাসওয়ার্ড সেট করুন।');
        document.getElementById('resetOtpInput').value = "";
        switchView(newPasswordView);
    }, 800);
});

// ---------------- SAVE NEW PASSWORD LOGIC (MERGED) ----------------
document.getElementById('btnSaveNewPassword').addEventListener('click', () => {
    const newPassword = document.getElementById('newPasswordInput').value;
    const confirmPassword = document.getElementById('confirmPasswordInput').value;
    const defaultBtnHtml = `<i class="fas fa-floppy-disk"></i> পাসওয়ার্ড সংরক্ষণ করুন`;
    const user = auth.currentUser;  // Might be null if user hasn't logged in recently
    console.log("Attempting to save new password. Current user:", user ? user.email : "No user logged in");

    if(!newPassword || !confirmPassword) {
        console.warn("Password fields empty");
        alert('দয়া করে দুটি ঘরই পূরণ করুন।');
        return;
    }
    if(newPassword.length < 6) {
        console.warn("Password too short");
        alert('নিরাপত্তার স্বার্থে পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }
    if(newPassword !== confirmPassword) {
        console.warn("Passwords do not match");
        alert('পাসওয়ার্ড দুটি মেলেনি! পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnSaveNewPassword', true, defaultBtnHtml);

    // Priority: If user is already authenticated, use Firebase Auth updatePassword
    if (user) {
        console.log("User authenticated, updating password via Firebase Auth");
        updatePassword(user, newPassword)
            .then(() => {
                console.log("Password updated successfully");
                toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
                alert('সফলভাবে পাসওয়ার্ড আপডেট হয়েছে!');
                document.getElementById('newPasswordInput').value = "";
                document.getElementById('confirmPasswordInput').value = "";
                switchView(loginView);
            })
            .catch((error) => {
                console.error("Update password error:", error);
                toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
                alert('পাসওয়ার্ড আপডেট ব্যর্থ: ' + error.message);
            });
    } else {
        // Fallback: Forgot password flow (user not logged in) – save to Realtime Database
        console.log("No authenticated user, saving password reset to RTDB");
        const emailKey = resetTargetEmail.replace(/[.#$\[\]]/g, "_");
        console.log("Saving to path: password_resets/" + emailKey);
        set(ref(database, 'password_resets/' + emailKey), {
            email: resetTargetEmail,
            updatedPassword: newPassword,
            updatedAt: new Date().toISOString()
        })
        .then(() => {
            console.log("Password reset saved to database");
            toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
            alert('আপনার নতুন পাসওয়ার্ডটি সফলভাবে সিস্টেমে সংরক্ষিত হয়েছে। অনুগ্রহ করে নতুন পাসওয়ার্ড দিয়ে লগইন করুন!');
            document.getElementById('newPasswordInput').value = "";
            document.getElementById('confirmPasswordInput').value = "";
            switchView(loginView);
        })
        .catch(err => {
            console.error("Database save error:", err);
            toggleLoading('btnSaveNewPassword', false, defaultBtnHtml);
            alert('পাসওয়ার্ড সংরক্ষণে সমস্যা হয়েছে: ' + err.message);
        });
    }
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
    console.log("Registration OTP request - email:", email, "name:", name);

    if(!enroll || !name || !email || !salesLine || !unit || !password) {
        console.warn("Registration form incomplete");
        alert('ফর্মের প্রতিটি ঘর সঠিক তথ্য দিয়ে পূরণ করুন।');
        return;
    }
    if(password.length < 6) {
        console.warn("Registration password too short");
        alert('নিরাপত্তার স্বার্থে পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }

    tempRegistrationData = { enroll, name, email, salesLine, unit, password };
    generatedOTP = Math.floor(100000 + Math.random() * 900000).toString();
    console.log("Generated registration OTP:", generatedOTP);

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
        console.log("Registration OTP request sent");
        toggleLoading('btnSendOTP', false, defaultBtnHtml);
        document.getElementById('otp-message').innerText = `${email} ঠিকানায় ওটিপি কোডটি পাঠানো হয়েছে।`;
        switchView(otpView);
    })
    .catch((error) => {
        console.error("Error sending registration OTP:", error);
        toggleLoading('btnSendOTP', false, defaultBtnHtml);
        alert("গুগল স্ক্রিপ্টের মাধ্যমে মেইল পাঠাতে সমস্যা হয়েছে।");
    });
});

// ---------------- VERIFY OTP AND SIGNUP LOGIC ----------------
document.getElementById('btnVerifyOTP').addEventListener('click', () => {
    const userOTP = document.getElementById('otpInput').value.trim();
    const defaultBtnHtml = `<i class="fas fa-circle-check"></i> কোড যাচাই ও অ্যাকাউন্ট তৈরি`;
    console.log("Verifying registration OTP:", userOTP, "Expected:", generatedOTP);

    if(userOTP !== generatedOTP) {
        console.warn("Registration OTP mismatch");
        alert('ভুল ওটিপি কোড! দয়া করে সঠিক কোডটি পুনরায় চেক করুন।');
        return;
    }

    toggleLoading('btnVerifyOTP', true, defaultBtnHtml);

    console.log("Creating Firebase Auth user with email:", tempRegistrationData.email);
    createUserWithEmailAndPassword(auth, tempRegistrationData.email, tempRegistrationData.password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;
            console.log("User created, UID:", uid);

            set(ref(database, 'users/' + uid), {
                enroll: tempRegistrationData.enroll,
                name: tempRegistrationData.name,
                email: tempRegistrationData.email,
                salesLine: tempRegistrationData.salesLine,
                unit: tempRegistrationData.unit,
                createdAt: new Date().toISOString()
            }).then(() => {
                console.log("User data saved to RTDB");
                toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
                alert('অভিনন্দন! আপনার অ্যাকাউন্টটি সফলভাবে ভেরিফাইড এবং রেজিস্টার্ড হয়েছে।');
                document.getElementById('otpInput').value = "";
                switchView(loginView);
            }).catch(dbErr => {
                console.error("RTDB save error:", dbErr);
                toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
                alert('ডাটাবেজে তথ্য সংরক্ষণে ত্রুটি: ' + dbErr.message);
            });
        })
        .catch((authErr) => {
            console.error("Auth error:", authErr);
            toggleLoading('btnVerifyOTP', false, defaultBtnHtml);
            alert('অথেন্টিকেশন প্রসেস ব্যর্থ হয়েছে: ' + authErr.message);
        });
});