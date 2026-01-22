/**
 * Horizontal Line Primitive
 * Draws a horizontal line at a specific price level with price label
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
  HorizontalLineOptions, 
  ChartPoint, 
  ScreenPoint, 
  AnchorPosition,
  DEFAULT_DRAWING_OPTIONS,
} from './types';

// ============================================
// HORIZONTAL LINE RENDERER
// ============================================

class HorizontalLineRenderer extends BasePaneRenderer {
  protected drawImpl(
    ctx: CanvasRenderingContext2D, 
    hpr: number, 
    vpr: number, 
    size: { width: number; height: number }
  ): void {
    const data = this._data!;
    if (data.points.length === 0) return;

    const y = data.points[0].y * vpr;
    const options = data.options as HorizontalLineOptions;

    // Set line style
    ctx.strokeStyle = options.color || '#2962ff';
    ctx.lineWidth = (options.lineWidth || 2) * hpr;
    ctx.lineCap = 'round';
    
    // Set dash pattern
    const dash = this.getLineDash(options.lineStyle, hpr);
    ctx.setLineDash(dash);

    // Draw horizontal line across entire width
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size.width, y);
    ctx.stroke();

    // Reset dash
    ctx.setLineDash([]);

    // Draw selection/hover state
    if (data.isSelected || data.isHovered) {
      this.drawAnchor(ctx, data, hpr, vpr, size.width);
    }

    // Draw price label if enabled
    if (options.showPrice !== false) {
      this.drawPriceLabel(ctx, data, hpr, vpr);
    }
  }

  private drawAnchor(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number,
    canvasWidth: number
  ): void {
    const y = data.points[0].y * vpr;
    const options = data.options;
    
    const x = canvasWidth / 2;
    const anchorRadius = (data.isSelected ? 6 : 4) * hpr;
    const borderWidth = 2 * hpr;
    
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x, y, anchorRadius, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = options.color || '#2962ff';
    ctx.lineWidth = borderWidth;
    ctx.stroke();
    
    if (data.isSelected) {
      ctx.fillStyle = options.color || '#2962ff';
      ctx.beginPath();
      ctx.arc(x, y, anchorRadius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawPriceLabel(
    ctx: CanvasRenderingContext2D,
    data: DrawingRenderData,
    hpr: number,
    vpr: number
  ): void {
    const options = data.options as HorizontalLineOptions;
    const y = data.points[0].y * vpr;
    
    const priceText = options.price.toFixed(5);
    const fontSize = 11 * hpr;
    ctx.font = `${fontSize}px Arial`;
    
    const textWidth = ctx.measureText(priceText).width;
    const padding = 4 * hpr;
    const labelHeight = 18 * vpr;
    const labelWidth = textWidth + padding * 2;
    const x = 8 * hpr;
    
    // Draw label background
    ctx.fillStyle = options.color || '#2962ff';
    ctx.beginPath();
    ctx.roundRect(x, y - labelHeight / 2, labelWidth, labelHeight, 3 * hpr);
    ctx.fill();
    
    // Draw text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(priceText, x + padding, y);
  }
}

// ============================================
// HORIZONTAL LINE PANE VIEW
// ============================================

class HorizontalLinePaneView extends BasePaneView {
  constructor(source: HorizontalLinePrimitive) {
    super(source, new HorizontalLineRenderer());
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return 'normal';
  }
}

// ============================================
// HORIZONTAL LINE PRIMITIVE
// ============================================

export class HorizontalLinePrimitive extends BasePrimitive<HorizontalLineOptions> {
  constructor(options: Partial<HorizontalLineOptions> & { price: number }) {
    const fullOptions: HorizontalLineOptions = {
      ...DEFAULT_DRAWING_OPTIONS,
      id: options.id || `hline_${Date.now()}`,
      price: options.price,
      showPrice: options.showPrice ?? true,
      ...options,
    } as HorizontalLineOptions;
    
    super('horizontal-line', fullOptions);
  }

  protected createPaneViews(): ISeriesPrimitivePaneView[] {
    return [new HorizontalLinePaneView(this)];
  }

  getRenderData(): DrawingRenderData {
    const y = this.priceToY(this._options.price);
    const points: ScreenPoint[] = y !== null ? [{ x: 0, y }] : [];
    
    const size = this.getCanvasSize();
    
    return {
      points,
      chartPoints: [{ time: 0 as any, price: this._options.price }],
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
    
    const y = this.priceToY(this._options.price);
    if (y === null) return false;
    
    const threshold = 10;
    return Math.abs(point.y - y) < threshold;
  }

  getAnchorPoints(): ScreenPoint[] {
    const y = this.priceToY(this._options.price);
    if (y === null) return [];
    
    const size = this.getCanvasSize();
    return [{ x: size.width / 2, y }];
  }

  getAnchorAtPoint(point: ScreenPoint, threshold: number = 15): AnchorPosition | null {
    const y = this.priceToY(this._options.price);
    if (y === null) return null;
    
    const size = this.getCanvasSize();
    const anchor = { x: size.width / 2, y };
    
    if (this.distanceToPoint(point, anchor) < threshold) {
      return 'center';
    }
    
    return null;
  }

  moveAnchor(_anchor: AnchorPosition, point: ChartPoint): void {
    if (this._options.locked) return;
    this._options.price = point.price;
    this.requestUpdate();
  }

  move(deltaPrice: number, _deltaTime: number): void {
    if (this._options.locked) return;
    this._options.price += deltaPrice;
    this.requestUpdate();
  }

  // ============================================
  // ADDITIONAL METHODS
  // ============================================

  setPrice(price: number): void {
    this._options.price = price;
    this.requestUpdate();
  }

  getPrice(): number {
    return this._options.price;
  }
}
