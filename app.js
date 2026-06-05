// Firebase SDK Web v10 CDN Imports (GitHub Pages-এ সরাসরি রান করার জন্য ব্রাউজার লিংক ব্যবহার করা হয়েছে)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// আপনার প্রজেক্টের আসল Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBRNwi-pA8OSq7__Rn4Hg5X_280W9AexH0",
  authDomain: "avl-order-management.firebaseapp.com",
  databaseURL: "https://avl-order-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "avl-order-management",
  storageBucket: "avl-order-management.firebasestorage.app",
  messagingSenderId: "825754454601",
  appId: "1:825754454601:web:360c6c265f1f6b11b50d98"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// DOM Elements Setup
const userIdInput = document.getElementById('userId');
const passwordInput = document.getElementById('password');
const btnLogin = document.getElementById('btnLogin');
const btnRegister = document.getElementById('btnRegister');

// Login Handler Logic
btnLogin.addEventListener('click', () => {
    const email = userIdInput.value.trim();
    const password = passwordInput.value;
    
    if(!email || !password) {
        alert('দয়া করে আইডি/ইমেইল এবং পাসওয়ার্ড প্রদান করুন।');
        return;
    }

    signInWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert('লগইন সফল হয়েছে!');
            console.log("Logged In User:", userCredential.user);
        })
        .catch((error) => {
            alert('লগইন ব্যর্থ হয়েছে: ' + error.message);
        });
});

// Registration Handler Logic
btnRegister.addEventListener('click', () => {
    const email = userIdInput.value.trim();
    const password = passwordInput.value;

    if(!email || !password) {
        alert('দয়া করে রেজিস্টার করার জন্য আইডি/ইমেইল এবং পাসওয়ার্ড প্রদান করুন।');
        return;
    }

    if(password.length < 6) {
        alert('নিরাপত্তার জন্য পাসওয়ার্ড নূন্যতম ৬ অক্ষরের হতে হবে।');
        return;
    }

    createUserWithEmailAndPassword(auth, email, password)
        .then((userCredential) => {
            alert('রেজিস্ট্রেশন সফল হয়েছে! এবার লগইন বোতামে ক্লিক করুন।');
            console.log("Registered User:", userCredential.user);
        })
        .catch((error) => {
            alert('রেজিস্ট্রেশন ব্যর্থ হয়েছে: ' + error.message);
        });
});