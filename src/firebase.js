import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBhogb0E9hCyoTkWvuWP73FbtVkJYnBr8",
  authDomain: "queuing-app-fb9ee.firebaseapp.com",
  projectId: "queuing-app-fb9ee",
  storageBucket: "queuing-app-fb9ee.firebasestorage.app",
  messagingSenderId: "395212134502",
  appId: "1:395212134502:web:b6b203f6af8ba9bea3f5a7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);