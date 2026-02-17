/**
 * Radar chart showing skill ratings across exam domains.
 * Uses Chart.js via react-chartjs-2.
 */

"use client";

import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
} from "chart.js";
import { Radar } from "react-chartjs-2";
import type { DomainSkill } from "@/lib/api";

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

interface DomainChartProps {
  domains: DomainSkill[];
}

export default function DomainChart({ domains }: DomainChartProps) {
  // Shorten domain names for chart labels
  const labels = domains.map((d) =>
    d.domain_name.replace(/\s*\(\d+-\d+%\)/, "").substring(0, 25)
  );

  const data = {
    labels,
    datasets: [
      {
        label: "Skill Rating",
        data: domains.map((d) => d.skill_rating),
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        borderColor: "rgba(59, 130, 246, 0.8)",
        borderWidth: 2,
        pointBackgroundColor: "rgba(59, 130, 246, 1)",
        pointBorderColor: "#fff",
        pointBorderWidth: 1,
        pointRadius: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
      r: {
        beginAtZero: false,
        min: 700,
        max: 1300,
        ticks: {
          stepSize: 100,
          display: false,
        },
        grid: {
          color: "rgba(156, 163, 175, 0.15)",
        },
        pointLabels: {
          font: { size: 10 },
          color: "rgba(156, 163, 175, 0.8)",
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: { raw: unknown }) =>
            `Rating: ${Math.round(context.raw as number)}`,
        },
      },
    },
  };

  return (
    <div className="aspect-square max-h-64">
      <Radar data={data} options={options} />
    </div>
  );
}
