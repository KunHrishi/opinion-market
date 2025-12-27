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
}

export default function AdminMarketsPage() {
  const router = useRouter(); // ✅ THIS WAS THE IMPORTANT PART
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin – Markets</h1>

      {markets.length === 0 && (
        <p>No markets created yet.</p>
      )}

      {markets.map((market) => (
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
              market.resolved
                ? "bg-gray-300 text-gray-700"
                : "bg-green-100 text-green-700"
            }`}
          >
            {market.resolved ? "ENDED" : "OPEN"}
          </span>
        </div>
      ))}
    </div>
  );
}
