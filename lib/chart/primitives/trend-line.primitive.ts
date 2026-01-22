/**
 * Trend Line Primitive - Official Plugin Pattern
 * 
 * Based on TradingView Lightweight Charts plugin examples:
 * - https://tradingview.github.io/lightweight-charts/docs/plugins/series-primitives
 * - https://github.com/tradingview/lightweight-charts/discussions/1434
 * 
 * Key insight: Store logical index directly for stable rendering.
 * The logical index allows fractional values between bars (MT5-style free positioning).
 */

import { 
  ISeriesPrimitivePaneView, 
  SeriesPrimitivePaneViewZOrder,
  Coordinate,
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
  FreePoint,
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

    // Scale coordinates to bitmap space (pixel-perfect rendering)
    const x1 = Math.round(p1.x * hpr);
    const y1 = Math.round(p1.y * vpr);
    const x2 = Math.round(p2.x * hpr);
    const y2 = Math.round(p2.y * vpr);

    // Set line style
    ctx.strokeStyle = options.color || '#2962ff';
    ctx.lineWidth = Math.max(1, Math.round((options.lineWidth || 2) * hpr));
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
      const x = Math.round(p.x * hpr);
      const y = Math.round(p.y * vpr);
      
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
      const midX = Math.round(((p1.x + p2.x) / 2) * hpr);
      const midY = Math.round(((p1.y + p2.y) / 2) * vpr);
      
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
  constructor(options: Partial<TrendLineOptions> & { startPoint: FreePoint; endPoint: FreePoint }) {
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

  /**
   * Get render data - converts FreePoints to screen coordinates
   * Uses logicalToCoordinate for stable X positioning
   */
  getRenderData(): DrawingRenderData {
    const startScreen = this.projectPoint(this._options.startPoint);
    const endScreen = this.projectPoint(this._options.endPoint);
    
    const points: ScreenPoint[] = [];
    if (startScreen) points.push(startScreen);
    if (endScreen) points.push(endScreen);
    
    const size = this.getCanvasSize();
    
    // Convert FreePoint to ChartPoint for compatibility
    const chartPoints: ChartPoint[] = [
      { time: this._options.startPoint.timestamp as any, price: this._options.startPoint.price },
      { time: this._options.endPoint.timestamp as any, price: this._options.endPoint.price },
    ];
    
    return {
      points,
      chartPoints,
      options: this._options,
      isSelected: this._isSelected,
      isHovered: this._isHovered,
      canvasWidth: size.width,
      canvasHeight: size.height,
    };
  }

  /**
   * Project a FreePoint to screen coordinates
   * Uses reference bar anchoring - survives lazy loading when new bars are added
   */
  private projectPoint(point: FreePoint): ScreenPoint | null {
    if (!this._chart || !this._series) return null;
    
    try {
      const timeScale = this._chart.timeScale();
      let x: number | null = null;
      
      // Method 1: Use reference bar anchoring (survives lazy loading)
      if (point.referenceBarTime !== undefined && point.offsetFromBar !== undefined) {
        const refX = timeScale.timeToCoordinate(point.referenceBarTime as any);
        
        if (refX !== null) {
          // Estimate bar width
          const visibleRange = timeScale.getVisibleLogicalRange();
          if (visibleRange) {
            const tsWidth = timeScale.width();
            const barsVisible = visibleRange.to - visibleRange.from;
            const barWidth = barsVisible > 0 ? tsWidth / barsVisible : 10;
            
            // Apply offset
            x = refX + (point.offsetFromBar * barWidth);
          } else {
            x = refX;
          }
        }
      }
      
      // Method 2: Fallback to timeToCoordinate for exact bar times
      if (x === null && point.timestamp) {
        x = timeScale.timeToCoordinate(point.timestamp as any);
      }
      
      if (x === null) return null;
      
      // Y coordinate from price
      const y = this._series.priceToCoordinate(point.price);
      if (y === null) return null;
      
      return { x, y };
    } catch {
      return null;
    }
  }

  // ============================================
  // INTERACTION
  // ============================================

  hitTest(point: ScreenPoint): boolean {
    if (!this._options.visible) return false;
    
    const p1 = this.projectPoint(this._options.startPoint);
    const p2 = this.projectPoint(this._options.endPoint);
    
    if (!p1 || !p2) return false;
    
    const threshold = 10;
    return this.distanceToSegment(point, p1, p2) < threshold;
  }

  getAnchorPoints(): ScreenPoint[] {
    const anchors: ScreenPoint[] = [];
    
    const p1 = this.projectPoint(this._options.startPoint);
    const p2 = this.projectPoint(this._options.endPoint);
    
    if (p1) anchors.push(p1);
    if (p2) anchors.push(p2);
    
    // Add middle anchor
    if (p1 && p2) {
      anchors.push({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
    }
    
    return anchors;
  }

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const p1 = this.projectPoint(this._options.startPoint);
    const p2 = this.projectPoint(this._options.endPoint);
    
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
    
    // Convert ChartPoint to FreePoint with logical index
    const freePoint = this.chartPointToFreePoint(point);
    if (!freePoint) return;
    
    switch (anchor) {
      case 'start':
        this._options.startPoint = freePoint;
        break;
      case 'end':
        this._options.endPoint = freePoint;
        break;
      case 'middle':
        // Calculate price delta
        const oldMidPrice = (this._options.startPoint.price + this._options.endPoint.price) / 2;
        const deltaPrice = freePoint.price - oldMidPrice;
        
        // Calculate offset delta using offset from bar
        const oldStartOffset = this._options.startPoint.offsetFromBar ?? 0;
        const oldEndOffset = this._options.endPoint.offsetFromBar ?? 0;
        const oldMidOffset = (oldStartOffset + oldEndOffset) / 2;
        const newOffset = freePoint.offsetFromBar ?? 0;
        const deltaOffset = newOffset - oldMidOffset;
        
        // Update offsets (horizontal movement)
        this._options.startPoint.offsetFromBar = oldStartOffset + deltaOffset;
        this._options.endPoint.offsetFromBar = oldEndOffset + deltaOffset;
        
        // Update reference bar times if needed
        if (freePoint.referenceBarTime !== undefined) {
          this._options.startPoint.referenceBarTime = freePoint.referenceBarTime;
          this._options.endPoint.referenceBarTime = freePoint.referenceBarTime;
        }
        
        // Move both endpoints by price delta (vertical movement)
        this._options.startPoint.price += deltaPrice;
        this._options.endPoint.price += deltaPrice;
        break;
    }
    
    this.requestUpdate();
  }

  move(deltaPrice: number, deltaLogical: number): void {
    if (this._options.locked) return;
    
    // Move price (vertical)
    this._options.startPoint.price += deltaPrice;
    this._options.endPoint.price += deltaPrice;
    
    // Move horizontal by updating offset from reference bar
    // deltaLogical represents bars to move
    if (this._options.startPoint.offsetFromBar !== undefined) {
      this._options.startPoint.offsetFromBar += deltaLogical;
    } else {
      this._options.startPoint.offsetFromBar = deltaLogical;
    }
    
    if (this._options.endPoint.offsetFromBar !== undefined) {
      this._options.endPoint.offsetFromBar += deltaLogical;
    } else {
      this._options.endPoint.offsetFromBar = deltaLogical;
    }
    
    this.requestUpdate();
  }

  /**
   * Convert ChartPoint to FreePoint with logical index
   */
  private chartPointToFreePoint(point: ChartPoint): FreePoint | null {
    if (!this._chart) return null;
    
    try {
      const timeScale = this._chart.timeScale();
      const timestamp = typeof point.time === 'number' ? point.time : 0;
      
      // The ChartPoint time IS the reference bar time (it's snapped to a bar)
      // Offset is 0 because it's exactly at a bar
      return {
        timestamp,
        price: point.price,
        referenceBarTime: timestamp,
        offsetFromBar: 0,
      };
    } catch {
      return null;
    }
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setPoints(start: FreePoint, end: FreePoint): void {
    this._options.startPoint = start;
    this._options.endPoint = end;
    this.requestUpdate();
  }
}
