"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  collection,
  getDocs,
  runTransaction,
  increment,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
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
import { format } from "date-fns";

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
  invested?: number;
}

interface PricePoint {
  timestamp: number;
  yes: number;
  no: number;
}

/* =======================
   PAGE
======================= */
export default function MarketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, credits } = useAuth();

  const marketIdRaw = params.marketId;
  const marketId = Array.isArray(marketIdRaw) ? marketIdRaw[0] : marketIdRaw ?? "";
if (!marketId) return <p>No market selected.</p>;



  const [market, setMarket] = useState<Market | null>(null);
  const [position, setPosition] = useState<Position>({ yesShares: 0, noShares: 0, invested: 0 });
  const [amount, setAmount] = useState(10);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  type TimeRange = "1D" | "1W" | "1M" | "ALL";
const [timeRange, setTimeRange] = useState<TimeRange>("ALL");

  const [liveCost, setLiveCost] = useState(0);
  

  const chartRef = useRef<any>(null);

  /* =======================
     FETCH HISTORICAL PRICES
  ======================== */
  useEffect(() => {
    const loadHistory = async () => {
      const priceCol = collection(db, "markets", marketId, "priceHistory");
      const q = query(priceCol, orderBy("timestamp", "asc"));
      const snap = await getDocs(q);
      const history: PricePoint[] = snap.docs.map((d) => d.data() as PricePoint);
      setPriceHistory(history);
    };
    loadHistory();
  }, [marketId]);

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

      // append live price point
      const yes = getYesPrice(m.yesShares, m.noShares, m.liquidity);
      const no = 1 - yes;
      setPriceHistory((prev) => {
  if (prev.length === 0) {
    return [{ timestamp: Date.now(), yes, no }];
  }

  const last = prev[prev.length - 1];

  // only append if price actually changed
  if (last.yes !== yes || last.no !== no) {
    return [...prev, { timestamp: Date.now(), yes, no }];
  }

  return prev;
});

      setLoading(false);
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
     PRICES & VALUES
  ======================== */
  const yesPrice = useMemo(
    () => (market ? getYesPrice(market.yesShares, market.noShares, market.liquidity) : 0),
    [market]
  );
  const noPrice = 1 - yesPrice;

  const yesPayout = position.yesShares * yesPrice;
  const noPayout = position.noShares * noPrice;

  const investedAmount = position.invested ?? 0;
  const currentValue = position.yesShares * yesPrice + position.noShares * noPrice;
  const pnl = currentValue - investedAmount;

  useEffect(() => {
    setLiveCost(amount > 0 ? amount : 0);
  }, [amount]);

  /* =======================
     BUY FUNCTION
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
            invested: (p.invested ?? 0) + amount,
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

        // store price snapshot for chart history
        const priceCol = collection(db, "markets", marketId, "priceHistory");
        await tx.set(doc(priceCol), { timestamp: Date.now(), yes: price, no: 1 - price });
      });
    } finally {
      setBusy(false);
    }
  }

  /* =======================
     SELL FUNCTION
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
        const price = side === "yes"
          ? getYesPrice(m.yesShares, m.noShares, m.liquidity)
          : 1 - getYesPrice(m.yesShares, m.noShares, m.liquidity);

        const payout = amount * price;

        tx.update(marketRef, {
          yesShares: side === "yes" ? m.yesShares - amount : m.yesShares,
          noShares: side === "no" ? m.noShares - amount : m.noShares,
        });

        tx.update(posRef, {
          [`${side}Shares`]: increment(-amount),
          invested: (pSnap.data().invested ?? 0) - payout,
        });

        tx.update(userRef, { credits: increment(payout) });

        // store price snapshot
        const priceCol = collection(db, "markets", marketId, "priceHistory");
        await tx.set(doc(priceCol), { timestamp: Date.now(), yes: yesPrice, no: noPrice });
      });
    } finally {
      setBusy(false);
    }
  }
const filteredHistory = useMemo(() => {
  if (timeRange === "ALL") return priceHistory;

  const now = Date.now();
  let cutoff = 0;

  if (timeRange === "1D") cutoff = now - 24 * 60 * 60 * 1000;
  if (timeRange === "1W") cutoff = now - 7 * 24 * 60 * 60 * 1000;
  if (timeRange === "1M") cutoff = now - 30 * 24 * 60 * 60 * 1000;

  return priceHistory.filter((p) => p.timestamp >= cutoff);
}, [priceHistory, timeRange]);
  if (loading || !market) return <p className="p-6 text-center">Loading market…</p>;

  /* =======================
     CHART
  ======================== */



  const chartData = {
    labels: filteredHistory.map((p) => new Date(p.timestamp)),
    datasets: [
      {
        label: "YES",
        data: filteredHistory.map((p) => p.yes * 100),
        borderColor: "green",
        backgroundColor: "rgba(0,128,0,0.1)",
        tension: 0.2,
      },
      {
        label: "NO",
        data: filteredHistory.map((p) => p.no * 100),
        borderColor: "red",
        backgroundColor: "rgba(255,0,0,0.1)",
        tension: 0.2,
      },
    ],
  };

  const chartOptions: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: "top" } },
    scales: {
      x: {
        type: "time",
           grid: {
        display: false,
       
      },
        time: {
          tooltipFormat: "PP p",
          displayFormats: {
            second: "p",
            minute: "p",
            hour: "ha",
            day: "MMM d",
            month: "MMM yyyy",
          },
        },
      },
      y: 
      { min: 0, max: 100, 
        grid: {
        display: false,
        
      },
        ticks: { callback: (v) => `${v}%` } },
    },
  };

  /* =======================
     JSX
  ======================== */
  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">{market.title}</h1>
      <p className="text-gray-600">{market.summary}</p>

      <div className="flex gap-2 text-sm">
  {(["1D", "1W", "1M", "ALL"] as TimeRange[]).map((r) => (
    <button
      key={r}
      onClick={() => setTimeRange(r)}
      className={`px-3 py-1 rounded border ${
        timeRange === r ? "bg-black text-white" : "bg-white"
      }`}
    >
      {r}
    </button>
  ))}
</div>


      <div className="h-56">
        <Line ref={chartRef} data={chartData} options={chartOptions} />
      </div>

      <div className="flex gap-4">
        <span>YES {(yesPrice * 100).toFixed(1)}%</span>
        <span>NO {(noPrice * 100).toFixed(1)}%</span>
      </div>

      <input
        type="number"
        value={amount}
        min={1}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="border px-3 py-2 rounded w-40"
      />

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => buy("yes")}
          disabled={busy}
          className="bg-green-500 text-white p-2 rounded"
        >
          Buy YES
        </button>
        <button
          onClick={() => sell("yes")}
          disabled={busy || amount > position.yesShares}
          className="border p-2 rounded"
        >
          Sell YES
        </button>

        <button
          onClick={() => buy("no")}
          disabled={busy}
          className="bg-red-500 text-white p-2 rounded"
        >
          Buy NO
        </button>
        <button
          onClick={() => sell("no")}
          disabled={busy || amount > position.noShares}
          className="border p-2 rounded"
        >
          Sell NO
        </button>
      </div>

      <div className="border p-4 rounded text-sm space-y-1">
        <p>
          YES shares: {position.yesShares.toFixed(2)} × {(yesPrice * 100).toFixed(1)}%
        </p>
        <p>
          NO shares: {position.noShares.toFixed(2)} × {(noPrice * 100).toFixed(1)}%
        </p>

        <hr className="my-2" />

        <p>
          Invested: <b>{investedAmount.toFixed(2)}</b> credits
        </p>

        <p>
          Current value: <b>{currentValue.toFixed(2)}</b> credits
        </p>

        <p className={`font-semibold ${pnl >= 0 ? "text-green-600" : "text-red-600"}`}>
          P/L: {pnl >= 0 ? "+" : ""}
          {pnl.toFixed(2)} credits
        </p>
      </div>
    </div>
  );
}
