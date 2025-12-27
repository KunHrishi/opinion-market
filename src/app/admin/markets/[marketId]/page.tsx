"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  getDocs,
  writeBatch,
  increment,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { useAuth } from "@/context/AuthContext";
import { Timestamp } from "firebase/firestore";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/* =========================
   TYPES
   ========================= */

interface YesNoMarket {
  title: string;
  summary: string;
  type: "yesno";
  yes: number;
  no: number;
  sources: string[];
  status: string;
  resolved: boolean;
  winner?: "yes" | "no";

  featured?: boolean;
  createdAt?: Timestamp;
  eventTime?: Timestamp;
  closeTime?: Timestamp;
  resolvedAt?: Timestamp | null;
  lockedAt?: Timestamp | null;
}

interface Option {
  id: string;
  name: string;
  votes: number;
}

interface OptionMarket {
  title: string;
  summary: string;
  type: "options";
  options: Option[];
  sources: string[];
  status: string;
  resolved: boolean;
  winner?: string;

  featured?: boolean;
  createdAt?: Timestamp;
  eventTime?: Timestamp;
  closeTime?: Timestamp;
  resolvedAt?: Timestamp | null;
  lockedAt?: Timestamp | null;
}

type Market = YesNoMarket | OptionMarket;

/* =========================
   PAGE
   ========================= */

export default function AdminMarketDetailPage() {
  const { marketId } = useParams();
  const router = useRouter();
  const { user } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    if (!marketId) return;

    const fetchMarket = async () => {
      setLoading(true);
      const docRef = doc(db, "markets", marketId as string);
      const snapshot = await getDoc(docRef);

      if (!snapshot.exists()) {
        alert("Market not found");
        router.push("/admin/markets");
        return;
      }

      setMarket(snapshot.data() as Market);
      setLoading(false);
    };

    fetchMarket();
  }, [marketId, router]);

  /* =========================
     COUNTDOWN CLOCK
     ========================= */
  useEffect(() => {
    if (
      !market?.closeTime ||
      market.resolved ||
      market.status === "CLOSED"
    ) {
      setTimeLeft(null);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const close = market.closeTime!.toDate().getTime();
      const diff = close - now;

      if (diff <= 0) {
        setTimeLeft("Closed");
        clearInterval(interval);
        return;
      }

      const hrs = Math.floor(diff / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hrs}h ${mins}m ${secs}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [market]);

  if (loading || !market) {
    return <p className="p-6 text-center">Loading market...</p>;
  }

  /* =========================
     ACTIONS
     ========================= */

  const handleEndMarket = async () => {
    setUpdating(true);
    const ref = doc(db, "markets", marketId as string);
    await updateDoc(ref, { status: "CLOSED" });
    const snap = await getDoc(ref);
    setMarket(snap.data() as Market);
    setUpdating(false);
  };

  const handleToggleFeatured = async () => {
    if (!market) return;
    setUpdating(true);

    const ref = doc(db, "markets", marketId as string);
    await updateDoc(ref, {
      featured: !market.featured,
    });

    const snap = await getDoc(ref);
    setMarket(snap.data() as Market);
    setUpdating(false);
  };

  const handleResolveMarket = async (winner: string) => {
    setUpdating(true);

    const marketRef = doc(db, "markets", marketId as string);

    await updateDoc(marketRef, {
      resolved: true,
      winner,
      status: "CLOSED",
      resolvedAt: Timestamp.now(),
    });

    const votesSnap = await getDocs(
      collection(db, "markets", marketId as string, "votes")
    );

    if (!votesSnap.empty) {
      const batch = writeBatch(db);

      const votes = votesSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as any[];

      const winningVotes = votes.filter((v) => v.option === winner);
      const totalStake = votes.reduce((s, v) => s + v.stake, 0);
      const totalWinningStake = winningVotes.reduce((s, v) => s + v.stake, 0);

      for (const vote of winningVotes) {
        const payout =
          totalWinningStake > 0
            ? (vote.stake / totalWinningStake) * totalStake
            : 0;

        batch.update(doc(db, "users", vote.userId), {
          credits: increment(payout),
        });

        batch.update(
          doc(db, "markets", marketId as string, "votes", vote.id),
          { paid: true, payout }
        );
      }

      await batch.commit();
    }

    const snap = await getDoc(marketRef);
    setMarket(snap.data() as Market);
    setUpdating(false);
  };

  /* =========================
     CHART
     ========================= */
  const chartData =
    market.type === "yesno"
      ? {
          labels: ["YES", "NO"],
          datasets: [
            {
              label: "Votes",
              data: [market.yes ?? 0, market.no ?? 0],
              backgroundColor: ["#22c55e", "#ef4444"].map((c, i) =>
                market.resolved &&
                market.winner === (i === 0 ? "yes" : "no")
                  ? "#facc15"
                  : c
              ),
            },
          ],
        }
      : {
          labels: market.options.map((o) => o.name),
          datasets: [
            {
              label: "Votes",
              data: market.options.map((o) => o.votes),
              backgroundColor: market.options.map((o) =>
                market.resolved && market.winner === o.name
                  ? "#facc15"
                  : "#3b82f6"
              ),
            },
          ],
        };

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{market.title}</h1>
        <span
          className={`px-3 py-1 rounded-full text-white ${
            market.status === "OPEN"
              ? "bg-green-500"
              : "bg-yellow-500"
          }`}
        >
          {market.status}
        </span>
      </div>

      {/* Countdown */}
      {timeLeft && (
        <div className="mb-4 text-sm font-semibold text-red-600">
          ⏳ Closes in: {timeLeft}
        </div>
      )}

      {/* Featured Toggle */}
      <button
        onClick={handleToggleFeatured}
        disabled={updating}
        className={`mb-6 px-4 py-2 rounded text-white ${
          market.featured ? "bg-yellow-500" : "bg-gray-500"
        }`}
      >
        {market.featured ? "★ Featured" : "☆ Mark as Featured"}
      </button>

      {/* Summary */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Summary</h2>
        <p>{market.summary}</p>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Votes</h2>
        <Bar data={chartData} />
      </div>

      {/* Admin Actions */}
      {!market.resolved && (
        <div className="mb-6 flex gap-4 flex-wrap">
          {market.status === "OPEN" && (
            <button
              onClick={handleEndMarket}
              disabled={updating}
              className="bg-red-500 text-white px-4 py-2 rounded"
            >
              End Market
            </button>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="font-semibold mr-2">Resolve as:</span>
            {market.type === "yesno"
              ? ["yes", "no"].map((v) => (
                  <button
                    key={v}
                    onClick={() => handleResolveMarket(v)}
                    disabled={updating}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    {v.toUpperCase()} Wins
                  </button>
                ))
              : market.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleResolveMarket(opt.name)}
                    disabled={updating}
                    className="bg-blue-500 text-white px-4 py-2 rounded"
                  >
                    {opt.name} Wins
                  </button>
                ))}
          </div>
        </div>
      )}
    </div>
  );
}
