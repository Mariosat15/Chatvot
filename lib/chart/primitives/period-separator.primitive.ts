/**
 * Period Separator Primitive
 * Draws faded vertical lines at session/day boundaries
 * Automatically calculates boundaries based on the current timeframe
 */

import {
  ISeriesPrimitive,
  ISeriesPrimitivePaneView,
  ISeriesPrimitivePaneRenderer,
  SeriesPrimitivePaneViewZOrder,
  Time,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

// ============================================
// TYPES
// ============================================

export interface PeriodSeparatorOptions {
  color: string;
  lineWidth: number;
  lineStyle: "solid" | "dashed" | "dotted";
  opacity: number;
  separatorType: "auto" | "hour" | "day" | "week" | "month";
}

export const DEFAULT_PERIOD_SEPARATOR_OPTIONS: PeriodSeparatorOptions = {
  color: "#363a45",
  lineWidth: 1,
  lineStyle: "dashed",
  opacity: 0.5,
  separatorType: "auto",
};

// ============================================
// PERIOD SEPARATOR RENDERER
// ============================================

class PeriodSeparatorRenderer implements ISeriesPrimitivePaneRenderer {
  private _data: {
    timestamps: number[];
    options: PeriodSeparatorOptions;
    timeToX: (time: number) => number | null;
    canvasWidth: number;
    canvasHeight: number;
  } | null = null;

  update(data: {
    timestamps: number[];
    options: PeriodSeparatorOptions;
    timeToX: (time: number) => number | null;
    canvasWidth: number;
    canvasHeight: number;
  }): void {
    this._data = data;
  }

  draw(target: any): void {
    if (!this._data || this._data.timestamps.length === 0) return;

    const ctx = target.context as CanvasRenderingContext2D;
    if (!ctx) return;

    const hpr = target.pixelRatio || 1;
    const vpr = target.pixelRatio || 1;
    const { timestamps, options, timeToX, canvasHeight } = this._data;

    ctx.save();

    // Set line style
    ctx.strokeStyle = options.color;
    ctx.lineWidth = options.lineWidth * hpr;
    ctx.globalAlpha = options.opacity;

    // Set dash pattern
    if (options.lineStyle === "dashed") {
      ctx.setLineDash([6 * hpr, 4 * hpr]);
    } else if (options.lineStyle === "dotted") {
      ctx.setLineDash([2 * hpr, 2 * hpr]);
    } else {
      ctx.setLineDash([]);
    }

    // Draw vertical lines at each timestamp
    for (const timestamp of timestamps) {
      const x = timeToX(timestamp);
      if (x !== null && x >= 0) {
        const scaledX = x * hpr;
        ctx.beginPath();
        ctx.moveTo(scaledX, 0);
        ctx.lineTo(scaledX, canvasHeight * vpr);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}

// ============================================
// PERIOD SEPARATOR PANE VIEW
// ============================================

class PeriodSeparatorPaneView implements ISeriesPrimitivePaneView {
  private _source: PeriodSeparatorPrimitive;
  private _renderer: PeriodSeparatorRenderer;

  constructor(source: PeriodSeparatorPrimitive) {
    this._source = source;
    this._renderer = new PeriodSeparatorRenderer();
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "bottom"; // Draw behind candles
  }

  renderer(): ISeriesPrimitivePaneRenderer {
    this._renderer.update(this._source.getRenderData());
    return this._renderer;
  }
}

// ============================================
// PERIOD SEPARATOR PRIMITIVE
// ============================================

export class PeriodSeparatorPrimitive implements ISeriesPrimitive<Time> {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<"Candlestick"> | null = null;
  private _paneViews: PeriodSeparatorPaneView[] = [];
  private _options: PeriodSeparatorOptions;
  private _timeframe: string = "1";
  private _visible: boolean = true;
  private _requestUpdate?: () => void;
  private _cachedTimestamps: number[] = [];
  private _lastVisibleRange: { from: number; to: number } | null = null;

  constructor(options: Partial<PeriodSeparatorOptions> = {}) {
    this._options = { ...DEFAULT_PERIOD_SEPARATOR_OPTIONS, ...options };
    this._paneViews = [new PeriodSeparatorPaneView(this)];
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  attach(chart: IChartApi, series: ISeriesApi<"Candlestick">): void {
    this._chart = chart;
    this._series = series;

    // Subscribe to visible range changes
    this._chart.timeScale().subscribeVisibleTimeRangeChange(() => {
      this.updateTimestamps();
      this._requestUpdate?.();
    });
  }

  detach(): void {
    this._chart = null;
    this._series = null;
    this._cachedTimestamps = [];
  }

  updateAllViews(): void {
    this._paneViews.forEach((view) => view.renderer());
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this._visible ? this._paneViews : [];
  }

  requestUpdate(): void {
    this._requestUpdate?.();
  }

  attached({ requestUpdate }: { requestUpdate: () => void }): void {
    this._requestUpdate = requestUpdate;
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setTimeframe(tf: string): void {
    if (this._timeframe !== tf) {
      this._timeframe = tf;
      this._cachedTimestamps = [];
      this._lastVisibleRange = null;
      this.updateTimestamps();
      this._requestUpdate?.();
    }
  }

  setVisible(visible: boolean): void {
    if (this._visible !== visible) {
      this._visible = visible;
      this._requestUpdate?.();
    }
  }

  setOptions(options: Partial<PeriodSeparatorOptions>): void {
    this._options = { ...this._options, ...options };
    this._requestUpdate?.();
  }

  isVisible(): boolean {
    return this._visible;
  }

  // ============================================
  // TIMESTAMP CALCULATION
  // ============================================

  private updateTimestamps(): void {
    if (!this._chart || !this._visible) {
      this._cachedTimestamps = [];
      return;
    }

    const visibleRange = this._chart.timeScale().getVisibleRange();
    if (!visibleRange) {
      this._cachedTimestamps = [];
      return;
    }

    const from = typeof visibleRange.from === "number" ? visibleRange.from : 0;
    const to = typeof visibleRange.to === "number" ? visibleRange.to : 0;

    // Check if we need to recalculate
    if (
      this._lastVisibleRange &&
      Math.abs(this._lastVisibleRange.from - from) < 60 &&
      Math.abs(this._lastVisibleRange.to - to) < 60
    ) {
      return;
    }

    this._lastVisibleRange = { from, to };
    this._cachedTimestamps = this.calculateSeparatorTimestamps(from, to);
  }

  private calculateSeparatorTimestamps(from: number, to: number): number[] {
    const timestamps: number[] = [];
    const separatorType = this.getSeparatorType();

    // Extend range to catch edge separators
    const extendedFrom = from - this.getIntervalSeconds(separatorType);
    const extendedTo = to + this.getIntervalSeconds(separatorType);

    let current = this.getNextBoundary(extendedFrom, separatorType);

    while (current <= extendedTo) {
      if (current >= from && current <= to) {
        timestamps.push(current);
      }
      current = this.getNextBoundary(current + 1, separatorType);
    }

    return timestamps;
  }

  private getSeparatorType(): "hour" | "day" | "week" | "month" {
    if (this._options.separatorType !== "auto") {
      return this._options.separatorType === "hour"
        ? "hour"
        : this._options.separatorType === "day"
          ? "day"
          : this._options.separatorType === "week"
            ? "week"
            : "month";
    }

    // Auto-select based on timeframe
    const tf = this._timeframe;

    if (tf === "1" || tf === "5") {
      return "hour"; // Hourly separators for 1m/5m
    } else if (tf === "15" || tf === "30") {
      return "day"; // Daily separators for 15m/30m
    } else if (tf === "60" || tf === "240") {
      return "day"; // Daily separators for 1h/4h
    } else if (tf === "1D" || tf === "D") {
      return "week"; // Weekly separators for daily
    } else if (tf === "1W" || tf === "W") {
      return "month"; // Monthly separators for weekly
    }

    return "day"; // Default to daily
  }

  private getIntervalSeconds(type: "hour" | "day" | "week" | "month"): number {
    switch (type) {
      case "hour":
        return 3600;
      case "day":
        return 86400;
      case "week":
        return 604800;
      case "month":
        return 2592000; // ~30 days
    }
  }

  private getNextBoundary(
    timestamp: number,
    type: "hour" | "day" | "week" | "month",
  ): number {
    const date = new Date(timestamp * 1000);

    switch (type) {
      case "hour":
        // Next hour boundary
        date.setUTCMinutes(0, 0, 0);
        if (date.getTime() / 1000 <= timestamp) {
          date.setUTCHours(date.getUTCHours() + 1);
        }
        break;

      case "day":
        // Next day boundary (00:00 UTC)
        date.setUTCHours(0, 0, 0, 0);
        if (date.getTime() / 1000 <= timestamp) {
          date.setUTCDate(date.getUTCDate() + 1);
        }
        break;

      case "week":
        // Next Monday 00:00 UTC
        date.setUTCHours(0, 0, 0, 0);
        const day = date.getUTCDay();
        const daysUntilMonday = day === 0 ? 1 : 8 - day;
        if (date.getTime() / 1000 <= timestamp) {
          date.setUTCDate(date.getUTCDate() + daysUntilMonday);
        }
        break;

      case "month":
        // Next month 1st 00:00 UTC
        date.setUTCDate(1);
        date.setUTCHours(0, 0, 0, 0);
        if (date.getTime() / 1000 <= timestamp) {
          date.setUTCMonth(date.getUTCMonth() + 1);
        }
        break;
    }

    return Math.floor(date.getTime() / 1000);
  }

  // ============================================
  // RENDER DATA
  // ============================================

  getRenderData(): {
    timestamps: number[];
    options: PeriodSeparatorOptions;
    timeToX: (time: number) => number | null;
    canvasWidth: number;
    canvasHeight: number;
  } {
    const timeToX = (time: number): number | null => {
      if (!this._chart) return null;
      try {
        const coord = this._chart.timeScale().timeToCoordinate(time as Time);
        return coord;
      } catch {
        return null;
      }
    };

    let canvasWidth = 800;
    let canvasHeight = 600;

    if (this._chart) {
      try {
        const chartElement = (this._chart as any).chartElement?.();
        if (chartElement) {
          canvasWidth = chartElement.clientWidth || 800;
          canvasHeight = chartElement.clientHeight || 600;
        }
      } catch {}
    }

    return {
      timestamps: this._cachedTimestamps,
      options: this._options,
      timeToX,
      canvasWidth,
      canvasHeight,
    };
  }
}
