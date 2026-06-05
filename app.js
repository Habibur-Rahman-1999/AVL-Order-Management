// 🔴 এখানে আপনার Firebase config বসান
const firebaseConfig = {
  apiKey: "AIzaSyBRNwi-pA8OSq7__Rn4Hg5X_280W9AexH0",
  authDomain: "avl-order-management.firebaseapp.com",
  databaseURL: "https://avl-order-management-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "avl-order-management",
  storageBucket: "avl-order-management.firebasestorage.app",
  messagingSenderId: "825754454601",
  appId: "1:825754454601:web:360c6c265f1f6b11b50d98"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const rtdb = firebase.database();

// ---------- অথেন্টিকেশন ----------
function register() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("ইমেইল ও পাসওয়ার্ড দিন");
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCred) => {
            return db.collection("users").doc(userCred.user.uid).set({
                email: email,
                firstLogin: true
            });
        })
        .then(() => alert("রেজিস্ট্রেশন সফল! এখন লগইন করুন।"))
        .catch(err => alert("ত্রুটি: " + err.message));
}

function login() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    if (!email || !password) return alert("ইমেইল ও পাসওয়ার্ড দিন");
    auth.signInWithEmailAndPassword(email, password)
        .then((userCred) => {
            return db.collection("users").doc(userCred.user.uid).get();
        })
        .then((doc) => {
            if (doc.exists && doc.data().firstLogin) {
                window.location.href = "reset.html";
            } else {
                showOrderSection();
            }
        })
        .catch(err => alert("লগইন ব্যর্থ: " + err.message));
}

function resetPassword() {
    const email = document.getElementById("email").value;
    if (!email) return alert("পাসওয়ার্ড রিসেট করতে ইমেইল দিন");
    auth.sendPasswordResetEmail(email)
        .then(() => alert("পাসওয়ার্ড রিসেট ইমেইল পাঠানো হয়েছে। দয়া করে ইমেইল দেখুন।"))
        .catch(err => alert("ত্রুটি: " + err.message));
}

function logout() {
    auth.signOut();
    location.reload();
}

// ---------- অর্ডার সেকশন ----------
function showOrderSection() {
    document.getElementById("auth-section").style.display = "none";
    document.getElementById("order-section").style.display = "block";
    document.getElementById("userEmail").innerText = auth.currentUser.email;
    trackOnlineStatus();
    loadOrders();
    listenActiveUsers();
}

function submitOrder() {
    const product = document.getElementById("product").value;
    const quantity = document.getElementById("quantity").value;
    if (!product || !quantity) return alert("পণ্য ও পরিমাণ দিন");

    const user = auth.currentUser;
    db.collection("orders").add({
        userId: user.uid,
        email: user.email,
        product: product,
        quantity: Number(quantity),
        status: "pending",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
        alert("অর্ডার সফলভাবে জমা হয়েছে।");
        document.getElementById("product").value = "";
        document.getElementById("quantity").value = "";
    })
    .catch(err => alert("অর্ডার সাবমিট ব্যর্থ: " + err.message));
}

function loadOrders() {
    db.collection("orders")
        .where("userId", "==", auth.currentUser.uid)
        .orderBy("createdAt", "desc")
        .onSnapshot((snapshot) => {
            const list = document.getElementById("orderList");
            list.innerHTML = "";
            snapshot.forEach((doc) => {
                const o = doc.data();
                const li = document.createElement("li");
                li.innerHTML = `
                    ${o.product} (পরিমাণ: ${o.quantity}) - <strong>${o.status}</strong>
                    ${o.status === "pending" ? ` <button onclick="cancelOrder('${doc.id}')">বাতিল</button>` : ""}
                `;
                list.appendChild(li);
            });
        });
}

function cancelOrder(orderId) {
    db.collection("orders").doc(orderId).update({ status: "cancelled" })
        .then(() => alert("অর্ডার বাতিল করা হয়েছে।"))
        .catch(err => alert("ত্রুটি: " + err.message));
}

// ---------- অনলাইন স্ট্যাটাস ট্র্যাকিং ----------
function trackOnlineStatus() {
    const uid = auth.currentUser.uid;
    const userStatusRef = rtdb.ref("status/" + uid);
    const offlineData = {
        online: false,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };
    const onlineData = {
        online: true,
        lastSeen: firebase.firestore.FieldValue.serverTimestamp()
    };

    rtdb.ref(".info/connected").on("value", (snap) => {
        if (snap.val() === true) {
            userStatusRef.onDisconnect().set(offlineData).then(() => {
                userStatusRef.set(onlineData);
            });
            db.collection("status").doc(uid).set(onlineData);
        }
    });
}

function listenActiveUsers() {
    db.collection("status").where("online", "==", true)
        .onSnapshot((snap) => {
            document.getElementById("activeCount").innerText = snap.size;
        });
}