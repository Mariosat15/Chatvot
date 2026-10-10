/**
 * Rectangle Primitive
 * Draws a rectangle zone between two points with fill
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
  RectangleOptions,
  ChartPoint,
  ScreenPoint,
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from "./types";

// ============================================
// RECTANGLE RENDERER
// ============================================

class RectangleRenderer extends BasePaneRenderer {
  protected drawImpl(
    ctx: CanvasRenderingContext2D,
    hpr: number,
    vpr: number,
    _size: { width: number; height: number },
  ): void {
    const data = this._data!;
    if (data.points.length < 2) return;

    const [p1, p2] = data.points;
    const options = data.options as RectangleOptions;

    // Calculate rectangle bounds
    const x1 = Math.min(p1.x, p2.x) * hpr;
    const y1 = Math.min(p1.y, p2.y) * vpr;
    const x2 = Math.max(p1.x, p2.x) * hpr;
    const y2 = Math.max(p1.y, p2.y) * vpr;
    const width = x2 - x1;
    const height = y2 - y1;

    // Draw fill
    if (options.fillColor || options.fillOpacity) {
      ctx.globalAlpha = options.fillOpacity ?? 0.2;
      ctx.fillStyle = options.fillColor || options.color || "#2962ff";
      ctx.fillRect(x1, y1, width, height);
      ctx.globalAlpha = 1;
    }

    // Draw border
    ctx.strokeStyle = options.color || "#2962ff";
    ctx.lineWidth = (options.lineWidth || 2) * hpr;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const dash = this.getLineDash(options.lineStyle, hpr);
    ctx.setLineDash(dash);
    ctx.strokeRect(x1, y1, width, height);
    ctx.setLineDash([]);

    // Draw selection/hover state
    if (data.isSelected || data.isHovered) {
      this.drawAnchors(ctx, data, hpr, vpr);
    }
  }

  private drawAnchors(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
  ): void {
    const [p1, p2] = data.points;
    const options = data.options;

    // Four corners
    const corners = [
      { x: p1.x * hpr, y: p1.y * vpr },
      { x: p2.x * hpr, y: p1.y * vpr },
      { x: p1.x * hpr, y: p2.y * vpr },
      { x: p2.x * hpr, y: p2.y * vpr },
    ];

    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;

    corners.forEach((corner) => {
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = options.color || "#2962ff";
      ctx.lineWidth = borderWidth;
      ctx.stroke();

      if (data.isSelected) {
        ctx.fillStyle = options.color || "#2962ff";
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, anchorRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Center anchor for moving
    if (data.isSelected) {
      const centerX = ((p1.x + p2.x) / 2) * hpr;
      const centerY = ((p1.y + p2.y) / 2) * vpr;

      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(centerX, centerY, anchorRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = options.color || "#2962ff";
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }
}

// ============================================
// RECTANGLE PANE VIEW
// ============================================

class RectanglePaneView extends BasePaneView {
  constructor(source: RectanglePrimitive) {
    super(source, new RectangleRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "bottom";
  }
}

// ============================================
// RECTANGLE PRIMITIVE
// ============================================

export class RectanglePrimitive extends BasePrimitive<RectangleOptions> {
  constructor(
    options: Partial<RectangleOptions> & {
      topLeft: ChartPoint;
      bottomRight: ChartPoint;
    },
  ) {
    const fullOptions: RectangleOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      ...options,
      id: options.id || `rect_${Date.now()}`,
      topLeft: options.topLeft,
      bottomRight: options.bottomRight,
      fillOpacity: options.fillOpacity ?? 0.2,
    } as RectangleOptions;

    super("rectangle", fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new RectanglePaneView(this)];
  }

  getRenderData(): DrawingRenderData {
    const topLeftScreen = this.toScreen(this._options.topLeft);
    const bottomRightScreen = this.toScreen(this._options.bottomRight);

    const points: ScreenPoint[] = [];
    if (topLeftScreen) points.push(topLeftScreen);
    if (bottomRightScreen) points.push(bottomRightScreen);

    const size = this.getCanvasSize();

    return {
      points,
      chartPoints: [this._options.topLeft, this._options.bottomRight],
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

    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);

    if (!p1 || !p2) return false;

    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    const threshold = 10;

    // Check if inside or near border
    return (
      point.x >= minX - threshold &&
      point.x <= maxX + threshold &&
      point.y >= minY - threshold &&
      point.y <= maxY + threshold
    );
  }

  getAnchorPoints(): ScreenPoint[] {
    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);

    if (!p1 || !p2) return [];

    return [
      { x: p1.x, y: p1.y },
      { x: p2.x, y: p1.y },
      { x: p1.x, y: p2.y },
      { x: p2.x, y: p2.y },
      { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
    ];
  }

  getAnchorAtPoint(
    point: ScreenPoint,
    threshold: number = 15,
  ): AnchorPosition | null {
    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);

    if (!p1 || !p2) return null;

    if (this.distanceToPoint(point, { x: p1.x, y: p1.y }) < threshold)
      return "start";
    if (this.distanceToPoint(point, { x: p2.x, y: p2.y }) < threshold)
      return "end";

    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (this.distanceToPoint(point, center) < threshold) return "center";

    return null;
  }

  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;

    switch (anchor) {
      case "start":
        this._options.topLeft = point;
        break;
      case "end":
        this._options.bottomRight = point;
        break;
      case "center":
        const oldCenterPrice =
          (this._options.topLeft.price + this._options.bottomRight.price) / 2;
        const deltaPrice = point.price - oldCenterPrice;
        this._options.topLeft.price += deltaPrice;
        this._options.bottomRight.price += deltaPrice;
        break;
    }

    this.requestUpdate();
  }

  move(deltaPrice: number, _deltaTime: number): void {
    if (this._options.locked) return;

    this._options.topLeft.price += deltaPrice;
    this._options.bottomRight.price += deltaPrice;

    this.requestUpdate();
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setCorners(topLeft: ChartPoint, bottomRight: ChartPoint): void {
    this._options.topLeft = topLeft;
    this._options.bottomRight = bottomRight;
    this.requestUpdate();
  }
}
