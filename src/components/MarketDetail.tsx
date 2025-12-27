"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MarketDetailProps {
  title: string;
  yes: number;
  no: number;
  onBack: () => void;
}

export default function MarketDetail({ title, yes, no, onBack }: MarketDetailProps) {
  const data = {
    labels: ["YES", "NO"],
    datasets: [
      {
        label: "Votes",
        data: [yes, no],
        backgroundColor: ["#22c55e", "#ef4444"]
      }
    ]
  };

  return (
    <div className="p-8 max-w-md mx-auto">
      <button
        className="mb-4 px-3 py-1 bg-gray-300 rounded hover:bg-gray-400"
        onClick={onBack}
      >
        ← Back
      </button>
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <Bar data={data} />
    </div>
  );
}
