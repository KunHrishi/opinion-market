"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  credits: number;
  setCredits: React.Dispatch<React.SetStateAction<number>>;
  isAdmin: boolean;
  spendCredit: () => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  // 🔑 Create user + initial credits
  const signup = async (email: string, password: string) => {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", res.user.uid), {
      email,
      credits: 100,
      admin: false, // 👈 default admin flag
      createdAt: new Date(),
    });
  };

  // 🔑 Login
  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  // 🚪 Logout
  const logout = async () => {
    await signOut(auth);
    setCredits(0);
    setIsAdmin(false);
  };

  // 💳 Deduct credit (spendCredit)
  const spendCredit = async () => {
    if (!user || credits <= 0) return;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { credits: credits - 1 });
    setCredits((prev) => prev - 1);
  };

  // 🔄 Auth listener + real-time credits update
  useEffect(() => {
    let unsubscribeUserSnap: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

        // 🔥 Listen for real-time updates to credits & admin
        unsubscribeUserSnap = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCredits(data.credits || 0);
            setIsAdmin(data.admin === true);
          }
        });
      } else {
        setCredits(0);
        setIsAdmin(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubscribeUserSnap) unsubscribeUserSnap();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        credits,
        setCredits,
        isAdmin,
        spendCredit,
        signup,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
