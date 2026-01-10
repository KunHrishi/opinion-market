"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Market {
  id: string;
  title: string;
  description: string;
  type: "yesno" | "options";
  resolved: boolean;
  closed?: boolean;
}

type Tab = "open" | "resolved" | "closed";

export default function AdminMarketsPage() {
  const router = useRouter();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("open");

  useEffect(() => {
    const fetchMarkets = async () => {
      const snapshot = await getDocs(collection(db, "markets"));

      const data: Market[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Market, "id">),
      }));

      setMarkets(data);
      setLoading(false);
    };

    fetchMarkets();
  }, []);

  if (loading) {
    return <p className="p-6">Loading markets...</p>;
  }

  const filteredMarkets = markets.filter((m) => {
    if (activeTab === "open") return !m.resolved;
    if (activeTab === "resolved") return m.resolved && !m.closed;
    if (activeTab === "closed") return m.closed;
    return false;
  });

  const renderMarket = (market: Market) => (
    <div
      key={market.id}
      onClick={() => router.push(`/admin/markets/${market.id}`)}
      className="border rounded p-4 mb-4 flex justify-between items-center
                 cursor-pointer hover:bg-gray-50 transition"
    >
      <div>
        <h2 className="font-semibold">{market.title}</h2>
        <p className="text-sm text-gray-500">
          Type: {market.type === "yesno" ? "Yes / No" : "Option-based"}
        </p>
      </div>

      <span
        className={`px-3 py-1 rounded text-sm ${
          market.closed
            ? "bg-red-100 text-red-700"
            : market.resolved
            ? "bg-gray-300 text-gray-700"
            : "bg-green-100 text-green-700"
        }`}
      >
        {market.closed ? "CLOSED" : market.resolved ? "RESOLVED" : "OPEN"}
      </span>
    </div>
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin – Markets</h1>

      {/* TABS */}
      <div className="flex gap-2 mb-6 border-b">
        {[
          { key: "open", label: "Open" },
          { key: "resolved", label: "Resolved" },
          { key: "closed", label: "Closed" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as Tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activeTab === tab.key
                ? "border-black text-black"
                : "border-transparent text-gray-500 hover:text-black"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MARKET LIST */}
      {filteredMarkets.length === 0 ? (
        <p className="text-sm text-gray-500">
          No markets in this category.
        </p>
      ) : (
        filteredMarkets.map(renderMarket)
      )}
    </div>
  );
}
