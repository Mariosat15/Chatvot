/**
 * Trend Line Primitive
 * Draws a line between two points with proper coordinate handling
 */

import { 
  ISeriesPrimitivePaneView, 
  SeriesPrimitivePaneViewZOrder,
} from 'lightweight-charts';
import { 
  BasePrimitive, 
  BasePaneRenderer, 
  BasePaneView,
  DrawingRenderData,
} from './base-primitive';
import { 
  TrendLineOptions, 
  ChartPoint, 
  ScreenPoint, 
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// TREND LINE RENDERER
// ============================================

class TrendLineRenderer extends BasePaneRenderer {
  protected drawImpl(
    ctx: CanvasRenderingContext2D, 
    hpr: number, 
    vpr: number, 
    size: { width: number; height: number }
  ): void {
    const data = this._data!;
    if (data.points.length < 2) return;

    const [p1, p2] = data.points;
    const options = data.options as TrendLineOptions;

    // Scale coordinates
    const x1 = p1.x * hpr;
    const y1 = p1.y * vpr;
    const x2 = p2.x * hpr;
    const y2 = p2.y * vpr;

    // Set line style
    ctx.strokeStyle = options.color || '#2962ff';
    ctx.lineWidth = (options.lineWidth || 2) * hpr;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    // Set dash pattern
    const dash = this.getLineDash(options.lineStyle, hpr);
    ctx.setLineDash(dash);

    // Draw main line
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw extended parts if enabled
    if (options.extendLeft || options.extendRight) {
      ctx.globalAlpha = 0.5;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        const extendLength = 5000 * hpr;
        
        if (options.extendLeft) {
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x1 - (dx / len) * extendLength, y1 - (dy / len) * extendLength);
          ctx.stroke();
        }
        
        if (options.extendRight) {
          ctx.beginPath();
          ctx.moveTo(x2, y2);
          ctx.lineTo(x2 + (dx / len) * extendLength, y2 + (dy / len) * extendLength);
          ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    }

    // Reset dash
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
    vpr: number
  ): void {
    const [p1, p2] = data.points;
    const options = data.options;
    
    // Anchor point style
    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;
    
    [p1, p2].forEach(p => {
      const x = p.x * hpr;
      const y = p.y * vpr;
      
      // White fill
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();
      
      // Colored border
      ctx.strokeStyle = options.color || '#2962ff';
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      
      // Inner dot for selected state
      if (data.isSelected) {
        ctx.fillStyle = options.color || '#2962ff';
        ctx.beginPath();
        ctx.arc(x, y, anchorRadius * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Middle anchor for moving entire line
    if (data.isSelected) {
      const midX = ((p1.x + p2.x) / 2) * hpr;
      const midY = ((p1.y + p2.y) / 2) * vpr;
      
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(midX, midY, anchorRadius * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = options.color || '#2962ff';
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }
}

// ============================================
// TREND LINE PANE VIEW
// ============================================

class TrendLinePaneView extends BasePaneView {
  constructor(source: TrendLinePrimitive) {
    super(source, new TrendLineRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return 'normal';
  }
}

// ============================================
// TREND LINE PRIMITIVE
// ============================================

export class TrendLinePrimitive extends BasePrimitive<TrendLineOptions> {
  constructor(options: Partial<TrendLineOptions> & { startPoint: ChartPoint; endPoint: ChartPoint }) {
    const fullOptions: TrendLineOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      id: options.id || `trend_${Date.now()}`,
      startPoint: options.startPoint,
      endPoint: options.endPoint,
      showAngle: options.showAngle ?? false,
      showLength: options.showLength ?? false,
      showPriceDiff: options.showPriceDiff ?? false,
      extendLeft: options.extendLeft ?? false,
      extendRight: options.extendRight ?? false,
      ...options,
    } as TrendLineOptions;
    
    super('trend-line', fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new TrendLinePaneView(this)];
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
    return this.distanceToSegment(point, p1, p2) < threshold;
  }

  getAnchorPoints(): ScreenPoint[] {
    const anchors: ScreenPoint[] = [];
    
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);
    
    if (p1) anchors.push(p1);
    if (p2) anchors.push(p2);
    
    // Add middle anchor
    if (p1 && p2) {
      anchors.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
    }
    
    return anchors;
  }

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);
    
    if (p1 && this.distanceToPoint(point, p1) < threshold) return 'start';
    if (p2 && this.distanceToPoint(point, p2) < threshold) return 'end';
    
    if (p1 && p2) {
      const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      if (this.distanceToPoint(point, mid) < threshold) return 'middle';
    }
    
    return null;
  }

  moveAnchor(anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;
    
    switch (anchor) {
      case 'start':
        this._options.startPoint = point;
        break;
      case 'end':
        this._options.endPoint = point;
        break;
      case 'middle':
        const oldMid = {
          price: (this._options.startPoint.price + this._options.endPoint.price) / 2,
        };
        const deltaPrice = point.price - oldMid.price;
        this._options.startPoint.price += deltaPrice;
        this._options.endPoint.price += deltaPrice;
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
