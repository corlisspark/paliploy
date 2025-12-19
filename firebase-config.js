// Firebase Configuration for PacksList
// This file must be loaded before any other PacksList scripts

// Firebase configuration loading

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyDWkbZRee5HZHTRKucfH-6rXezkgmMy29k",
  authDomain: "cw55hf8nvt.firebaseapp.com",
  projectId: "cw55hf8nvt",
  storageBucket: "cw55hf8nvt.firebasestorage.app",
  messagingSenderId: "535503702954",
  appId: "1:535503702954:web:bc505ed998e875168e79d3",
  measurementId: "G-02Z8PLPMN0"
};

// Check if we're running locally and provide debug info
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
  // Running locally - Firebase domain authorization required
  // Current origin: window.location.origin
  // Firebase authDomain: firebaseConfig.authDomain
  // Solution: Add localhost to Firebase authorized domains
}

// Initialize Firebase
try {
  firebase.initializeApp(firebaseConfig);
  // Firebase initialized successfully
  
  // Initialize Firestore
  window.db = firebase.firestore();
  // Firestore initialized
  
  // Test Firebase Auth availability
  if (firebase.auth) {
    // Firebase Auth is available
  } else {
    // Firebase Auth not available
  }
  
} catch (error) {
  // Error initializing Firebase - check configuration
}

// Make Firebase globally available
window.firebase = firebase;