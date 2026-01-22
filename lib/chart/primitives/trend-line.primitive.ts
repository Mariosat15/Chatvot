/**
 * Trend Line Primitive
 * Draws a line between two points with proper coordinate handling
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
  draw(target: CanvasRenderingTarget2D): void {
    if (!this._data || this._data.points.length < 2) return;
    if (!this._data.options.visible) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio }) => {
      const data = this._data!;
      const [p1, p2] = data.points;
      const options = data.options as TrendLineOptions;

      // Scale coordinates
      const x1 = p1.x * horizontalPixelRatio;
      const y1 = p1.y * verticalPixelRatio;
      const x2 = p2.x * horizontalPixelRatio;
      const y2 = p2.y * verticalPixelRatio;

      // Set line style
      ctx.strokeStyle = options.color;
      ctx.lineWidth = options.lineWidth * horizontalPixelRatio;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Set dash pattern
      const dash = this.getLineDash(options.lineStyle, horizontalPixelRatio);
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
          const extendLength = 5000 * horizontalPixelRatio;
          
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
        this.drawAnchors(ctx, data, horizontalPixelRatio, verticalPixelRatio);
      }

      // Draw measurements if enabled
      if (options.showAngle || options.showLength || options.showPriceDiff) {
        this.drawMeasurements(ctx, data, horizontalPixelRatio, verticalPixelRatio);
      }
    });
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
      ctx.strokeStyle = options.color;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      
      // Inner dot for selected state
      if (data.isSelected) {
        ctx.fillStyle = options.color;
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
      ctx.strokeStyle = options.color;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
    }
  }

  private drawMeasurements(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number
  ): void {
    const options = data.options as TrendLineOptions;
    const [p1, p2] = data.chartPoints;
    const [sp1, sp2] = data.points;
    
    const measurements: string[] = [];
    
    if (options.showPriceDiff && p1 && p2) {
      const priceDiff = p2.price - p1.price;
      const percentDiff = ((p2.price - p1.price) / p1.price) * 100;
      measurements.push(`${priceDiff >= 0 ? '+' : ''}${priceDiff.toFixed(5)} (${percentDiff.toFixed(2)}%)`);
    }
    
    if (options.showAngle) {
      const dx = sp2.x - sp1.x;
      const dy = sp2.y - sp1.y;
      const angle = Math.atan2(-dy, dx) * (180 / Math.PI);
      measurements.push(`${angle.toFixed(1)}°`);
    }
    
    if (options.showLength && p1 && p2) {
      const dx = sp2.x - sp1.x;
      const dy = sp2.y - sp1.y;
      const pixelLength = Math.sqrt(dx * dx + dy * dy);
      measurements.push(`${Math.round(pixelLength)}px`);
    }
    
    if (measurements.length > 0) {
      const text = measurements.join(' | ');
      const midX = ((sp1.x + sp2.x) / 2) * hpr;
      const midY = ((sp1.y + sp2.y) / 2) * vpr - 15 * vpr;
      
      ctx.font = `${11 * hpr}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      
      const textWidth = ctx.measureText(text).width;
      const padding = 4 * hpr;
      
      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(
        midX - textWidth / 2 - padding,
        midY - 14 * vpr,
        textWidth + padding * 2,
        16 * vpr
      );
      
      // Text
      ctx.fillStyle = '#ffffff';
      ctx.fillText(text, midX, midY);
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
    
    // Check main line
    if (this.distanceToSegment(point, p1, p2) < threshold) {
      return true;
    }
    
    // Check extended parts
    if (this._options.extendLeft || this._options.extendRight) {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      
      if (len > 0) {
        if (this._options.extendLeft) {
          const extP = { 
            x: p1.x - (dx / len) * 5000, 
            y: p1.y - (dy / len) * 5000 
          };
          if (this.distanceToSegment(point, extP, p1) < threshold) return true;
        }
        
        if (this._options.extendRight) {
          const extP = { 
            x: p2.x + (dx / len) * 5000, 
            y: p2.y + (dy / len) * 5000 
          };
          if (this.distanceToSegment(point, p2, extP) < threshold) return true;
        }
      }
    }
    
    return false;
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
        // Move entire line
        const oldMid = {
          price: (this._options.startPoint.price + this._options.endPoint.price) / 2,
          time: this._options.startPoint.time, // Simplified - ideally calculate time midpoint
        };
        const deltaPrice = point.price - oldMid.price;
        this._options.startPoint.price += deltaPrice;
        this._options.endPoint.price += deltaPrice;
        break;
    }
    
    this.requestUpdate();
  }

  move(deltaPrice: number, deltaTime: number): void {
    if (this._options.locked) return;
    
    this._options.startPoint.price += deltaPrice;
    this._options.endPoint.price += deltaPrice;
    
    // Note: Moving by time is more complex due to Time type
    // For now, we only support price movement
    
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

  getAngle(): number {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);
    
    if (!p1 || !p2) return 0;
    
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.atan2(-dy, dx) * (180 / Math.PI);
  }

  getLength(): number {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);
    
    if (!p1 || !p2) return 0;
    
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  getPriceDifference(): number {
    return this._options.endPoint.price - this._options.startPoint.price;
  }
}
