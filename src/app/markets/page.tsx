"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Option {
  id: string;
  name: string;
  votes: number;
}

interface Market {
  id: string;
  title: string;
  summary: string;
  type: "yesno" | "options";
  yes?: number;
  no?: number;
  options?: Option[];
  status: string;
  resolved: boolean;
  category?: string; // added for topic filtering
  createdAt?: number; // timestamp for "new"
  volume?: number; // for "trending"
  imageBase64?: string | null; // 🔹 new field for image
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  // Two types of tabs
  const [activeStatusTab, setActiveStatusTab] = useState<
    "TRENDING" | "NEW" | "RESOLVED"
  >("TRENDING");
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>("ALL");

  useEffect(() => {
    const fetchMarkets = async () => {
      const snap = await getDocs(query(collection(db, "markets")));

      const data = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          title: d.title,
          summary: d.summary || "",
          type: d.type,
          yes: d.yes || 0,
          no: d.no || 0,
          options: Array.isArray(d.options)
            ? d.options.map((opt: any) => ({ ...opt }))
            : [],
          status: d.status,
          resolved: d.resolved,
          category: d.category || "others",
          createdAt: d.createdAt || 0,
          volume: d.volume || 0,
          imageBase64: d.imageBase64 || null, // 🔹 include image
        } as Market;
      });

      setMarkets(data);
      setLoading(false);
    };

    fetchMarkets();
  }, []);

  if (loading) return <p className="p-6">Loading markets...</p>;

  // --- FILTER MARKETS BASED ON STATUS TAB ---
  let statusFilteredMarkets: Market[] = [];
  if (activeStatusTab === "TRENDING") {
    statusFilteredMarkets = markets
      .filter((m) => !m.resolved)
      .sort((a, b) => (b.volume || 0) - (a.volume || 0));
  } else if (activeStatusTab === "NEW") {
    statusFilteredMarkets = markets
      .filter((m) => !m.resolved)
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } else if (activeStatusTab === "RESOLVED") {
    statusFilteredMarkets = markets.filter((m) => m.resolved);
  }

  // --- FILTER MARKETS BASED ON CATEGORY TAB ---
  const filteredMarkets =
    activeCategoryTab === "ALL"
      ? statusFilteredMarkets
      : statusFilteredMarkets.filter(
          (m) => m.category?.toLowerCase() === activeCategoryTab.toLowerCase()
        );

  const categoryTabs = [
    "ALL",
    "Politics",
    "Sports",
    "Tech",
    "Culture",
    "Geopolitics",
  ];

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Prediction Markets</h1>

      {/* STATUS TABS */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {["TRENDING", "NEW", "RESOLVED"].map((tab) => (
          <button
            key={tab}
            onClick={() =>
              setActiveStatusTab(tab as "TRENDING" | "NEW" | "RESOLVED")
            }
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              activeStatusTab === tab
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* CATEGORY TABS */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {categoryTabs.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategoryTab(cat)}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              activeCategoryTab === cat
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filteredMarkets.length === 0 && (
        <p className="text-gray-500">No markets here.</p>
      )}

      {filteredMarkets.map((market) => {
        const totalYesNo = (market.yes || 0) + (market.no || 0);
        const yesProb =
          totalYesNo > 0
            ? Math.round(((market.yes || 0) / totalYesNo) * 100)
            : 0;
        const noProb = 100 - yesProb;

        const totalOptionVotes =
          market.options?.reduce((s, o) => s + o.votes, 0) || 0;

        const totalCredits =
          market.type === "yesno" ? totalYesNo : totalOptionVotes;

        return (
          <Link
            key={market.id}
            href={`/markets/${market.id}`}
            className="block border rounded p-4 mb-4 hover:bg-gray-50"
          >
                {/* 🔹 Image + Title Horizontal */}
      <div className="flex items-center mb-3 gap-3">
        {market.imageBase64 && (
          <img
            src={market.imageBase64}
            alt="Market"
            className="w-12 h-12 rounded object-cover border"
          />
        )}
        <h2 className="text-base font-semibold">{market.title}</h2>
      </div>

            {/* YES / NO */}
            {market.type === "yesno" && (
              <div className="flex flex-col space-y-1 mb-3">
                <div className="flex justify-between text-sm text-green-700">
                  <span>YES</span>
                  <span>{yesProb}%</span>
                </div>
                <div className="flex justify-between text-sm text-red-700">
                  <span>NO</span>
                  <span>{noProb}%</span>
                </div>
              </div>
            )}

            {/* OPTIONS */}
            {market.type === "options" && market.options && (
              <div className="flex flex-col space-y-1 mb-3">
                {market.options.map((opt) => {
                  const prob =
                    totalOptionVotes > 0
                      ? Math.round((opt.votes / totalOptionVotes) * 100)
                      : 0;

                  return (
                    <div
                      key={opt.id}
                      className="flex justify-between text-sm text-blue-700"
                    >
                      <span>{opt.name}</span>
                      <span>{prob}%</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TOTAL CREDITS */}
            <div className="pt-2 text-sm text-gray-600 flex justify-start gap-1">
              <span>Total credits:</span>
              <span className="font-semibold">{totalCredits}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
