/**
 * Reliable Jewellery — Firebase Configuration
 * Replace the placeholder values below with your Firebase Web App configuration.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDSWqrXU8zj8cgf5Hqz-lDQ1MgVFqfVKTk",
  authDomain: "jewellery2026reliable.firebaseapp.com",
  databaseURL: "https://jewellery2026reliable-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "jewellery2026reliable",
  storageBucket: "jewellery2026reliable.firebasestorage.app",
  messagingSenderId: "942211910337",
  appId: "1:942211910337:web:66b9626444f200dfd4a240"
};

// Developer Warning
if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.error("Firebase Auth Shield: Please configure your Firebase credentials in '/firebase-config.js'.");
    
    // Display a visual notification for developers
    window.addEventListener('DOMContentLoaded', () => {
        const warningDiv = document.createElement('div');
        warningDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 15px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Plus Jakarta Sans', sans-serif;
            font-size: 14px;
            z-index: 10000;
            border: 1px solid rgba(255,255,255,0.2);
        `;
        warningDiv.innerHTML = `
            <strong>Firebase Config Missing</strong><br>
            Please set your credentials in <code>firebase-config.js</code>.
        `;
        document.body.appendChild(warningDiv);
    });
}

// Initialize Firebase
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    
    // Enable Firestore Offline Persistence
    firebase.firestore().enablePersistence({ synchronizeTabs: true })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("Firestore offline persistence: Multiple tabs open, persistence disabled.");
            } else if (err.code === 'unimplemented') {
                console.warn("Firestore offline persistence: Not supported by this browser.");
            }
        });
}

// Global convenience instances
const auth = firebase.auth();
const db = firebase.firestore();
