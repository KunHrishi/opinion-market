"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Save, LogOut, Award } from "lucide-react";

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [oldUsername, setOldUsername] = useState(""); // for removing old username

  /* ---------- Auth Guard & Load Username ---------- */
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const loadProfile = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUsername(data.username || "");
        setOldUsername(data.username || "");
      }
      setLoading(false);
    };

    loadProfile();
  }, [user, router]);

  /* ---------- Save Username ---------- */
  const handleSave = async () => {
    if (!user) return;

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setError("Username cannot be empty");
      return;
    }

    setSaving(true);
    setError("");

    try {
      // Check if new username already exists
      const newUsernameDocRef = doc(db, "usernames", trimmedUsername);
      const newUsernameSnap = await getDoc(newUsernameDocRef);

      if (newUsernameSnap.exists() && trimmedUsername !== oldUsername) {
        setError("This username is already taken");
        setSaving(false);
        return;
      }

      // Save new username to user's doc
      await updateDoc(doc(db, "users", user.uid), {
        username: trimmedUsername,
        updatedAt: new Date(),
      });

      // Save username to /usernames/<username>
      await setDoc(newUsernameDocRef, { uid: user.uid });

      // Remove old username if it changed
      if (oldUsername && oldUsername !== trimmedUsername) {
        const oldUsernameDocRef = doc(db, "usernames", oldUsername);
        await deleteDoc(oldUsernameDocRef);
      }

      router.back();
    } catch (e: any) {
      console.error(e);
      setError("Failed to save username");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handleBadgesClick = () => {
    router.push("/badges");
  };

  if (loading) {
    return (
      <p className="p-6 text-center text-gray-500">Loading settings...</p>
    );
  }

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-gray-100"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      {/* Badges Button */}
      <button
        onClick={handleBadgesClick}
        className="flex items-center gap-2 mb-6 border border-gray-300 rounded-full px-4 py-2 text-sm hover:bg-gray-100"
      >
        <Award size={16} />
        Badges
      </button>

      {/* Username Form */}
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Your username"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-black text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-gray-800 disabled:opacity-60"
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Changes"}
        </button>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 border border-gray-300 text-gray-800 rounded-full px-4 py-2 text-sm hover:bg-gray-100 mt-3"
        >
          <LogOut size={16} />
          Logout
        </button>
      </div>
    </div>
  );
}
