// js/firebase-config.js

// PASTE YOUR FIREBASE CONFIGURATION OBJECT HERE
const firebaseConfig = {
  apiKey: "AIzaSyBeKUa_czyipxRwh6WBLDLxW8RRkTTPh-E",
  authDomain: "pdf-gen-29895.firebaseapp.com",
  projectId: "pdf-gen-29895",
  storageBucket: "pdf-gen-29895.firebasestorage.app",
  messagingSenderId: "729481362549",
  appId: "1:729481362549:web:c243e09d568fe9fb040c3c",
  measurementId: "G-SC4HHJGF6Q"
};

// Initialize Firebase App
let firebaseApp; 
try {
    firebaseApp = firebase.initializeApp(firebaseConfig);
    console.log("Firebase App Initialized Successfully.");
} catch (e) {
    console.error("Error initializing Firebase App:", e);
}

// Initialize Firestore ONLY if app initialization was successful
let db;
if (firebaseApp) {
    try {
        db = firebase.firestore();
        console.log("Firestore Initialized Successfully.");
    } catch (e) {
        console.error("Error initializing Firestore:", e);
    }
} else {
     console.error("Firebase App not initialized, Firestore cannot be accessed.");
}

// *** NO storage initialization should be here ***