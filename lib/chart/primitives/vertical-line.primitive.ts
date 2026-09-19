/**
 * Vertical Line Primitive
 * Draws a vertical line at a specific time
 */

import {
  ISeriesPrimitivePaneView,
  SeriesPrimitivePaneViewZOrder,
  Time,
} from "lightweight-charts";
import {
  BasePrimitive,
  BasePaneRenderer,
  BasePaneView,
  DrawingRenderData,
} from "./base-primitive";
import {
  VerticalLineOptions,
  ChartPoint,
  ScreenPoint,
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from "./types";

// ============================================
// VERTICAL LINE RENDERER
// ============================================

class VerticalLineRenderer extends BasePaneRenderer {
  protected drawImpl(
    ctx: CanvasRenderingContext2D,
    hpr: number,
    vpr: number,
    size: { width: number; height: number },
  ): void {
    const data = this._data!;
    if (data.points.length === 0) return;

    const x = data.points[0].x * hpr;
    const options = data.options as VerticalLineOptions;

    // Set line style
    ctx.strokeStyle = options.color || "#2962ff";
    ctx.lineWidth = (options.lineWidth || 2) * hpr;
    ctx.lineCap = "round";

    // Set dash pattern
    const dash = this.getLineDash(options.lineStyle, hpr);
    ctx.setLineDash(dash);

    // Draw vertical line
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size.height);
    ctx.stroke();

    // Reset dash
    ctx.setLineDash([]);

    // Draw selection/hover state
    if (data.isSelected || data.isHovered) {
      this.drawAnchor(ctx, data, hpr, vpr, size.height);
    }
  }

  private drawAnchor(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
    canvasHeight: number,
  ): void {
    const x = data.points[0].x * hpr;
    const options = data.options;

    const y = canvasHeight / 2;
    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x, y, anchorRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = options.color || "#2962ff";
    ctx.lineWidth = borderWidth;
    ctx.stroke();

    if (data.isSelected) {
      ctx.fillStyle = options.color || "#2962ff";
      ctx.beginPath();
      ctx.arc(x, y, anchorRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ============================================
// VERTICAL LINE PANE VIEW
// ============================================

class VerticalLinePaneView extends BasePaneView {
  constructor(source: VerticalLinePrimitive) {
    super(source, new VerticalLineRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "normal";
  }
}

// ============================================
// VERTICAL LINE PRIMITIVE
// ============================================

export class VerticalLinePrimitive extends BasePrimitive<VerticalLineOptions> {
  constructor(options: Partial<VerticalLineOptions> & { time: Time }) {
    const fullOptions: VerticalLineOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      ...options,
      id: options.id || `vline_${Date.now()}`,
      time: options.time,
      showTime: options.showTime ?? false,
    } as VerticalLineOptions;

    super("vertical-line", fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new VerticalLinePaneView(this)];
  }

  getRenderData(): DrawingRenderData {
    const x = this.timeToX(this._options.time);
    const points: ScreenPoint[] = x !== null ? [{ x, y: 0 }] : [];

    const size = this.getCanvasSize();

    return {
      points,
      chartPoints: [{ time: this._options.time, price: 0 }],
      options: this._options,
      isSelected: this._isSelected,
      isHovered: this._isHovered,
      canvasWidth: size.width,
      canvasHeight: size.height,
    };
  }

  // ============================================
  // INTERACTION
  // ============================================

  hitTest(point: ScreenPoint): boolean {
    if (!this._options.visible) return false;

    const x = this.timeToX(this._options.time);
    if (x === null) return false;

    const threshold = 10;
    return Math.abs(point.x - x) < threshold;
  }

  getAnchorPoints(): ScreenPoint[] {
    const x = this.timeToX(this._options.time);
    if (x === null) return [];

    const size = this.getCanvasSize();
    return [{ x, y: size.height / 2 }];
  }

  getAnchorAtPoint(
    point: ScreenPoint,
    threshold: number = 15,
  ): AnchorPosition | null {
    const x = this.timeToX(this._options.time);
    if (x === null) return null;

    const size = this.getCanvasSize();
    const anchor = { x, y: size.height / 2 };

    if (this.distanceToPoint(point, anchor) < threshold) {
      return "center";
    }

    return null;
  }

  moveAnchor(_anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;
    this._options.time = point.time;
    this.requestUpdate();
  }

  move(_deltaPrice: number, _deltaTime: number): void {
    if (this._options.locked) return;
    // Vertical lines move by time, not price
    // For now, just request update (time-based movement is complex)
    this.requestUpdate();
  }

  moveByTime(newTime: Time): void {
    if (this._options.locked) return;
    this._options.time = newTime;
    this.requestUpdate();
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setTime(time: Time): void {
    this._options.time = time;
    this.requestUpdate();
  }

  getTime(): Time {
    return this._options.time;
  }
}
