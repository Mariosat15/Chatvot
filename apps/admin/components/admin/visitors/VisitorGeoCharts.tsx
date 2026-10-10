"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe, MapPin, Languages } from "lucide-react";
import type {
  CountryEntry,
  CityEntry,
  LanguageEntry,
} from "./visitor-types";

const COLORS = [
  "#6366f1", "#22d3ee", "#f59e0b", "#ef4444",
  "#10b981", "#8b5cf6", "#ec4899", "#14b8a6",
  "#3b82f6", "#a855f7",
];

const tooltipStyle = {
  contentStyle: {
    background: "#1f2937",
    border: "1px solid #374151",
    borderRadius: "8px",
    fontSize: "12px",
  },
  labelStyle: { color: "#9ca3af" },
};

interface Props {
  topCountries: CountryEntry[];
  topCities: CityEntry[];
  languages: LanguageEntry[];
}

export default function VisitorGeoCharts({
  topCountries,
  topCities,
  languages,
}: Props) {
  return (
    <div className="space-y-4">
      {/* ── Top Countries (Horizontal Bar) ────────────────────────────── */}
      <Card className="bg-gray-800/50 border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
            <Globe className="h-4 w-4 text-blue-400" />
            Top Countries
            <span className="text-[10px] text-gray-500 ml-auto">
              {topCountries.length} countries
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {topCountries.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              No country data
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={Math.min(topCountries.length * 28, 400)}>
              <BarChart
                data={topCountries.slice(0, 15)}
                layout="vertical"
                margin={{ left: 50 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis
                  type="number"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                />
                <YAxis
                  type="category"
                  dataKey="country"
                  stroke="#6b7280"
                  tick={{ fontSize: 10, fill: "#9ca3af" }}
                  width={50}
                />
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value: number, _: string, props: { payload: CountryEntry }) => [
                    `${value} visits (${props.payload.percentage}%)`,
                    "Visits",
                  ]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {topCountries.slice(0, 15).map((_, i) => (
                    <Cell
                      key={i}
                      fill={COLORS[i % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Row: Cities + Languages ───────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Cities */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-pink-400" />
              Top Cities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {topCities.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No city data
              </p>
            ) : (
              <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
                {topCities.map((c) => {
                  const maxCity = Math.max(
                    ...topCities.map((x) => x.count),
                    1,
                  );
                  return (
                    <div
                      key={`${c.city}-${c.country}`}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-gray-300 truncate w-[120px]">
                        {c.city}
                      </span>
                      <span className="text-gray-500 text-[10px] w-[30px]">
                        {c.country}
                      </span>
                      <div className="flex-1 bg-gray-900 rounded-full h-3 overflow-hidden">
                        <div
                          className="bg-pink-500 h-full rounded-full"
                          style={{
                            width: `${(c.count / maxCity) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-gray-400 font-mono w-[36px] text-right">
                        {c.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Languages */}
        <Card className="bg-gray-800/50 border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-300 flex items-center gap-1.5">
              <Languages className="h-4 w-4 text-teal-400" />
              Languages
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {languages.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-8">
                No language data
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <ResponsiveContainer width="45%" height={180}>
                  <PieChart>
                    <Pie
                      data={languages}
                      dataKey="count"
                      nameKey="language"
                      cx="50%"
                      cy="50%"
                      innerRadius={35}
                      outerRadius={70}
                      strokeWidth={1}
                      stroke="#1f2937"
                    >
                      {languages.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1 max-h-[180px] overflow-y-auto">
                  {languages.map((l, i) => (
                    <div
                      key={l.language}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="text-gray-300 truncate flex-1">
                        {l.language}
                      </span>
                      <span className="text-gray-400 font-mono text-[10px]">
                        {l.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
