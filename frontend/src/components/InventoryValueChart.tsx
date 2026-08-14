import { useState } from "react";
import type { ValuationRow } from "../api/types";

const BAR_HEIGHT = 22; // <= 24px per the bar/column spec
const BAND_HEIGHT = 40;
const RADIUS = 4;
const LABEL_WIDTH = 84;
// The highest-value bar always reaches the full plot width (see `width`
// below), so this is the ONLY room the direct value label has to its right.
// Too small and the label gets clipped by the SVG viewBox instead of
// wrapping or overflowing -- sized for values up to "1,234,567 cr".
const CHART_PADDING_RIGHT = 100;
const SVG_WIDTH = 480;

/** Right-rounded, left-square bar path -- a horizontal bar grows from a fixed
 * left baseline, so only the data-end (right) gets the 4px radius. */
function roundedBarPath(width: number, height: number, radius: number): string {
  if (width <= 0) return "M0,0 Z";
  const r = Math.min(radius, height / 2, width / 2);
  return [
    "M0,0",
    `H${width - r}`,
    `A${r},${r} 0 0 1 ${width},${r}`,
    `V${height - r}`,
    `A${r},${r} 0 0 1 ${width - r},${height}`,
    "H0",
    "Z",
  ].join(" ");
}

/** Hand-rolled horizontal bar chart, not a charting library -- a couple of
 * bars driven by `reports/inventory-valuation/` didn't justify a new
 * dependency, and plain SVG keeps this easy to explain end to end. */
export function InventoryValueChart({ data }: { data: ValuationRow[] }) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((row) => Number(row.total_value ?? 0)), 1);
  const plotWidth = SVG_WIDTH - LABEL_WIDTH - CHART_PADDING_RIGHT;
  const svgHeight = data.length * BAND_HEIGHT;

  return (
    <div style={{ position: "relative" }}>
      <svg
        width="100%"
        viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
        role="img"
        aria-label={`Inventory value by base: ${data
          .map((row) => `${row.base__name}, ${Number(row.total_value).toLocaleString()} credits`)
          .join("; ")}`}
      >
        {data.map((row, i) => {
          const value = Number(row.total_value ?? 0);
          const width = maxValue > 0 ? (value / maxValue) * plotWidth : 0;
          const y = i * BAND_HEIGHT + (BAND_HEIGHT - BAR_HEIGHT) / 2;
          const isHovered = hovered === i;

          return (
            <g key={row.base__code}>
              <text
                x={LABEL_WIDTH - 10}
                y={y + BAR_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--color-text-muted)"
              >
                {row.base__code}
              </text>
              <g transform={`translate(${LABEL_WIDTH}, ${y})`}>
                <path
                  d={roundedBarPath(width, BAR_HEIGHT, RADIUS)}
                  fill="var(--color-holo)"
                  opacity={isHovered ? 1 : 0.85}
                  style={{ transition: "opacity 0.15s ease" }}
                />
                <text x={width + 6} y={BAR_HEIGHT / 2} dominantBaseline="middle" fontSize="11" fill="var(--color-text)">
                  {value.toLocaleString()} cr
                </text>
                {/* Hit target bigger than the painted bar -- covers the whole row. */}
                <rect
                  x={-LABEL_WIDTH}
                  y={-((BAND_HEIGHT - BAR_HEIGHT) / 2)}
                  width={plotWidth + LABEL_WIDTH + CHART_PADDING_RIGHT}
                  height={BAND_HEIGHT}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${row.base__name}: ${value.toLocaleString()} credits`}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(i)}
                  onBlur={() => setHovered(null)}
                />
              </g>
            </g>
          );
        })}
      </svg>
      {hovered !== null && (
        <div
          className="chart-tooltip"
          role="status"
          style={{
            top: `${((hovered * BAND_HEIGHT + BAND_HEIGHT / 2) / svgHeight) * 100}%`,
            left: `${(LABEL_WIDTH / SVG_WIDTH) * 100}%`,
          }}
        >
          <strong>{Number(data[hovered].total_value).toLocaleString()} cr</strong>
          <span>{data[hovered].base__name}</span>
        </div>
      )}
    </div>
  );
}
