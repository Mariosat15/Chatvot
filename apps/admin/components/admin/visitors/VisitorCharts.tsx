"use client";

/**
 * VisitorCharts — Orchestrates all analytics sub-chart components.
 * Receives full analytics data and delegates to specialised chart panels.
 */

import VisitorTrafficCharts from "./VisitorTrafficCharts";
import VisitorTechCharts from "./VisitorTechCharts";
import VisitorGeoCharts from "./VisitorGeoCharts";
import VisitorEngagementCharts from "./VisitorEngagementCharts";
import type { FullAnalytics } from "./visitor-types";

interface Props {
  analytics: FullAnalytics;
}

export default function VisitorCharts({ analytics }: Props) {
  return (
    <div className="space-y-6">
      {/* ── Traffic & Acquisition ────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Traffic & Acquisition
        </h3>
        <VisitorTrafficCharts
          visitsByTime={analytics.visitsByTime}
          trafficSources={analytics.trafficSources}
          topReferrers={analytics.topReferrers}
          topSearchQueries={analytics.topSearchQueries}
          utmCampaigns={analytics.utmCampaigns}
        />
      </div>

      {/* ── Technology & Devices ─────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Technology & Devices
        </h3>
        <VisitorTechCharts
          deviceBreakdown={analytics.deviceBreakdown}
          browserBreakdown={analytics.browserBreakdown}
          osBreakdown={analytics.osBreakdown}
          resolutions={analytics.resolutions}
        />
      </div>

      {/* ── Geography & Languages ────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Geography & Languages
        </h3>
        <VisitorGeoCharts
          topCountries={analytics.topCountries}
          topCities={analytics.topCities}
          languages={analytics.languages}
        />
      </div>

      {/* ── Engagement & Content ─────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Engagement & Content
        </h3>
        <VisitorEngagementCharts
          visitsByTime={analytics.visitsByTime}
          topPages={analytics.topPages}
          botStats={analytics.botStats}
          hourlyHeatmap={analytics.hourlyHeatmap}
        />
      </div>
    </div>
  );
}
