"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  runTransaction,
  Timestamp,
  increment,
  onSnapshot,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import {
  Chart as ChartJS,
  TimeScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  ChartOptions,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

ChartJS.register(TimeScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

/* =======================
   PRICE ENGINE (LMSR)
======================= */
function getYesPrice(y: number, n: number, b: number) {
  const ey = Math.exp(y / b);
  const en = Math.exp(n / b);
  return ey / (ey + en);
}

/* =======================
   TYPES
======================= */
interface Market {
  title: string;
  summary: string;
  type: "yesno";
  yesShares: number;
  noShares: number;
  liquidity: number;
  status: "OPEN" | "CLOSED";
  resolved: boolean;
  winner?: "yes" | "no";
  closeTime: Timestamp;
}

interface Position {
  yesShares: number;
  noShares: number;
  invested: number;
}

interface PricePoint {
  timestamp: number;
  yes: number;
  no: number;
}

export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, credits } = useAuth();

  const marketIdRaw = params.marketId;
  if (!marketIdRaw) return <p>No market selected.</p>;
  const marketId = Array.isArray(marketIdRaw) ? marketIdRaw[0] : marketIdRaw;

  const [market, setMarket] = useState<Market | null>(null);
  const [position, setPosition] = useState<Position>({
    yesShares: 0,
    noShares: 0,
    invested: 0,
  });
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [liveCost, setLiveCost] = useState(0);

  const chartRef = useRef<any>(null);

  /* =======================
     REAL-TIME MARKET
  ======================== */
  useEffect(() => {
    const marketRef = doc(db, "markets", marketId);
    const unsubscribe = onSnapshot(marketRef, (snap) => {
      if (!snap.exists()) {
        router.push("/");
        return;
      }
      const m = snap.data() as Market;
      setMarket(m);
      setLoading(false);

      const yes = getYesPrice(m.yesShares, m.noShares, m.liquidity);
      const no = 1 - yes;
      setPriceHistory((prev) => [...prev, { timestamp: Date.now(), yes, no }]);
    });

    return () => unsubscribe();
  }, [marketId, router]);

  /* =======================
     REAL-TIME POSITION
  ======================== */
  useEffect(() => {
    if (!user) return;
    const posRef = doc(db, "positions", `${user.uid}_${marketId}`);
    const unsubscribe = onSnapshot(posRef, (snap) => {
      if (snap.exists()) setPosition(snap.data() as Position);
      else setPosition({ yesShares: 0, noShares: 0, invested: 0 });
    });

    return () => unsubscribe();
  }, [user, marketId]);

  /* =======================
     PRICES
  ======================== */
  const yesPrice = useMemo(
    () => (market ? getYesPrice(market.yesShares, market.noShares, market.liquidity) : 0),
    [market]
  );
  const noPrice = 1 - yesPrice;

  const yesPayout = position.yesShares * yesPrice;
  const noPayout = position.noShares * noPrice;

  const investedAmount = position.invested;
  const currentValue = position.yesShares * yesPrice + position.noShares * noPrice;
  const pnl = currentValue - investedAmount;

  useEffect(() => {
    setLiveCost(amount > 0 ? amount : 0);
  }, [amount]);

  /* =======================
     BUY
  ======================== */
  async function buy(side: "yes" | "no") {
    if (!user || !market || busy) return;
    if (amount <= 0 || amount > credits) return alert("Invalid amount");

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const marketRef = doc(db, "markets", marketId);
        const userRef = doc(db, "users", user.uid);
        const posRef = doc(db, "positions", `${user.uid}_${marketId}`);

        const mSnap = await tx.get(marketRef);
        const uSnap = await tx.get(userRef);
        const pSnap = await tx.get(posRef);

        const m = mSnap.data()!;
        const price = side === "yes"
          ? getYesPrice(m.yesShares, m.noShares, m.liquidity)
          : 1 - getYesPrice(m.yesShares, m.noShares, m.liquidity);

        const shares = amount / price;

        tx.update(marketRef, {
          yesShares: side === "yes" ? m.yesShares + shares : m.yesShares,
          noShares: side === "no" ? m.noShares + shares : m.noShares,
        });

        tx.update(userRef, { credits: increment(-amount) });

        if (pSnap.exists()) {
          const p = pSnap.data()!;
          tx.update(posRef, {
            yesShares: side === "yes" ? p.yesShares + shares : p.yesShares,
            noShares: side === "no" ? p.noShares + shares : p.noShares,
            invested: increment(amount),
          });
        } else {
          tx.set(posRef, {
            userId: user.uid,
            marketId,
            yesShares: side === "yes" ? shares : 0,
            noShares: side === "no" ? shares : 0,
            invested: amount,
          });
        }
      });
    } finally {
      setBusy(false);
    }
  }

  /* =======================
     SELL (partial)
  ======================== */
  async function sell(side: "yes" | "no") {
    if (!user || !market || busy) return;

    const owned = side === "yes" ? position.yesShares : position.noShares;
    if (amount <= 0 || amount > owned) return alert("Invalid sell amount");

    setBusy(true);
    try {
      await runTransaction(db, async (tx) => {
        const marketRef = doc(db, "markets", marketId);
        const userRef = doc(db, "users", user.uid);
        const posRef = doc(db, "positions", `${user.uid}_${marketId}`);

        const mSnap = await tx.get(marketRef);
        const pSnap = await tx.get(posRef);
        if (!pSnap.exists()) throw new Error("No position");

        const m = mSnap.data()!;
        const p = pSnap.data() as Position;

        const price = side === "yes"
          ? getYesPrice(m.yesShares, m.noShares, m.liquidity)
          : 1 - getYesPrice(m.yesShares, m.noShares, m.liquidity);

        const payout = amount * price;

        const costFraction = (amount / owned) * p.invested; // proportion of invested amount sold

        tx.update(marketRef, {
          yesShares: side === "yes" ? m.yesShares - amount : m.yesShares,
          noShares: side === "no" ? m.noShares - amount : m.noShares,
        });

        tx.update(posRef, {
          [`${side}Shares`]: increment(-amount),
          invested: increment(-costFraction), // adjust invested
        });

        tx.update(userRef, { credits: increment(payout) });
      });
    } finally {
      setBusy(false);
    }
  }

  if (loading || !market) return <p className="p-6 text-center">Loading market…</p>;

  /* =======================
     CHART
  ======================== */
  const chartData = {
    labels: priceHistory.map((p) => new Date(p.timestamp)),
    datasets: [
      { label: "YES", data: priceHistory.map((p) => p.yes * 100), borderColor: "green", tension: 0.2 },
      { label: "NO", data: priceHistory.map((p) => p.no * 100), borderColor: "red", tension: 0.2 },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    scales: {
      x: { type: "time", time: { unit: "second" } },
      y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
    },
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{market.title}</h1>
      <p className="text-gray-600">{market.summary}</p>

      <div className="h-56 mb-4">
        <Line ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      {/* Polymarket-style YES/NO panels */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 border border-green-400 rounded p-4 text-center">
          <div className="text-xs text-gray-600 mb-1">YES Price</div>
          <div className="text-2xl font-bold text-green-700">{(yesPrice*100).toFixed(1)}%</div>
          <div className="text-sm text-gray-500 mt-1">{position.yesShares.toFixed(2)} shares</div>
        </div>
        <div className="bg-red-50 border border-red-400 rounded p-4 text-center">
          <div className="text-xs text-gray-600 mb-1">NO Price</div>
          <div className="text-2xl font-bold text-red-700">{(noPrice*100).toFixed(1)}%</div>
          <div className="text-sm text-gray-500 mt-1">{position.noShares.toFixed(2)} shares</div>
        </div>
      </div>

      {/* Buy/Sell controls */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <input
          type="number"
          value={amount}
          min={1}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="border px-3 py-2 rounded col-span-4"
          placeholder="Amount (credits)"
        />

        <button onClick={() => buy("yes")} disabled={busy} className="bg-green-500 text-white p-2 rounded col-span-2">
          Buy YES
        </button>
        <button onClick={() => sell("yes")} disabled={busy || amount > position.yesShares} className="border p-2 rounded col-span-2">
          Sell YES
        </button>

        <button onClick={() => buy("no")} disabled={busy} className="bg-red-500 text-white p-2 rounded col-span-2">
          Buy NO
        </button>
        <button onClick={() => sell("no")} disabled={busy || amount > position.noShares} className="border p-2 rounded col-span-2">
          Sell NO
        </button>
      </div>

      {/* Position & P/L card */}
     <div className="border rounded p-4 bg-gray-50 space-y-2">
  <div className="flex justify-between">
    <span>YES shares:</span>
    <span>{(position.yesShares ?? 0).toFixed(2)} × {(yesPrice*100).toFixed(1)}%</span>
  </div>
  <div className="flex justify-between">
    <span>NO shares:</span>
    <span>{(position.noShares ?? 0).toFixed(2)} × {(noPrice*100).toFixed(1)}%</span>
  </div>
  <hr className="my-2" />
  <div className="flex justify-between">
    <span>Invested:</span>
    <span>{(position.invested ?? 0).toFixed(2)} credits</span>
  </div>
  <div className="flex justify-between">
    <span>Current value:</span>
    <span>{currentValue.toFixed(2)} credits</span>
  </div>
  <div className={`flex justify-between font-semibold ${pnl>=0?'text-green-600':'text-red-600'}`}>
    <span>P/L:</span>
    <span>{pnl>=0?'+':''}{pnl.toFixed(2)} credits</span>
  </div>
</div>

    </div>
  );
}
