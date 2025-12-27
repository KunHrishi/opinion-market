import Link from "next/link";

/* ---------- Types ---------- */
interface Option {
  id: string;
  name: string;
  votes: number;
}

interface Market {
  id: string;
  title: string;
  summary?: string;
  type: "yesno" | "options";
  yes?: number;
  no?: number;
  options?: Option[];
  imageBase64?: string | null;
  category?: string;
  traders?: number;
  highestPayout?: string | null;
  closeTime?: any;
}

/* ---------- Helpers ---------- */
const categoryColors: Record<string, string> = {
  Politics: "bg-red-100 text-red-700",
  Sports: "bg-green-100 text-green-700",
  Crypto: "bg-yellow-100 text-yellow-700",
  Tech: "bg-blue-100 text-blue-700",
  Trending: "bg-gray-200 text-gray-700",
  Others: "bg-gray-200 text-gray-700",
};

const formatTimeLeft = (closeTime: any) => {
  if (!closeTime) return null;
  const diff = closeTime.toDate().getTime() - Date.now();
  if (diff <= 0) return "Closed";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `Closes in ${h}h ${m}m` : `Closes in ${m}m`;
};

/* ---------- Component ---------- */
export default function MarketCard({ m }: { m: Market }) {
  const total =
    (m.yes || 0) +
    (m.no || 0) +
    (m.options?.reduce((a, o) => a + o.votes, 0) || 0);

  const yesProb =
    m.type === "yesno" && total > 0
      ? Math.round(((m.yes || 0) / total) * 100)
      : 0;

  const topOptions =
    m.type === "options"
      ? [...(m.options || [])]
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 2)
      : [];

  return (
    <Link
      href={`/markets/${m.id}`}
      className="bg-white border rounded-lg shadow hover:shadow-md transition p-3 block"
    >
      {/* IMAGE + TITLE + CATEGORY */}
      <div className="flex gap-3 items-start mb-1">
        {m.imageBase64 && (
          <div className="w-16 h-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
            <img
              src={m.imageBase64}
              alt={m.title}
              className="w-full h-full object-cover object-top-left"
            />
          </div>
        )}

        <div className="flex flex-col">
          <h3 className="font-semibold text-sm line-clamp-2">
            {m.title}
          </h3>

          {m.category && (
            <div
              className={`self-start mt-2 px-2 py-1 rounded-full text-[10px] font-medium ${
                categoryColors[m.category] || categoryColors.Trending
              }`}
            >
              {m.category}
            </div>
          )}
        </div>
      </div>

      {/* PROBABILITIES */}
      {m.type === "yesno" && (
        <div className="text-sm mt-1">
          YES {yesProb}% · NO {100 - yesProb}%
        </div>
      )}

      {m.type === "options" &&
        topOptions.map((o) => (
          <div key={o.id} className="text-sm flex justify-between text-blue-700">
            <span>{o.name}</span>
            <span>
              {total > 0 ? Math.round((o.votes / total) * 100) : 0}%
            </span>
          </div>
        ))}

      {/* FOOTER */}
      <div className="text-xs text-gray-700 mt-1">
        💰 {total} credits · 👥 {m.traders ?? 0} traders
      </div>

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

      {m.closeTime && (
        <div className="text-xs text-red-600">
          ⏳ {formatTimeLeft(m.closeTime)}
        </div>
      )}
    </Link>
  );
}
