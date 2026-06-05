// Firebase SDK Web v10 CDN Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Apnar dynamic project properties (image_a626de.jpg theke huba-hu neya)
const firebaseConfig = {
  apiKey: "AIzaSyBRNwi-pA80Sq7__Rn4Hg5X_280W9AexH0",
  authDomain: "avl-order-management.firebaseapp.com",
  databaseURL: "https://avl-order-management-default-rtdb.asia-southeast1.firebaseio.com",
  projectId: "avl-order-management",
  storageBucket: "avl-order-management.firebasestorage.app"
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
            // Ekhane login processing-er por dashboard-e jawar logic add korte paren
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