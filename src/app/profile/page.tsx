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
    "overview" | "calendar" | "open" | "resolved" | "transactions"
  >("overview");
  /* ---------- Swipe Tabs ---------- */

const tabs: Array<
  "overview" | "calendar" |"open" | "resolved" | "transactions" 
> = ["overview", "calendar", "open", "resolved", "transactions"];

const [touchStartX, setTouchStartX] = useState<number | null>(null);
const [touchEndX, setTouchEndX] = useState<number | null>(null);

const MIN_SWIPE_DISTANCE = 50;

const handleTouchStart = (e: React.TouchEvent) => {
  setTouchEndX(null);
  setTouchStartX(e.targetTouches[0].clientX);
};

const handleTouchMove = (e: React.TouchEvent) => {
  setTouchEndX(e.targetTouches[0].clientX);
};

const handleTouchEnd = () => {
  if (touchStartX === null || touchEndX === null) return;

  const distance = touchStartX - touchEndX;
  const currentIndex = tabs.indexOf(activeTab);

  // swipe left → next tab
  if (distance > MIN_SWIPE_DISTANCE && currentIndex < tabs.length - 1) {
    setActiveTab(tabs[currentIndex + 1]);
  }

  // swipe right → previous tab
  if (distance < -MIN_SWIPE_DISTANCE && currentIndex > 0) {
    setActiveTab(tabs[currentIndex - 1]);
  }
  };
const prevMonth = () => {
  if (!joinedAt) return;

  const prev = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() - 1,
    1
  );

  const joinMonth = new Date(
    joinedAt.getFullYear(),
    joinedAt.getMonth(),
    1
  );

  if (prev >= joinMonth) {
    setCalendarMonth(prev);
  }
};


const nextMonth = () => {
  const next = new Date(
    calendarMonth.getFullYear(),
    calendarMonth.getMonth() + 1,
    1
  );

  if (next <= new Date()) {
    setCalendarMonth(next);
  }
};


  /* ---------- Advanced Stats ---------- */

  const [netProfitLoss, setNetProfitLoss] = useState(0);
  const [activeStake, setActiveStake] = useState(0);
  const [avgStake, setAvgStake] = useState(0);
  const [avgProfit, setAvgProfit] = useState(0);

  const [riskScore, setRiskScore] = useState<
    "Conservative" | "Balanced" | "Aggressive"
  >("Balanced");

  const [dailyPL, setDailyPL] = useState<Record<string, number>>({});
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());



  const [name, setName] = useState<string>("");
const [dob, setDob] = useState<string>("");
const [dateJoined, setDateJoined] = useState<string>("");
const [joinedAt, setJoinedAt] = useState<Date | null>(null);


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
  const joinedDate = u.createdAt.toDate();

  setJoinedAt(joinedDate);
  setDateJoined(joinedDate.toLocaleDateString());

  // start calendar at join month
  setCalendarMonth(
    new Date(joinedDate.getFullYear(), joinedDate.getMonth(), 1)
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
let activeStakeTemp = 0;
      const activeTemp: any[] = [];
      const resolvedTemp: any[] = [];
      const txTemp: any[] = [];
     const dailyMap: Record<string, number> = {};

      for (const marketId of Object.keys(votesByMarket)) {
        const marketSnap = await getDoc(doc(db, "markets", marketId));
        if (!marketSnap.exists()) continue;

        const market = marketSnap.data() as Market;
        const votes = votesByMarket[marketId];

// add to ACTIVE stake if market is NOT resolved
if (!market.resolved) {
  votes.forEach(v => {
    activeStakeTemp += v.stake;
  });
}


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

         const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
dailyMap[day] = (dailyMap[day] || 0) + profit;

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
      setActiveStake(activeStakeTemp);


      const totalMarkets = activeTemp.length + resolvedTemp.length;

setAvgStake(
  totalMarkets > 0
    ? Math.round(totalStake / totalMarkets)
    : 0
);


      setAvgProfit(
        resolvedCount > 0 ? Math.round(totalProfit / resolvedCount) : 0
      );

      const ratio = credits > 0 ? avgStake / credits : 0;

      if (ratio < 0.05) setRiskScore("Conservative");
      else if (ratio < 0.15) setRiskScore("Balanced");
      else setRiskScore("Aggressive");

    setDailyPL(dailyMap);


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

 

  /* ---------- Loading State ---------- */

  
  if (!user || loading) {
    return (
      <p className="p-6 text-center text-gray-500">Loading profile...</p>
    );
  }
const generateMonthDays = (month: Date) => {
  const days: { date: string; profit: number }[] = [];

  const year = month.getFullYear();
  const m = month.getMonth();

  const firstDay = new Date(year, m, 1);
  const lastDay = new Date(year, m + 1, 0);

  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    days.push({
      date: key,
      profit: dailyPL[key] || 0,
    });
  }

  return days;
};

const calendarDays = generateMonthDays(calendarMonth);

const monthlyPL = calendarDays.reduce((s, d) => s + d.profit, 0);


const getColor = (profit: number) => {
  if (profit === 0) return "bg-gray-200";
  if (profit < 0) return "bg-red-400";
  if (profit < 50) return "bg-green-300";
  if (profit < 200) return "bg-green-500";
  return "bg-green-700";
};


  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen flex justify-start p-6">
 

   <div className="bg-white p-6 rounded-lg shadow-md w-full">

       
{/* ===== PROFILE HEADER ===== */}
{/* ===== PROFILE HEADER ===== */}
<div className="flex items-start gap-4 mb-6">
  {/* Profile Picture */}
  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold shadow-md">
    {name ? name[0].toUpperCase() : "U"}
  </div>

  {/* User Info + Stats */}
  <div className="flex-1">
    <h2 className="text-lg font-semibold leading-tight">
      {name || "Anonymous"}
    </h2>

    <p className="text-sm text-gray-500 mt-0.5">
      Joined {dateJoined || "—"}
    </p>

    {/* INLINE STATS */}
{/* STATS BOXES */}
<div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
  {/* Credits */}
  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
    <div className="text-xs text-gray-500">Credits</div>
    <div className="text-xl font-bold text-blue-600">
      {credits}
    </div>
  </div>

  {/* Net P/L */}
  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
    <div className="text-xs text-gray-500">Net P/L</div>
    <div
      className={`text-xl font-bold ${
        netProfitLoss >= 0 ? "text-green-600" : "text-red-600"
      }`}
    >
      {netProfitLoss >= 0 ? `+${netProfitLoss}` : netProfitLoss}
    </div>
  </div>

  {/* At Stake */}
  <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-center">
    <div className="text-xs text-gray-500">At Stake</div>
    <div className="text-xl font-bold text-yellow-600">
      {activeStake}
    </div>
  </div>

  {/* Markets */}
  <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-center">
    <div className="text-xs text-gray-500">Markets</div>
    <div className="text-xl font-bold text-purple-600">
      {marketsParticipated}
    </div>
  </div>
</div>


    
  </div>
</div>



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
     <div className="mb-6 border rounded overflow-x-auto">
  <div className="flex min-w-max">
    {["overview","calendar", "open", "resolved", "transactions"].map((t) => (
      <button
        key={t}
        onClick={() => setActiveTab(t as any)}
        className={`px-4 py-2 text-sm font-semibold whitespace-nowrap ${
          activeTab === t
            ? "bg-blue-600 text-white"
            : "bg-gray-100"
        }`}
      >
        {t.toUpperCase()}
      </button>
    ))}
  </div>
</div>


<div
  onTouchStart={handleTouchStart}
  onTouchMove={handleTouchMove}
  onTouchEnd={handleTouchEnd}
>
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

        {/* Calendar Tab */}
{activeTab === "calendar" && (
  <div>
    {/* Month Header */}
    <div className="flex justify-between items-center mb-3">
      <button
        onClick={prevMonth}
        className="text-sm text-blue-600"
      >
        ←
      </button>

      <div className="text-sm font-semibold">
        {calendarMonth.toLocaleString("default", {
          month: "long",
          year: "numeric",
        })}
      </div>

      <button
        onClick={nextMonth}
        className="text-sm text-blue-600"
      >
        →
      </button>
    </div>

    {/* Monthly P/L */}
    <div
      className={`text-center text-lg font-bold mb-3 ${
        monthlyPL >= 0 ? "text-green-600" : "text-red-600"
      }`}
    >
      {monthlyPL >= 0 ? "+" : ""}
      {monthlyPL} credits
    </div>

    {/* Calendar Grid */}


{/* Calendar Grid */}
<div className="grid grid-cols-7 gap-x-[6px] gap-y-[6px]">
  {calendarDays.map((d) => {
    const dayNumber = new Date(d.date).getDate();

    return (
      <div
        key={d.date}
        title={`${d.date}: ${d.profit >= 0 ? "+" : ""}${d.profit}`}
        className={`w-14 h-14 rounded-xl p-2 flex flex-col justify-between ${getColor(
          d.profit
        )}`}
      >
        {/* Date */}
        <div className="text-[12px] text-gray-800 font-semibold">
          {dayNumber}
        </div>

        {/* P/L */}
        <div
          className={`text-[13px] font-bold text-right ${
            d.profit > 0
              ? "text-green-900"
              : d.profit < 0
              ? "text-red-900"
              : "text-gray-600"
          }`}
        >
          {d.profit !== 0 ? (
            <>
              {d.profit > 0 ? "+" : ""}
              {Math.round(d.profit)}
            </>
          ) : (
            "—"
          )}
        </div>
      </div>
    );
  })}
</div>





    {/* Legend */}
    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-3">
      <span>Less</span>
      <div className="w-3 h-3 bg-gray-200 rounded-sm" />
      <div className="w-3 h-3 bg-green-300 rounded-sm" />
      <div className="w-3 h-3 bg-green-500 rounded-sm" />
      <div className="w-3 h-3 bg-green-700 rounded-sm" />
      <span>More</span>
    </div>
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


</div>
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
