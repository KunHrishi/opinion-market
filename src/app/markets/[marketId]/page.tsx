"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  increment,
  addDoc,
  collection,
  serverTimestamp,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  TimeScale
);

const OPTION_COLORS = [
  "#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#06b6d4",
];

interface YesNoMarket {
  title: string;
  summary: string;
  type: "yesno";
  yes: number;
  no: number;
  sources: string[];
  status: "OPEN" | "CLOSED";
  resolved: boolean;
  winner?: "yes" | "no";
  createdAt?: any;
  imageBase64?: string | null;
  closeTime: any;
}

interface OptionMarket {
  title: string;
  summary: string;
  type: "options";
  options: { id: string; name: string; votes: number }[];
  sources: string[];
  status: "OPEN" | "CLOSED";
  resolved: boolean;
  winner?: string;
  createdAt?: any;
  imageBase64?: string | null;
  closeTime: any;
}

type Market = YesNoMarket | OptionMarket;

interface ProbabilitySnapshot {
  createdAt: any;
  yes: number;
  no: number;
}

export default function MarketDetailPage() {
  const { marketId } = useParams();
  const router = useRouter();
  const { user, credits, setCredits } = useAuth();

  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [history, setHistory] = useState<ProbabilitySnapshot[]>([]);
  const [stake, setStake] = useState(1);
  const [userVotes, setUserVotes] = useState<{ option: string; stake: number }[]>([]);
  const [votes, setVotes] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  /* ---------- Fetch market ---------- */
  useEffect(() => {
    if (!marketId) return;
    const fetchMarket = async () => {
      setLoading(true);
      const ref = doc(db, "markets", marketId as string);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        router.push("/");
        return;
      }
      setMarket(snap.data() as Market);
      setLoading(false);
    };
    fetchMarket();
  }, [marketId, router]);

  /* ---------- Countdown timer ---------- */
  useEffect(() => {
    if (!market || !market.closeTime) return;
    const closeDate = market.closeTime.toDate();

    const updateTimer = () => {
      const diff = closeDate.getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [market]);

  /* ---------- Auto-close market ---------- */
  useEffect(() => {
    if (!market || market.status === "CLOSED") return;

    const interval = setInterval(async () => {
      const now = new Date();
      const closeAt = market.closeTime.toDate();

      if (now >= closeAt && market.status === "OPEN") {
        try {
          const ref = doc(db, "markets", marketId as string);
          await updateDoc(ref, { status: "CLOSED" });
          setMarket((prev) => prev ? { ...prev, status: "CLOSED" } : prev);
          clearInterval(interval);
        } catch (err) {
          console.error("Auto-close failed:", err);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [market, marketId]);

  /* ---------- Fetch probability history ---------- */
  useEffect(() => {
    if (!marketId) return;
    const fetchHistory = async () => {
      const q = query(
        collection(db, "markets", marketId as string, "probabilityHistory"),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      const data: ProbabilitySnapshot[] = snap.docs.map(d => d.data() as ProbabilitySnapshot);
      setHistory(data);
    };
    fetchHistory();
  }, [marketId]);

  /* ---------- Fetch user votes ---------- */
  useEffect(() => {
    if (!market || !user) return;

    const fetchUserVotes = async () => {
      const votesRef = collection(db, "markets", marketId as string, "votes");
      const snap = await getDocs(votesRef);

      const votes = snap.docs
        .map((d) => d.data())
        .filter((v: any) => v.userId === user.uid)
        .map((v: any) => ({ option: v.option, stake: v.stake }));

      setUserVotes(votes);
    };

    fetchUserVotes();
  }, [market, user, marketId]);

  /* ---------- Fetch votes (for OPTIONS chart) ---------- */
  useEffect(() => {
    if (!marketId) return;
    const fetchVotes = async () => {
      const q = query(
        collection(db, "markets", marketId as string, "votes"),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      setVotes(snap.docs.map(d => d.data()));
    };
    fetchVotes();
  }, [marketId]);

  /* ---------- Voting guard ---------- */
  const canVote = market && market.status === "OPEN" && !market.resolved && market.closeTime.toDate() > new Date();

  /* ---------- Current YES/NO probability ---------- */
  const { yesProbability, noProbability } = useMemo(() => {
    if (!market || market.type !== "yesno") return { yesProbability: 0, noProbability: 0 };
    const total = market.yes + market.no;
    return {
      yesProbability: total > 0 ? (market.yes / total) * 100 : 0,
      noProbability: total > 0 ? (market.no / total) * 100 : 0,
    };
  }, [market]);

  /* ---------- OPTIONS probability ---------- */
  const optionProbabilities = useMemo(() => {
    if (!market || market.type !== "options") return [];
    const totalVotes = market.options.reduce((sum, opt) => sum + opt.votes, 0);
    return market.options.map(opt => ({
      ...opt,
      probability: totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0,
    }));
  }, [market]);

  /* ---------- OPTIONS probability line chart ---------- */
  const optionLineChartData: {
  datasets: {
    label: string;
    data: { x: Date; y: number }[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
    pointRadius: number;
    borderWidth: number;
  }[];
  truncated: boolean;
} | null = useMemo(() => {
  if (!market || market.type !== "options" || votes.length === 0) return null;

  const cumulative: Record<string, number> = {};
  let totalStake = 0;
  const timeline: Record<string, number>[] = [];

  votes.forEach(v => {
    cumulative[v.option] = (cumulative[v.option] || 0) + v.stake;
    totalStake += v.stake;
    const snapshot: Record<string, number> = {};
    Object.keys(cumulative).forEach(opt => {
      snapshot[opt] = cumulative[opt] / totalStake;
    });
    timeline.push(snapshot);
  });

  const latest = timeline[timeline.length - 1] || {};
  const optionsToShow =
    market.options.length > 4
      ? Object.entries(latest)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([name]) => name)
      : market.options.map(o => o.name);

  return {
    datasets: optionsToShow.map((opt, index) => ({
      label: opt,
      data: votes.map(v => ({
        x: v.createdAt.toDate(),
        y: ((timeline[votes.indexOf(v)][opt] ?? 0) * 100),
      })),
      borderColor: OPTION_COLORS[index % OPTION_COLORS.length],
      backgroundColor: OPTION_COLORS[index % OPTION_COLORS.length] + "33",
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    })),
    truncated: market.options.length > 4,
  };
}, [market, votes, optionProbabilities]);

const optionLineChartOptions = {
  scales: {
    x: {
      type: "time" as const,
      time: {
        unit: "hour" as const,
        tooltipFormat: "MMM d, HH:mm",
      },
      title: { display: true, text: "Time" },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: "Probability (%)" },
    },
  },
};

  /* ---------- User payout ---------- */
  const userPayout = useMemo(() => {
    if (!market || !market.resolved || userVotes.length === 0) return 0;

    if (market.type === "yesno") {
      const totalVotes = market.yes + market.no;
      const winningVotes = market.winner === "yes" ? market.yes : market.no;
      const totalWinningUserStake = userVotes.filter(v => v.option === market.winner).reduce((sum, v) => sum + v.stake, 0);
      return totalWinningUserStake > 0 ? (totalWinningUserStake * totalVotes) / winningVotes : 0;
    }

    if (market.type === "options") {
      const totalVotes = market.options.reduce((sum, o) => sum + o.votes, 0);
      const winningOption = market.options.find(o => o.name === market.winner);
      if (!winningOption) return 0;
      const totalWinningUserStake = userVotes.filter(v => v.option === market.winner).reduce((sum, v) => sum + v.stake, 0);
      return totalWinningUserStake > 0 ? (totalWinningUserStake * totalVotes) / winningOption.votes : 0;
    }

    return 0;
  }, [market, userVotes]);

  /* ---------- Volume ---------- */
  const totalVolume = useMemo(() => {
  if (!market) return 0;

  if (market.type === "yesno") {
    return market.yes + market.no;
  }

  if (market.type === "options") {
    return market.options.reduce((sum, o) => sum + o.votes, 0);
  }

  return 0;
}, [market]);


  const requireAuthOrRedirect = () => {
    if (!user) {
      router.push("/login");
      return false;
    }
    return true;
  };

  const handleVote = async (option: "yes" | "no" | string) => {
    if (!requireAuthOrRedirect() || !market || !canVote || voting) return;
    if (stake <= 0) return alert("Invalid stake.");
    if (stake > credits) return alert("Insufficient credits.");

    if (market.closeTime.toDate() <= new Date()) {
      alert("Betting is closed.");
      setMarket({ ...market, status: "CLOSED" });
      return;
    }

    try {
      setVoting(true);
      const ref = doc(db, "markets", marketId as string);

      if (market.type === "yesno") {
        await updateDoc(ref, { [option]: increment(stake) });
      } else {
        const updatedOptions = market.options.map(opt =>
          opt.name === option ? { ...opt, votes: opt.votes + stake } : opt
        );
        await updateDoc(ref, { options: updatedOptions });
      }

      await updateDoc(doc(db, "users", user!.uid), { credits: increment(-stake) });
      setCredits(credits - stake);

      await addDoc(collection(db, "markets", marketId as string, "votes"), {
        userId: user!.uid,
        option,
        stake,
        createdAt: serverTimestamp(),
      });

      await addDoc(collection(db, "users", user!.uid, "votes"), {
        marketId,
        option,
        stake,
        createdAt: serverTimestamp(),
        marketTitle: market.title,
      });

      if (market.type === "yesno") {
        await addDoc(collection(db, "markets", marketId as string, "probabilityHistory"), {
          createdAt: serverTimestamp(),
          yes: market.yes + (option === "yes" ? stake : 0),
          no: market.no + (option === "no" ? stake : 0),
        });
      }

      const snap = await getDoc(ref);
      setMarket(snap.data() as Market);
    } finally {
      setVoting(false);
    }
  };

  const formatCountdown = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };

  if (loading || !market) return <p className="p-6 text-center">Loading market...</p>;

  /* ---------- YES/NO Line chart ---------- */
  const probabilityData = history.map(h => {
    const total = h.yes + h.no;
    return { yes: total > 0 ? (h.yes / total) * 100 : 0, no: total > 0 ? (h.no / total) * 100 : 0 };
  });

 

const lineChartData = {
  datasets: [
    {
      label: "YES",
      data: history.map(h => ({
        x: h.createdAt.toDate(), // timestamp
        y: h.yes + h.no > 0 ? (h.yes / (h.yes + h.no)) * 100 : 0,
      })),
      borderColor: "#22c55e",
      backgroundColor: "#22c55e33",
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    },
    {
      label: "NO",
      data: history.map(h => ({
        x: h.createdAt.toDate(),
        y: h.yes + h.no > 0 ? (h.no / (h.yes + h.no)) * 100 : 0,
      })),
      borderColor: "#ef4444",
      backgroundColor: "#ef444433",
      tension: 0.3,
      pointRadius: 2,
      borderWidth: 2,
    },
  ],
};

const lineChartOptions = {
  scales: {
    x: {
      type: "time" as const,
      time: {
        unit: "hour" as const, // Chart.js will auto-switch to "day" if needed
        tooltipFormat: "MMM d, HH:mm",
      },
      title: { display: true, text: "Time" },
    },
    y: {
      beginAtZero: true,
      title: { display: true, text: "Probability (%)" },
    },
  },
};


  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      {/* Header with image */}
      <div className="flex items-center mb-6 gap-4">
        {market.imageBase64 && <img src={market.imageBase64} alt="Market" className="w-16 h-16 object-cover rounded border" />}
        <div className="flex-1 flex justify-between items-start">
          <h1 className="text-2xl font-bold">{market.title}</h1>
          <span className={`px-3 py-1 rounded-full text-white text-sm ${market.resolved ? "bg-yellow-600" : market.status === "OPEN" ? "bg-green-500" : "bg-gray-500"}`}>
            {market.resolved ? "RESOLVED" : market.status}
          </span>
        </div>
      </div>

      {/* Countdown */}
      {market.closeTime && timeLeft !== null && (
        <div className="mb-4 text-sm text-gray-600">
          {timeLeft <= 24 * 60 * 60 * 1000 ? (
            <span className="font-semibold text-red-600">⏳ Betting closes in {formatCountdown(timeLeft)}</span>
          ) : (
            <span>🕒 Betting closes at <span className="font-semibold">{market.closeTime.toDate().toLocaleString()}</span></span>
          )}
        </div>
      )}

      

      {/* Resolved + payout */}
      {market.resolved && (
        <>
          <div className="mb-6 p-4 rounded-lg border border-yellow-400 bg-yellow-50">
            <h2 className="font-bold text-yellow-700 mb-1">🏆 Market Resolved</h2>
            <p>{market.type === "yesno" ? `Correct Answer: ${market.winner?.toUpperCase()}` : `Winning Option: ${market.winner}`}</p>
          </div>
          {userVotes.length > 0 && (
            <div className="mb-6 p-4 rounded-lg border border-green-400 bg-green-50">
              <h3 className="font-bold text-green-700 mb-1">Your Payout</h3>
              <p>{userPayout > 0 ? `You won ${userPayout.toFixed(1)} credits!` : "You lost your stake."}</p>
            </div>
          )}
        </>
      )}

{/* Optional Probability */}

      {market.type === "options" && (
  <div className="mb-6">
  

  <div className="flex flex-wrap gap-2">
    {optionProbabilities.map((opt, index) => (
      <div
        key={opt.id}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
        style={{
          backgroundColor: OPTION_COLORS[index % OPTION_COLORS.length] + "22",
          color: OPTION_COLORS[index % OPTION_COLORS.length],
        }}
      >
        <span>{opt.name}</span>
        <span className="font-semibold">{opt.probability.toFixed(1)}%</span>
      </div>
    ))}
  </div>
</div>

)}

     {/* Current probabilities (smaller version) */}
{market.type === "yesno" && (
  <div className="mb-4 flex gap-2">
    {/* YES pill */}
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-green-400 bg-green-50">
      <span className="text-xs font-medium text-green-700">YES</span>
      <span className="text-sm font-bold text-green-600">
        {yesProbability.toFixed(1)}%
      </span>
    </div>

    {/* NO pill */}
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-400 bg-red-50">
      <span className="text-xs font-medium text-red-700">NO</span>
      <span className="text-sm font-bold text-red-600">
        {noProbability.toFixed(1)}%
      </span>
    </div>
  </div>
)}

      {/* Probability chart */}
      <div className="mb-2h-[360px] md:h-[380px]">
       
        {market.type === "yesno" && history.length > 0 && <Line data={lineChartData} options={lineChartOptions} />}
        {market.type === "options" && optionLineChartData && (
          <>
          <Line data={optionLineChartData} options={optionLineChartOptions} />
    {optionLineChartData.truncated && (
      <p className="text-sm text-gray-500 mt-1">Showing top 3 options by probability</p>
    )}
          </> 
        )}
        {market.type === "options" && !optionLineChartData && <p>No probability history yet.</p>}
      </div>


<div className="mb-2 text-sm text-gray-600 flex items-center gap-2">
  <span className="font-medium">📊 Volume:</span>
  <span className="font-semibold">{totalVolume}</span>
  <span>credits staked</span>
</div>




      {/* Stake input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Stake (credits)</label>
        <input
          type="number"
          min={1}
          max={credits}
          value={stake}
          onChange={e => setStake(Math.min(Number(e.target.value), credits))}
          className="border rounded px-3 py-2 w-40"
        />
        <p className="text-xs text-gray-500 mt-1">Available credits: {credits}</p>

        {canVote && market.type === "yesno" && (
          <p className="text-sm mt-1">
            Probable Payout: YES → {(market.yes + market.no + stake > 0 ? ((stake * (market.yes + market.no + stake)) / (market.yes + stake)).toFixed(1) : 0)} | NO → {(market.yes + market.no + stake > 0 ? ((stake * (market.yes + market.no + stake)) / (market.no + stake)).toFixed(1) : 0)}
          </p>
        )}

        {canVote && market.type === "options" && (
          <div className="text-sm mt-1 space-y-1">
            Probable Payouts:
            {market.options.map(opt => {
              const totalVotes = market.options.reduce((sum, o) => sum + o.votes, 0) + stake;
              const payout = opt.votes + stake > 0 ? (stake * totalVotes) / (opt.votes + stake) : 0;
              return <p key={opt.id}>{opt.name} → {payout.toFixed(1)}</p>;
            })}
          </div>
        )}
      </div>

      {/* Voting buttons */}
      <div className="mb-6 flex flex-wrap gap-4">
        {market.closeTime.toDate() <= new Date() || market.status === "CLOSED" ? (
          <p className="text-red-500 font-semibold">Betting is closed for this market.</p>
        ) : market.type === "yesno" ? (
          <>
            <button
              onClick={() => handleVote("yes")}
              disabled={!canVote || voting}
              className={`px-4 py-2 rounded text-white ${voting || !canVote ? "bg-gray-400 cursor-not-allowed" : "bg-green-500"}`}
            >
              {voting ? "Placing bet..." : `YES (${market.yes})`}
            </button>
            <button
              onClick={() => handleVote("no")}
              disabled={!canVote || voting}
              className={`px-4 py-2 rounded text-white ${voting || !canVote ? "bg-gray-400 cursor-not-allowed" : "bg-red-500"}`}
            >
              {voting ? "Placing bet..." : `NO (${market.no})`}
            </button>
          </>
        ) : (
          market.options.map(opt => (
            <button
              key={opt.id}
              onClick={() => handleVote(opt.name)}
              disabled={!canVote || voting}
              className={`px-4 py-2 rounded text-white ${voting || !canVote ? "bg-gray-400 cursor-not-allowed" : "bg-blue-500"}`}
            >
              {voting ? "Placing bet..." : `${opt.name} (${opt.votes})`}
            </button>

            
          ))
        )}
      </div>

      {/* Summary */}
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Summary</h2>
        <p className="text-gray-700">{market.summary}</p>
      </div>
    </div>
  );
}