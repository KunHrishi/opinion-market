"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function BadgesPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userBadges, setUserBadges] = useState<string[]>([]);

  // Full list of all possible prediction-market badges
  const allBadges = [
    // Skill & Accuracy
    "🎯 Bullseye",
    "🧮 Probability Pro",
    "📊 Data Driven",
    "🔍 Sharp Eye",
    "🧠 Market Reader",

    // Streak & Consistency
    "🔥 Win Streak",
    "🌋 Hot Hand",
    "🛡️ No Misses",
    "🧊 Ice Cold",
    "⏳ Consistent Forecaster",

    // Risk & Capital Management
    "💼 Risk Manager",
    "⚖️ Balanced Trader",
    "🐢 Slow & Steady",
    "🚀 High Conviction",
    "🧱 Capital Preserver",

    // Advanced / Expert
    "🧠 Contrarian",
    "🧪 Early Adopter",
    "🏹 Sniper",
    "📈 Market Maker",
    "🏆 Elite Forecaster",

    // Participation & Milestones
    "🎉 First Market",
    "🧩 Multi-Option Master",
    "🕰️ Veteran Trader",
    "🌍 All-Rounder",
    "🏅 Legend",
  ];

  useEffect(() => {
    if (!user) return;

    const loadBadges = async () => {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) {
        const data = snap.data();
        setUserBadges(data.badges || []);
      }
      setLoading(false);
    };

    loadBadges();
  }, [user]);

  if (!user) return <p className="p-6 text-center">Please login</p>;
  if (loading) return <p className="p-6 text-center">Loading badges...</p>;

  return (
    <div className="min-h-screen p-6 max-w-lg mx-auto">
      <h1 className="text-xl font-semibold mb-6">Your Badges</h1>

      <div className="grid grid-cols-2 gap-3">
        {allBadges.map((badge, i) => {
          const owned = userBadges.includes(badge);
          return (
            <div
              key={i}
              className={`px-3 py-2 rounded-lg text-center border ${
                owned
                  ? "bg-yellow-100 border-yellow-400 text-yellow-800"
                  : "bg-gray-100 border-gray-300 text-gray-500"
              }`}
            >
              {badge}
              {owned && <span className="block text-xs mt-1">✅ Owned</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
