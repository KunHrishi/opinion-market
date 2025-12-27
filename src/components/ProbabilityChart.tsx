"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

interface YesNoSnapshot {
  createdAt: any;
  yes: number;
  no: number;
}

interface OptionSnapshot {
  createdAt: any;
  probabilities: Record<string, number>;
}

interface Props {
  marketId: string;
  type: "yesno" | "options";
}

export default function ProbabilityChart({ marketId, type }: Props) {
  const [history, setHistory] = useState<YesNoSnapshot[] | OptionSnapshot[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      const q = query(
        collection(db, "markets", marketId, "probabilityHistory"),
        orderBy("createdAt", "asc")
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setHistory(
          snap.docs.map((doc) => ({
            ...doc.data(),
          })) as YesNoSnapshot[] | OptionSnapshot[]
        );
      }
    };

    fetchHistory();

    // Optional: poll every 10 seconds
    const interval = setInterval(fetchHistory, 10000);
    return () => clearInterval(interval);
  }, [marketId]);

  if (history.length === 0) {
    return <p className="text-center text-gray-500">No probability history yet.</p>;
  }

  const labels = history.map((_, idx) => `Vote ${idx + 1}`);

  if (type === "yesno") {
    const yesNoHistory = history as YesNoSnapshot[];
    return (
      <div className="mb-6">
        <h2 className="font-semibold mb-2">Probability Over Time</h2>
        <Line
          data={{
            labels,
            datasets: [
              {
                label: "YES %",
                data: yesNoHistory.map((h) => h.yes),
                borderColor: "#22c55e",
                backgroundColor: "#22c55e33",
                tension: 0.3,
              },
              {
                label: "NO %",
                data: yesNoHistory.map((h) => h.no),
                borderColor: "#ef4444",
                backgroundColor: "#ef444433",
                tension: 0.3,
              },
            ],
          }}
          options={{
            responsive: true,
            plugins: { legend: { position: "top" } },
            scales: {
              y: { min: 0, max: 100, title: { display: true, text: "Probability %" } },
              x: { title: { display: true, text: "Votes" } },
            },
          }}
        />
      </div>
    );
  }

  // Option market
  const optionHistory = history as OptionSnapshot[];
  const optionNames = Object.keys(optionHistory[0].probabilities);

  return (
    <div className="mb-6">
      <h2 className="font-semibold mb-2">Probability Over Time</h2>
      <Line
        data={{
          labels,
          datasets: optionNames.map((name, idx) => ({
            label: `${name} %`,
            data: optionHistory.map((h) => h.probabilities[name]),
            borderColor: `hsl(${(idx * 60) % 360}, 70%, 50%)`,
            backgroundColor: `hsl(${(idx * 60) % 360}, 70%, 50%, 0.3)`,
            tension: 0.3,
          })),
        }}
        options={{
          responsive: true,
          plugins: { legend: { position: "top" } },
          scales: {
            y: { min: 0, max: 100, title: { display: true, text: "Probability %" } },
            x: { title: { display: true, text: "Votes" } },
          },
        }}
      />
    </div>
  );
}
