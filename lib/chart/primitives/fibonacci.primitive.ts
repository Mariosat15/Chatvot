/**
 * Fibonacci Retracement Primitive
 * Draws Fibonacci retracement levels between two points
 */

import {
  ISeriesPrimitivePaneView,
  SeriesPrimitivePaneViewZOrder,
} from "lightweight-charts";
import {
  BasePrimitive,
  BasePaneRenderer,
  BasePaneView,
  DrawingRenderData,
} from "./base-primitive";
import {
  FibonacciOptions,
  ChartPoint,
  ScreenPoint,
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
  DEFAULT_FIBONACCI_LEVELS,
  FIBONACCI_COLORS,
} from "./types";

// ============================================
// FIBONACCI RENDERER
// ============================================

class FibonacciRenderer extends BasePaneRenderer {
  protected drawImpl(
    ctx: CanvasRenderingContext2D,
    hpr: number,
    vpr: number,
    size: { width: number; height: number },
  ): void {
    const data = this._data!;
    if (data.points.length < 2) return;

    const [p1, p2] = data.points;
    const [cp1, cp2] = data.chartPoints;
    const options = data.options as FibonacciOptions;

    const y1 = p1.y * vpr;
    const y2 = p2.y * vpr;
    const price1 = cp1?.price ?? 0;
    const price2 = cp2?.price ?? 0;
    const priceRange = price2 - price1;

    // Draw background fill between 0 and 1 levels
    ctx.globalAlpha = 0.05;
    ctx.fillStyle = options.color || "#2962ff";
    ctx.fillRect(0, Math.min(y1, y2), size.width, Math.abs(y2 - y1));
    ctx.globalAlpha = 1;

    // Draw each Fibonacci level
    const levels = options.levels || DEFAULT_FIBONACCI_LEVELS;

    levels.forEach((level) => {
      const levelY = y1 + (y2 - y1) * level;
      const levelPrice = options.reverse
        ? price2 - priceRange * level
        : price1 + priceRange * level;

      const levelColor =
        options.levelColors?.[level] ||
        FIBONACCI_COLORS[level] ||
        options.color ||
        "#2962ff";

      // Draw level line
      ctx.strokeStyle = levelColor;
      ctx.lineWidth = (level === 0 || level === 1 ? 2 : 1) * hpr;
      ctx.setLineDash(level === 0.5 ? [4 * hpr, 4 * hpr] : []);

      ctx.beginPath();
      ctx.moveTo(0, levelY);
      ctx.lineTo(size.width, levelY);
      ctx.stroke();

      // Draw level label
      if (options.showLabels !== false) {
        this.drawLevelLabel(
          ctx,
          levelY,
          level,
          levelPrice,
          levelColor,
          hpr,
          vpr,
          options.showPrices,
        );
      }
    });

    ctx.setLineDash([]);

    // Draw trend line between points
    ctx.strokeStyle = options.color || "#2962ff";
    ctx.lineWidth = 2 * hpr;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(p1.x * hpr, y1);
    ctx.lineTo(p2.x * hpr, y2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Draw selection/hover state
    if (data.isSelected || data.isHovered) {
      this.drawAnchors(ctx, data, hpr, vpr);
    }
  }

  private drawLevelLabel(
    ctx: CanvasRenderingContext2D,
    y: number,
    level: number,
    price: number,
    color: string,
    hpr: number,
    vpr: number,
    showPrice?: boolean,
  ): void {
    const fontSize = 11 * hpr;
    ctx.font = `${fontSize}px Arial`;

    const levelText = `${(level * 100).toFixed(1)}%`;
    const priceText = showPrice ? ` (${price.toFixed(5)})` : "";
    const text = levelText + priceText;

    const textWidth = ctx.measureText(text).width;
    const padding = 4 * hpr;
    const labelHeight = 16 * vpr;
    const x = 8 * hpr;

    // Draw background
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.beginPath();
    ctx.roundRect(
      x,
      y - labelHeight / 2,
      textWidth + padding * 2,
      labelHeight,
      2 * hpr,
    );
    ctx.fill();

    // Draw text
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + padding, y);
  }

  private drawAnchors(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
  ): void {
    const [p1, p2] = data.points;
    const options = data.options;

    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;

    [
      { x: p1.x * hpr, y: p1.y * vpr },
      { x: p2.x * hpr, y: p2.y * vpr },
    ].forEach((p) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = options.color || "#2962ff";
      ctx.lineWidth = borderWidth;
      ctx.stroke();

      if (data.isSelected) {
        ctx.fillStyle = options.color || "#2962ff";
        ctx.beginPath();
        ctx.arc(p.x, p.y, anchorRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }
}

// ============================================
// FIBONACCI PANE VIEW
// ============================================

class FibonacciPaneView extends BasePaneView {
  constructor(source: FibonacciPrimitive) {
    super(source, new FibonacciRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "bottom";
  }
}

// ============================================
// FIBONACCI PRIMITIVE
// ============================================

export class FibonacciPrimitive extends BasePrimitive<FibonacciOptions> {
  constructor(
    options: Partial<FibonacciOptions> & {
      startPoint: ChartPoint;
      endPoint: ChartPoint;
    },
  ) {
    const fullOptions: FibonacciOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      ...options,
      id: options.id || `fib_${Date.now()}`,
      startPoint: options.startPoint,
      endPoint: options.endPoint,
      levels: options.levels || DEFAULT_FIBONACCI_LEVELS,
      showLabels: options.showLabels ?? true,
      showPrices: options.showPrices ?? true,
      reverse: options.reverse ?? false,
    } as FibonacciOptions;

    super("fibonacci", fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new FibonacciPaneView(this)];
  }

  getRenderData(): DrawingRenderData {
    const startScreen = this.toScreen(this._options.startPoint);
    const endScreen = this.toScreen(this._options.endPoint);

    const points: ScreenPoint[] = [];
    if (startScreen) points.push(startScreen);
    if (endScreen) points.push(endScreen);

    const size = this.getCanvasSize();

    return {
      points,
      chartPoints: [this._options.startPoint, this._options.endPoint],
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

    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);

    if (!p1 || !p2) return false;

    const threshold = 10;

    // Check if near any Fibonacci level line
    const levels = this._options.levels || DEFAULT_FIBONACCI_LEVELS;
    for (const level of levels) {
      const levelY = p1.y + (p2.y - p1.y) * level;
      if (Math.abs(point.y - levelY) < threshold) {
        return true;
      }
    }

    // Check if near the trend line
    if (this.distanceToSegment(point, p1, p2) < threshold) {
      return true;
    }

    return false;
  }

  getAnchorPoints(): ScreenPoint[] {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);

    if (!p1 || !p2) return [];

    return [p1, p2];
  }

  getAnchorAtPoint(
    point: ScreenPoint,
    threshold: number = 15,
  ): AnchorPosition | null {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);

    if (p1 && this.distanceToPoint(point, p1) < threshold) return "start";
    if (p2 && this.distanceToPoint(point, p2) < threshold) return "end";

    return null;
  }

  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;

    switch (anchor) {
      case "start":
        this._options.startPoint = point;
        break;
      case "end":
        this._options.endPoint = point;
        break;
    }

    this.requestUpdate();
  }

  move(deltaPrice: number, _deltaTime: number): void {
    if (this._options.locked) return;

    this._options.startPoint.price += deltaPrice;
    this._options.endPoint.price += deltaPrice;

    this.requestUpdate();
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setPoints(start: ChartPoint, end: ChartPoint): void {
    this._options.startPoint = start;
    this._options.endPoint = end;
    this.requestUpdate();
  }
}
