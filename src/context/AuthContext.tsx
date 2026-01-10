"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import type { UserCredential } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { doc, setDoc, updateDoc, onSnapshot } from "firebase/firestore";

interface AuthContextType {
  user: User | null;
  credits: number;
  setCredits: React.Dispatch<React.SetStateAction<number>>;
  isAdmin: boolean;
  authLoading: boolean;
  spendCredit: () => Promise<void>;
  signup: (email: string, password: string) => Promise<UserCredential>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // 🔑 Create user + initial credits
  const signup = async (
    email: string,
    password: string
  ): Promise<UserCredential> => {
    const res = await createUserWithEmailAndPassword(auth, email, password);

    await setDoc(doc(db, "users", res.user.uid), {
      email,
      credits: 10000,
      admin: false,
      createdAt: new Date(),
    });

    return res; // ✅ REQUIRED for caller
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

  // 💳 Deduct credit
  const spendCredit = async () => {
    if (!user || credits <= 0) return;

    const userRef = doc(db, "users", user.uid);
    await updateDoc(userRef, { credits: credits - 1 });
    setCredits((prev) => prev - 1);
  };

  // 🔄 Auth listener + real-time updates
  useEffect(() => {
    let unsubscribeUserSnap: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userRef = doc(db, "users", firebaseUser.uid);

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

      // ✅ auth state resolved
      setAuthLoading(false);
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
        authLoading,
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
