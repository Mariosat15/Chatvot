/**
 * Rectangle Primitive
 * Draws a rectangle zone between two points with fill
 */

import { 
  ISeriesPrimitivePaneView, 
  ISeriesPrimitivePaneRenderer,
  SeriesPrimitivePaneViewZOrder,
} from 'lightweight-charts';
import { 
  BasePrimitive, 
  BasePaneRenderer, 
  BasePaneView,
  DrawingRenderData,
  CanvasRenderingTarget2D,
} from './base-primitive';
import { 
  RectangleOptions, 
  ChartPoint, 
  ScreenPoint, 
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// RECTANGLE RENDERER
// ============================================

class RectangleRenderer extends BasePaneRenderer {
  draw(target: CanvasRenderingTarget2D): void {
    if (!this._data || this._data.points.length < 2) return;
    if (!this._data.options.visible) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }) => {
      const data = this._data!;
      const [p1, p2] = data.points;
      const options = data.options as RectangleOptions;

      // Calculate rectangle bounds
      const x1 = Math.min(p1.x, p2.x) * horizontalPixelRatio;
      const y1 = Math.min(p1.y, p2.y) * verticalPixelRatio;
      const x2 = Math.max(p1.x, p2.x) * horizontalPixelRatio;
      const y2 = Math.max(p1.y, p2.y) * verticalPixelRatio;
      const width = x2 - x1;
      const height = y2 - y1;

      // Draw fill
      if (options.fillColor || options.fillOpacity) {
        ctx.globalAlpha = options.fillOpacity ?? 0.2;
        ctx.fillStyle = options.fillColor || options.color;
        ctx.fillRect(x1, y1, width, height);
        ctx.globalAlpha = 1;
      }

      // Draw border
      ctx.strokeStyle = options.color;
      ctx.lineWidth = options.lineWidth * horizontalPixelRatio;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      const dash = this.getLineDash(options.lineStyle, horizontalPixelRatio);
      ctx.setLineDash(dash);
      ctx.strokeRect(x1, y1, width, height);
      ctx.setLineDash([]);

      // Draw selection/hover state
      if (data.isSelected || data.isHovered) {
        this.drawAnchors(ctx, data, horizontalPixelRatio, verticalPixelRatio);
      }
    });
  }

  drawBackground(target: CanvasRenderingTarget2D): void {
    // Background drawing if needed (drawn beneath other elements)
  }

  private drawAnchors(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number
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
    
    corners.forEach(corner => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(corner.x, corner.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = options.color;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      
      if (data.isSelected) {
        ctx.fillStyle = options.color;
        ctx.beginPath();
        ctx.arc(corner.x, corner.y, anchorRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Center anchor for moving
    if (data.isSelected) {
      const centerX = ((p1.x + p2.x) / 2) * hpr;
      const centerY = ((p1.y + p2.y) / 2) * vpr;
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(centerX, centerY, anchorRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = options.color;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }

  private getLineDash(style: string, pixelRatio: number): number[] {
    switch (style) {
      case 'dashed': return [8 * pixelRatio, 4 * pixelRatio];
      case 'dotted': return [2 * pixelRatio, 2 * pixelRatio];
      default: return [];
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
    return 'bottom'; // Draw beneath price data
  }
}

// ============================================
// RECTANGLE PRIMITIVE
// ============================================

export class RectanglePrimitive extends BasePrimitive<RectangleOptions> {
  constructor(options: Partial<RectangleOptions> & { topLeft: ChartPoint; bottomRight: ChartPoint }) {
    const fullOptions: RectangleOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      id: options.id || `rect_${Date.now()}`,
      topLeft: options.topLeft,
      bottomRight: options.bottomRight,
      fillOpacity: options.fillOpacity ?? 0.2,
      ...options,
    } as RectangleOptions;
    
    super('rectangle', fullOptions);
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
    
    // Check if inside rectangle or near border
    const insideX = point.x >= minX - threshold && point.x <= maxX + threshold;
    const insideY = point.y >= minY - threshold && point.y <= maxY + threshold;
    
    if (!insideX || !insideY) return false;
    
    // Check if near border (not just inside fill)
    const nearLeft = Math.abs(point.x - minX) < threshold;
    const nearRight = Math.abs(point.x - maxX) < threshold;
    const nearTop = Math.abs(point.y - minY) < threshold;
    const nearBottom = Math.abs(point.y - maxY) < threshold;
    
    // Inside the rectangle (including fill area)
    return true;
  }

  getAnchorPoints(): ScreenPoint[] {
    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);
    
    if (!p1 || !p2) return [];
    
    // Four corners plus center
    return [
      { x: p1.x, y: p1.y },         // top-left
      { x: p2.x, y: p1.y },         // top-right
      { x: p1.x, y: p2.y },         // bottom-left
      { x: p2.x, y: p2.y },         // bottom-right
      { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, // center
    ];
  }

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);
    
    if (!p1 || !p2) return null;
    
    const corners: { pos: ScreenPoint; anchor: AnchorPosition }[] = [
      { pos: { x: p1.x, y: p1.y }, anchor: 'start' },        // top-left
      { pos: { x: p2.x, y: p1.y }, anchor: 'end' },          // top-right (treated as end for resize)
      { pos: { x: p1.x, y: p2.y }, anchor: 'corner' },       // bottom-left
      { pos: { x: p2.x, y: p2.y }, anchor: 'end' },          // bottom-right
    ];
    
    for (const { pos, anchor } of corners) {
      if (this.distanceToPoint(point, pos) < threshold) {
        return anchor;
      }
    }
    
    // Center anchor
    const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (this.distanceToPoint(point, center) < threshold) {
      return 'center';
    }
    
    return null;
  }

  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;
    
    switch (anchor) {
      case 'start': // top-left
        this._options.topLeft = point;
        break;
      case 'end': // bottom-right
        this._options.bottomRight = point;
        break;
      case 'corner': // bottom-left - adjust both points
        this._options.topLeft.time = point.time;
        this._options.bottomRight.price = point.price;
        break;
      case 'center': // Move entire rectangle
        const oldCenterPrice = (this._options.topLeft.price + this._options.bottomRight.price) / 2;
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

  getArea(): { width: number; height: number; priceRange: number } {
    const p1 = this.toScreen(this._options.topLeft);
    const p2 = this.toScreen(this._options.bottomRight);
    
    if (!p1 || !p2) return { width: 0, height: 0, priceRange: 0 };
    
    return {
      width: Math.abs(p2.x - p1.x),
      height: Math.abs(p2.y - p1.y),
      priceRange: Math.abs(this._options.bottomRight.price - this._options.topLeft.price),
    };
  }
}
