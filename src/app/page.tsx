"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import CategoryBar from "@/components/CategoryBar";

/* ---------- Types ---------- */
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
  resolved: boolean;
  imageBase64?: string | null;
  category?: string;
  closeTime?: any;
  traders?: number;
  highestPayout?: string| null;
}

/* ---------- Page ---------- */
export default function HomePage() {
  const [carouselMarkets, setCarouselMarkets] = useState<Market[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);

  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("Trending");

  /* ---------- Fetch ---------- */
  useEffect(() => {
    const fetchMarkets = async () => {
      const snap = await getDocs(collection(db, "markets"));
      const data: Market[] = [];

      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        const marketId = docSnap.id;

        // fetch votes subcollection for this market
        const votesSnap = await getDocs(collection(db, `markets/${marketId}/votes`));

        const usersSet = new Set<string>();
        const optionVotes: Record<string, number> = {};

        votesSnap.forEach((v) => {
          const vote = v.data();
          usersSet.add(vote.userId);
          const opt = vote.option;
          if (!optionVotes[opt]) optionVotes[opt] = 0;
          optionVotes[opt] += vote.stake;
        });

        // calculate highest payout safely
        let highestPayout: string | null = null;
        const totalStake = Object.values(optionVotes).reduce((a, b) => a + b, 0);

        if (totalStake > 0) {
          if (d.type === "yesno") {
            const yesStake = optionVotes["yes"] || 0;
            const noStake = optionVotes["no"] || 0;

            const yesPayout = yesStake > 0 ? (totalStake / yesStake).toFixed(2) : "N/A";
            const noPayout = noStake > 0 ? (totalStake / noStake).toFixed(2) : "N/A";

            if (yesPayout === "N/A") highestPayout = `NO pays ${noPayout}x`;
            else if (noPayout === "N/A") highestPayout = `YES pays ${yesPayout}x`;
            else highestPayout = yesPayout > noPayout ? `YES pays ${yesPayout}x` : `NO pays ${noPayout}x`;
          } else if (d.type === "options" && Array.isArray(d.options)) {
            let maxPayoutOpt = "";
            let maxPayoutVal = 0;
            for (const o of d.options) {
              const stake = optionVotes[o.name] || 0;
              if (stake > 0) {
                const payout = totalStake / stake;
                if (payout > maxPayoutVal) {
                  maxPayoutVal = payout;
                  maxPayoutOpt = o.name;
                }
              }
            }
            highestPayout = maxPayoutOpt ? `${maxPayoutOpt} pays ${maxPayoutVal.toFixed(2)}x` : "N/A";
          }
        } else highestPayout = "N/A";

        data.push({
          id: marketId,
          title: d.title,
          summary: d.summary || "",
          type: d.type,
          yes: optionVotes["yes"] || 0,
          no: optionVotes["no"] || 0,
          options: Array.isArray(d.options)
            ? d.options.map((o: any) => ({
                id: o.id,
                name: o.name,
                votes: optionVotes[o.name] || 0,
              }))
            : [],
          resolved: d.resolved === true,
          imageBase64: d.imageBase64 || null,
          category: d.category || "Others",
          closeTime: d.closeTime || null,
          traders: usersSet.size,
          highestPayout,
        });
      }

      setCarouselMarkets(data.slice(0, 5));
      setMarkets(data.slice(5));
      setLoading(false);
    };

    fetchMarkets();
  }, []);

  /* ---------- Auto slide ---------- */
  useEffect(() => {
    if (!carouselMarkets.length) return;

    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % carouselMarkets.length;
        carouselRef.current?.scrollTo({
          left: next * (carouselRef.current?.offsetWidth || 0),
          behavior: "smooth",
        });
        return next;
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [carouselMarkets]);

  const handleScroll = () => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.offsetWidth;
    setActiveIndex(Math.round(carouselRef.current.scrollLeft / width));
  };

  const goToSlide = (index: number) => {
    if (!carouselRef.current) return;
    const width = carouselRef.current.offsetWidth;
    carouselRef.current.scrollTo({
      left: index * width,
      behavior: "smooth",
    });
    setActiveIndex(index);
  };

  const formatTimeLeft = (closeTime: any) => {
    if (!closeTime) return null;
    const diff = closeTime.toDate().getTime() - Date.now();
    if (diff <= 0) return "Closed";
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`;
  };

  if (loading) return <p className="p-6 text-gray-500">Loading markets...</p>;

  return (
    <div className="max-w-7xl mx-auto p-4 overflow-hidden">
      <CategoryBar />

      {/* ================= CAROUSEL ================= */}
      <div
        ref={carouselRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-scroll no-scrollbar mb-3"
      >
        {carouselMarkets.map((m) => {
          const total = (m.yes || 0) + (m.no || 0) + (m.options?.reduce((a, o) => a + o.votes, 0) || 0);
          const yesProb = m.type === "yesno" && total > 0 ? Math.round(((m.yes || 0) / total) * 100) : 0;
          const topOptions = m.type === "options" ? [...(m.options || [])].sort((a, b) => b.votes - a.votes).slice(0, 2) : [];

          return (
            <Link key={m.id} href={`/markets/${m.id}`} className="flex-none w-full snap-center px-2">
              <div className="bg-white border rounded-xl shadow p-4 h-52 flex gap-4">
                {/* IMAGE + CATEGORY */}
                {/* IMAGE + CATEGORY */}
<div className="flex flex-col items-start shrink-0">
  {m.imageBase64 && (
    <div className="w-20 h-20 overflow-hidden rounded-md bg-gray-100">
      <img
        src={m.imageBase64}
        className="w-full h-full object-cover object-top-left"
      />
    </div>
  )}
  <div className="self-start mt-2 px-2 py-1 bg-gray-200 rounded-full text-[10px] font-medium text-gray-700">
    {m.category}</div>
</div>

                {/* CONTENT */}
                <div className="flex flex-col justify-between w-full">
                  <h2 className="font-semibold text-lg line-clamp-2">{m.title}</h2>

                  {/* PROBABILITIES */}
                  {m.type === "yesno" && yesProb && (
  <div className="mt-1 space-y-1">
    <div className="text-sm flex justify-between text-blue-700">
      <span>YES</span>
      <span>{yesProb}%</span>
    </div>
    <div className="text-sm flex justify-between text-blue-700">
      <span>NO</span>
      <span>{100-yesProb}%</span>
    </div>
  </div>
)}
                  {m.type === "options" &&
                    topOptions.map((o) => (
                      <div key={o.id} className="text-sm flex justify-between text-blue-700">
                        <span>{o.name}</span>
                        <span>{total > 0 ? Math.round((o.votes / total) * 100) : 0}%</span>
                      </div>
                    ))}

                  <div className="text-xs text-gray-700">💰 {total} credits · 👥 {m.traders} traders</div>
                  {m.highestPayout && <div className="text-xs text-blue-700 font-medium">💸 {m.highestPayout}</div>}
                  
                  {m.closeTime && <div className="text-xs text-red-600">⏳ {formatTimeLeft(m.closeTime)}</div>}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* DOTS */}
      <div className="flex justify-center gap-2 mb-6">
        {carouselMarkets.map((_, i) => (
          <button key={i} onClick={() => goToSlide(i)} className={`h-2 rounded-full ${activeIndex === i ? "bg-blue-600 w-4" : "bg-gray-300 w-2"}`} />
        ))}
      </div>

      {/* ================= GRID ================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {markets.map((m) => {
          const total = (m.yes || 0) + (m.no || 0) + (m.options?.reduce((a, o) => a + o.votes, 0) || 0);
          const yesProb = m.type === "yesno" && total > 0 ? Math.round(((m.yes || 0) / total) * 100) : 0;
          const topOptions = m.type === "options" ? [...(m.options || [])].sort((a, b) => b.votes - a.votes).slice(0, 2) : [];

          return (
            <Link key={m.id} href={`/markets/${m.id}`} className="bg-white border rounded-lg shadow p-3">
 <div className="flex gap-3 items-start mb-1">
  {m.imageBase64 && (
    <div className="w-16 h-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
      <img
        src={m.imageBase64}
        className="w-full h-full object-cover object-top-left"
      />
    </div>
  )}

  <div className="flex flex-col">
    <h3 className="font-semibold text-sm line-clamp-2">
      {m.title}
    </h3>
    <div className="self-start mt-2 px-2 py-1 bg-gray-200 rounded-full text-[10px] font-medium text-gray-700">
  {m.category}
</div>
  </div>
</div>



             
              {m.type === "yesno" && yesProb && (
  <div className="mt-1 space-y-1">
    <div className="text-sm flex justify-between text-blue-700">
      <span>YES</span>
      <span>{yesProb}%</span>
    </div>
    <div className="text-sm flex justify-between text-blue-700">
      <span>NO</span>
      <span>{100-yesProb}%</span>
    </div>
  </div>
)}
              {m.type === "options" &&
                topOptions.map((o) => (
                  <div key={o.id} className="text-sm flex justify-between text-blue-700">
                    <span>{o.name}</span>
                    <span>{total > 0 ? Math.round((o.votes / total) * 100) : 0}%</span>
                  </div>
                ))}

              <div className="text-xs text-gray-700 mt-1">💰 {total} credits · 👥 {m.traders} traders</div>
              
{total === 0 ? (
  <div className="text-xs text-gray-500 italic">
    👀 No users yet · Be the first to place a bet
  </div>
) : (
  m.highestPayout && (
    <div className="text-xs text-blue-700 font-medium">
      💸 {m.highestPayout}
    </div>
  )
)}




              {m.closeTime && <div className="text-xs text-red-600">⏳ {formatTimeLeft(m.closeTime)}</div>}
            </Link>
          );
        })}
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
