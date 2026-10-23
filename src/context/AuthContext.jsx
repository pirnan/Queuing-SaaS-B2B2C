import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { 
  onAuthStateChanged, 
  signInAnonymously, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut 
} from "firebase/auth";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        setLoading(false);
      } else {
        // Automatically sign in customer as anonymous user
        try {
          await signInAnonymously(auth);
        } catch (error) {
          console.error("Anonymous auth failed", error);
        }
      }
    });

    return unsubscribe;
  }, []);

  const loginAdmin = (email, password) => {
    return signInWithEmailAndPassword(auth, email, password);
  };

  const signupAdmin = (email, password) => {
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const logout = () => {
    return signOut(auth);
  };

  // Any non-anonymous authenticated user (or legacy admin email) has admin capabilities
  const isAdmin = Boolean(currentUser && !currentUser.isAnonymous);

  return (
    <AuthContext.Provider value={{ currentUser, isAdmin, loginAdmin, signupAdmin, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);