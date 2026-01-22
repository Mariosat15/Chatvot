/**
 * Fibonacci Retracement Primitive
 * Draws Fibonacci retracement levels between two points
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
  FibonacciOptions, 
  ChartPoint, 
  ScreenPoint, 
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
  DEFAULT_FIBONACCI_LEVELS,
  FIBONACCI_COLORS,
} from './types';

// ============================================
// FIBONACCI RENDERER
// ============================================

class FibonacciRenderer extends BasePaneRenderer {
  draw(target: CanvasRenderingTarget2D): void {
    if (!this._data || this._data.points.length < 2) return;
    if (!this._data.options.visible) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio, verticalPixelRatio, bitmapSize }) => {
      const data = this._data!;
      const [p1, p2] = data.points;
      const [cp1, cp2] = data.chartPoints;
      const options = data.options as FibonacciOptions;
      
      const y1 = p1.y * verticalPixelRatio;
      const y2 = p2.y * verticalPixelRatio;
      const price1 = cp1.price;
      const price2 = cp2.price;
      const priceRange = price2 - price1;

      // Draw background fill between 0 and 1 levels
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = options.color;
      ctx.fillRect(0, Math.min(y1, y2), bitmapSize.width, Math.abs(y2 - y1));
      ctx.globalAlpha = 1;

      // Draw each Fibonacci level
      const levels = options.levels || DEFAULT_FIBONACCI_LEVELS;
      
      levels.forEach(level => {
        const levelY = y1 + (y2 - y1) * level;
        const levelPrice = options.reverse 
          ? price2 - priceRange * level 
          : price1 + priceRange * level;
        
        const levelColor = options.levelColors?.[level] || FIBONACCI_COLORS[level] || options.color;
        
        // Draw level line
        ctx.strokeStyle = levelColor;
        ctx.lineWidth = (level === 0 || level === 1 ? 2 : 1) * horizontalPixelRatio;
        ctx.setLineDash(level === 0.5 ? [4 * horizontalPixelRatio, 4 * horizontalPixelRatio] : []);
        
        ctx.beginPath();
        ctx.moveTo(0, levelY);
        ctx.lineTo(bitmapSize.width, levelY);
        ctx.stroke();
        
        // Draw level label
        if (options.showLabels !== false) {
          this.drawLevelLabel(ctx, levelY, level, levelPrice, levelColor, horizontalPixelRatio, verticalPixelRatio, options.showPrices);
        }
      });

      ctx.setLineDash([]);

      // Draw trend line between points
      ctx.strokeStyle = options.color;
      ctx.lineWidth = 2 * horizontalPixelRatio;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(p1.x * horizontalPixelRatio, y1);
      ctx.lineTo(p2.x * horizontalPixelRatio, y2);
      ctx.stroke();
      ctx.globalAlpha = 1;

      // Draw selection/hover state
      if (data.isSelected || data.isHovered) {
        this.drawAnchors(ctx, data, horizontalPixelRatio, verticalPixelRatio);
      }
    });
  }

  private drawLevelLabel(
    ctx: CanvasRenderingContext2D,
    y: number,
    level: number,
    price: number,
    color: string,
    hpr: number,
    vpr: number,
    showPrice?: boolean
  ): void {
    const fontSize = 11 * hpr;
    ctx.font = `${fontSize}px Arial`;
    
    // Format level text
    const levelText = `${(level * 100).toFixed(1)}%`;
    const priceText = showPrice ? ` (${price.toFixed(5)})` : '';
    const text = levelText + priceText;
    
    const textWidth = ctx.measureText(text).width;
    const padding = 4 * hpr;
    const labelHeight = 16 * vpr;
    const x = 8 * hpr;
    
    // Draw background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.roundRect(x, y - labelHeight / 2, textWidth + padding * 2, labelHeight, 2 * hpr);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + padding, y);
  }

  private drawAnchors(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number
  ): void {
    const [p1, p2] = data.points;
    const options = data.options;
    
    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;
    
    // Draw anchors at start and end points
    [
      { x: p1.x * hpr, y: p1.y * vpr },
      { x: p2.x * hpr, y: p2.y * vpr },
    ].forEach(p => {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, anchorRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.strokeStyle = options.color;
      ctx.lineWidth = borderWidth;
      ctx.stroke();
      
      if (data.isSelected) {
        ctx.fillStyle = options.color;
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
    return 'bottom'; // Draw beneath price data
  }
}

// ============================================
// FIBONACCI PRIMITIVE
// ============================================

export class FibonacciPrimitive extends BasePrimitive<FibonacciOptions> {
  constructor(options: Partial<FibonacciOptions> & { startPoint: ChartPoint; endPoint: ChartPoint }) {
    const fullOptions: FibonacciOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      id: options.id || `fib_${Date.now()}`,
      startPoint: options.startPoint,
      endPoint: options.endPoint,
      levels: options.levels || DEFAULT_FIBONACCI_LEVELS,
      showLabels: options.showLabels ?? true,
      showPrices: options.showPrices ?? true,
      reverse: options.reverse ?? false,
      ...options,
    } as FibonacciOptions;
    
    super('fibonacci', fullOptions);
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

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const p1 = this.toScreen(this._options.startPoint);
    const p2 = this.toScreen(this._options.endPoint);
    
    if (p1 && this.distanceToPoint(point, p1) < threshold) return 'start';
    if (p2 && this.distanceToPoint(point, p2) < threshold) return 'end';
    
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

  setLevels(levels: number[]): void {
    this._options.levels = levels;
    this.requestUpdate();
  }

  addLevel(level: number): void {
    if (!this._options.levels.includes(level)) {
      this._options.levels = [...this._options.levels, level].sort((a, b) => a - b);
      this.requestUpdate();
    }
  }

  removeLevel(level: number): void {
    this._options.levels = this._options.levels.filter(l => l !== level);
    this.requestUpdate();
  }

  setReverse(reverse: boolean): void {
    this._options.reverse = reverse;
    this.requestUpdate();
  }

  getPriceAtLevel(level: number): number {
    const priceRange = this._options.endPoint.price - this._options.startPoint.price;
    if (this._options.reverse) {
      return this._options.endPoint.price - priceRange * level;
    }
    return this._options.startPoint.price + priceRange * level;
  }

  getLevelAtPrice(price: number): number {
    const priceRange = this._options.endPoint.price - this._options.startPoint.price;
    if (priceRange === 0) return 0;
    
    if (this._options.reverse) {
      return (this._options.endPoint.price - price) / priceRange;
    }
    return (price - this._options.startPoint.price) / priceRange;
  }
}
