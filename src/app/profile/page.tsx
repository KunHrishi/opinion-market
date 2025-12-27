"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

/* ---------- Types ---------- */

interface Market {
  title?: string;
  type: "yesno" | "options";
  resolved: boolean;
  winner?: string;
}

interface UserVote {
  marketId: string;
  option: string;
  stake: number;
}

interface GraphPoint {
  month: string;
  credits: number;
}

/* ---------- Component ---------- */

export default function ProfilePage() {
  const { user, logout, credits } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [marketsParticipated, setMarketsParticipated] = useState(0);
  const [wins, setWins] = useState(0);
  const [losses, setLosses] = useState(0);
  const [breakeven, setBreakeven] = useState(0);

  const [winStreak, setWinStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);

  const [activeMarkets, setActiveMarkets] = useState<
    { id: string; title: string }[]
  >([]);

  const [resolvedMarkets, setResolvedMarkets] = useState<
    { id: string; title: string; result: "Won" | "Lost" | "Breakeven" }[]
  >([]);

  const [transactions, setTransactions] = useState<
    { marketId: string; title: string; amount: number }[]
  >([]);

  const [activeTab, setActiveTab] = useState<
    "overview" | "open" | "resolved" | "transactions" | "graph"
  >("overview");

  /* ---------- Advanced Stats ---------- */

  const [netProfitLoss, setNetProfitLoss] = useState(0);
  const [avgStake, setAvgStake] = useState(0);
  const [avgProfit, setAvgProfit] = useState(0);

  const [riskScore, setRiskScore] = useState<
    "Conservative" | "Balanced" | "Aggressive"
  >("Balanced");

  const [monthlyPL, setMonthlyPL] = useState<
    { month: string; profit: number }[]
  >([]);

  const [name, setName] = useState<string>("");
const [dob, setDob] = useState<string>("");
const [dateJoined, setDateJoined] = useState<string>("");

  /* ---------- Auth Guard ---------- */

  useEffect(() => {
    if (!user) router.push("/login");
  }, [user, router]);

  /* ---------- Fetch Profile Data ---------- */

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      setLoading(true);
const userSnap = await getDoc(doc(db, "users", user.uid));

if (userSnap.exists()) {
  const u = userSnap.data();

  setName(u.name || "Anonymous");
  setDob(u.dob || "—");

  if (u.createdAt?.toDate) {
    setDateJoined(
      u.createdAt.toDate().toLocaleDateString()
    );
  }
}


      const votesSnap = await getDocs(
        collection(db, "users", user.uid, "votes")
      );
      const userVotes = votesSnap.docs.map((d) => ({
        marketId: d.id,
        ...(d.data() as Omit<UserVote, "marketId">),
      }));

      const votesByMarket: Record<string, UserVote[]> = {};
      userVotes.forEach((v) => {
        if (!votesByMarket[v.marketId]) votesByMarket[v.marketId] = [];
        votesByMarket[v.marketId].push(v);
      });

      let win = 0;
      let loss = 0;
      let be = 0;

      let totalStake = 0;
      let totalProfit = 0;
      let resolvedCount = 0;

      const activeTemp: any[] = [];
      const resolvedTemp: any[] = [];
      const txTemp: any[] = [];
      const monthlyMap: Record<string, number> = {};

      for (const marketId of Object.keys(votesByMarket)) {
        const marketSnap = await getDoc(doc(db, "markets", marketId));
        if (!marketSnap.exists()) continue;

        const market = marketSnap.data() as Market;
        const votes = votesByMarket[marketId];

        let profit = 0;
        votes.forEach((v) => (totalStake += v.stake));

        if (market.resolved && market.winner) {
          const allVotesSnap = await getDocs(
            collection(db, "markets", marketId, "votes")
          );
          const allVotes = allVotesSnap.docs.map((d) => d.data());

          const total = allVotes.reduce(
            (s: number, v: any) => s + v.stake,
            0
          );
          const winningStake = allVotes
            .filter((v: any) => v.option === market.winner)
            .reduce((s: number, v: any) => s + v.stake, 0);

          for (const v of votes) {
            if (v.option === market.winner && winningStake > 0) {
              const payout = (v.stake / winningStake) * total;
              profit += payout - v.stake;
            } else {
              profit -= v.stake;
            }
          }
        }

        if (!market.resolved) {
          activeTemp.push({
            id: marketId,
            title: market.title || "Untitled Market",
          });
        } else {
          const result =
            profit > 0 ? "Won" : profit < 0 ? "Lost" : "Breakeven";

          resolvedTemp.push({
            id: marketId,
            title: market.title || "Untitled Market",
            result,
          });

          txTemp.push({
            marketId,
            title: market.title || "Untitled Market",
            amount: Math.round(profit),
          });

          if (result === "Won") win++;
          else if (result === "Lost") loss++;
          else be++;

          totalProfit += profit;
          resolvedCount++;

          const month = new Date().toISOString().slice(0, 7);
          monthlyMap[month] = (monthlyMap[month] || 0) + profit;
        }
      }

      /* ---------- Set State ---------- */

      setActiveMarkets(activeTemp);
      setResolvedMarkets(resolvedTemp);
      setTransactions(txTemp);

      setWins(win);
      setLosses(loss);
      setBreakeven(be);

      setMarketsParticipated(activeTemp.length + resolvedTemp.length);

      setNetProfitLoss(Math.round(totalProfit));

      setAvgStake(
        resolvedCount > 0 ? Math.round(totalStake / resolvedCount) : 0
      );

      setAvgProfit(
        resolvedCount > 0 ? Math.round(totalProfit / resolvedCount) : 0
      );

      const ratio = credits > 0 ? avgStake / credits : 0;

      if (ratio < 0.05) setRiskScore("Conservative");
      else if (ratio < 0.15) setRiskScore("Balanced");
      else setRiskScore("Aggressive");

      setMonthlyPL(
        Object.entries(monthlyMap).map(([m, p]) => ({
          month: m,
          profit: Math.round(p),
        }))
      );

      /* ---------- Streaks ---------- */

      let current = 0;
      let best = 0;

      resolvedTemp.forEach((m) => {
        if (m.result === "Won") {
          current++;
          best = Math.max(best, current);
        } else current = 0;
      });

      let recent = 0;
      for (let i = resolvedTemp.length - 1; i >= 0; i--) {
        if (resolvedTemp[i].result === "Won") recent++;
        else break;
      }

      setWinStreak(recent);
      setBestStreak(best);

      setLoading(false);
    };

    fetchStats();
  }, [user, credits]);

  /* ---------- Logout ---------- */

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  /* ---------- Navigation Helper ---------- */
  const goToMarket = (marketId: string) => {
    router.push(`/markets/${marketId}`);
  };

  /* ---------- Graph Data ---------- */
  const graphData: GraphPoint[] = [];
  let cumulative = 0;
  monthlyPL.forEach((m) => {
    cumulative += m.profit;
    graphData.push({ month: m.month, credits: cumulative });
  });

  /* ---------- Loading State ---------- */

  if (!user || loading) {
    return (
      <p className="p-6 text-center text-gray-500">Loading profile...</p>
    );
  }

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen flex justify-start p-6">
   <div className="bg-white p-6 rounded-lg shadow-md w-full max-w-4xl">
        <h1 className="text-2xl font-bold mb-4 text-center">Profile</h1>

        <p>
          <strong>Email:</strong> {user.email}
        </p>
        <p className="mb-4">
          <strong>Credits:</strong> {credits}
        </p>

{/* ===== PROFILE BADGES (ABOVE OVERVIEW) ===== */}
<div className="mb-4 flex flex-wrap gap-2">
  <span className="bg-green-200 text-green-800 px-3 py-1 rounded-full text-sm">
    🔥 Win Streak
  </span>

  <span className="bg-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm">
    🏆 Sharp Predictor
  </span>

  <span className="bg-yellow-200 text-yellow-800 px-3 py-1 rounded-full text-sm">
    ➖ Steady Player
  </span>

  <span className="bg-purple-200 text-purple-800 px-3 py-1 rounded-full text-sm">
    🛡️ No Losses
  </span>
</div>



        {/* Tabs */}
        <div className="flex mb-6 border rounded overflow-hidden">
          {["overview", "open", "resolved", "transactions", "graph"].map(
            (t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t as any)}
                className={`flex-1 p-2 text-sm font-semibold ${
                  activeTab === t
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100"
                }`}
              >
                {t.toUpperCase()}
              </button>
            )
          )}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-2">
            <p>📊 Markets Participated: {marketsParticipated}</p>
            <p>✅ Correct Predictions: {wins}</p>
            <p>➖ Breakeven Markets: {breakeven}</p>
            <p>❌ Loss Markets: {losses}</p>
            <p>🔥 Win Streak: {winStreak}</p>
            <p>🏆 Best Streak: {bestStreak}</p>
            <p>💰 Net P/L: {netProfitLoss}</p>
            <p>📊 Avg Stake: {avgStake}</p>
            <p>📈 Avg Profit: {avgProfit}</p>
            <p>⚠️ Risk: {riskScore}</p>
          </div>
        )}

        {/* Open Tab */}
        {activeTab === "open" && (
          <div className="space-y-2">
            {activeMarkets.length === 0 ? (
              <p className="text-gray-500 text-sm">No open markets</p>
            ) : (
              activeMarkets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => goToMarket(m.id)}
                  className="w-full text-left border p-2 rounded text-sm hover:bg-gray-50 cursor-pointer"
                >
                  {m.title}
                </button>
              ))
            )}
          </div>
        )}

        {/* Resolved Tab */}
        {activeTab === "resolved" && (
          <div className="space-y-2">
            {resolvedMarkets.length === 0 ? (
              <p className="text-gray-500 text-sm">No resolved markets</p>
            ) : (
              resolvedMarkets.map((m) => (
                <button
                  key={m.id}
                  onClick={() => goToMarket(m.id)}
                  className="w-full flex justify-between border p-2 rounded text-sm hover:bg-gray-50 cursor-pointer"
                >
                  <span>{m.title}</span>
                  <span
                    className={
                      m.result === "Won"
                        ? "text-green-600"
                        : m.result === "Lost"
                        ? "text-red-600"
                        : "text-gray-500"
                    }
                  >
                    {m.result}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === "transactions" && (
          <div className="space-y-2">
            {transactions.map((t) => (
              <div
                key={t.marketId}
                className="flex justify-between border p-2 rounded"
              >
                <span>{t.title}</span>
                <span
                  className={
                    t.amount > 0
                      ? "text-green-600"
                      : t.amount < 0
                      ? "text-red-600"
                      : "text-gray-500"
                  }
                >
                  {t.amount > 0 ? "+" : ""}
                  {t.amount}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Graph Tab */}
        {activeTab === "graph" && (
  <div className="w-full">
    <div className="w-full h-64 md:h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={graphData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="credits"
            stroke="#3b82f6"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>

    {/* Badges */}
    <div className="mt-4 flex flex-wrap gap-2">
      {winStreak >= 5 && (
        <span className="bg-green-200 text-green-800 px-2 py-1 rounded-full text-sm">
          🔥 Win Streak
        </span>
      )}
      {wins >= 10 && (
        <span className="bg-blue-200 text-blue-800 px-2 py-1 rounded-full text-sm">
          🏆 Expert Predictor
        </span>
      )}
      {breakeven >= 10 && (
        <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-sm">
          ➖ Steady
        </span>
      )}
      {losses === 0 && marketsParticipated > 0 && (
        <span className="bg-purple-200 text-purple-800 px-2 py-1 rounded-full text-sm">
          🛡️ No Loss
        </span>
      )}
    </div>
  </div>
)}


        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="w-full mt-6 bg-red-600 text-white p-2 rounded"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
