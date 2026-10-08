import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDPJlSwKwFTONqCgQTm_32FBzUd7GVVrG0",
  authDomain: "complejoproyecto2.firebaseapp.com",
  projectId: "complejoproyecto2",
  storageBucket: "complejoproyecto2.firebasestorage.app",
  messagingSenderId: "22369115424",
  appId: "1:22369115424:web:5a3bdad6ee092698d2cb45",
  measurementId: "G-87E65DTK4N"
};

// Singleton de Firebase App
export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Instancia de Cloud Firestore
export const firestore = getFirestore(firebaseApp);
