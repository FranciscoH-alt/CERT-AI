/**
 * Line chart showing skill rating trend over recent sessions.
 * Uses Chart.js via react-chartjs-2.
 */

"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler
);

interface TrendChartProps {
  sessions: {
    started_at: string;
    skill_after: number | null;
    skill_before: number | null;
  }[];
}

export default function TrendChart({ sessions }: TrendChartProps) {
  // Reverse so oldest is first (left to right timeline)
  const sorted = [...sessions].reverse();

  const labels = sorted.map((s, i) => {
    const date = new Date(s.started_at);
    return i === 0 || i === sorted.length - 1
      ? date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "";
  });

  const data = {
    labels,
    datasets: [
      {
        label: "Skill Rating",
        data: sorted.map((s) => s.skill_after ?? s.skill_before ?? 1000),
        borderColor: "rgba(59, 130, 246, 0.8)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointRadius: 4,
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { size: 10 },
          color: "rgba(156, 163, 175, 0.6)",
        },
      },
      y: {
        min: 800,
        max: 1300,
        grid: { color: "rgba(156, 163, 175, 0.1)" },
        ticks: {
          font: { size: 10 },
          color: "rgba(156, 163, 175, 0.6)",
          stepSize: 100,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) =>
            `Skill: ${Math.round(context.raw as number)}`,
        },
      },
    },
  };

  return (
    <div className="aspect-[4/3]">
      <Line data={data} options={options} />
    </div>
  );
}
