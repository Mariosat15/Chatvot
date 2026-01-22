/**
 * Drawing Manager - Optimized for Performance
 * Uses requestAnimationFrame for smooth updates, throttled hit testing
 */

import { IChartApi, ISeriesApi, Time, Coordinate, MouseEventParams } from 'lightweight-charts';
import {
  DrawingToolType,
  ChartPoint,
  FreePoint,
  ScreenPoint,
  DrawingSession,
  DrawingEvent,
  DrawingEventHandler,
  DrawingEventType,
  SerializedDrawing,
  AnchorPosition,
  AnyPrimitive,
  createPrimitive,
  getToolInfo,
} from '../primitives';

// ============================================
// TYPES
// ============================================

export interface DrawingManagerOptions {
  defaultColor?: string;
  defaultLineWidth?: number;
  defaultLineStyle?: 'solid' | 'dashed' | 'dotted';
  selectionThreshold?: number;
  anchorThreshold?: number;
}

interface DragState {
  drawing: AnyPrimitive;
  anchor: AnchorPosition | null;
  startChartPoint: ChartPoint;
  lastChartPoint: ChartPoint;
}

// ============================================
// DRAWING MANAGER CLASS
// ============================================

export class DrawingManager {
  private _chart: IChartApi | null = null;
  private _series: ISeriesApi<'Candlestick'> | null = null;
  private _drawings: Map<string, AnyPrimitive> = new Map();
  private _selectedId: string | null = null;
  private _hoveredId: string | null = null;
  private _activeTool: DrawingToolType = null;
  private _session: DrawingSession | null = null;
  private _dragState: DragState | null = null;
  private _options: Required<DrawingManagerOptions>;
  private _eventHandlers: Map<DrawingEventType, Set<DrawingEventHandler>> = new Map();
  private _containerElement: HTMLElement | null = null;
  private _isAttached: boolean = false;
  private _isMouseDown: boolean = false;
  private _mouseDownTime: number = 0;
  private _mouseDownPoint: ScreenPoint | null = null;
  
  // Performance optimization
  private _rafId: number | null = null;
  private _pendingUpdate: boolean = false;
  private _lastHitTestTime: number = 0;
  private _hitTestThrottle: number = 16; // ~60fps
  
  // Bound event handlers
  private _boundChartClick: (param: MouseEventParams) => void;
  private _boundCrosshairMove: (param: MouseEventParams) => void;
  private _boundKeyDown: (e: KeyboardEvent) => void;
  private _boundMouseDown: (e: MouseEvent) => void;
  private _boundMouseMove: (e: MouseEvent) => void;
  private _boundMouseUp: (e: MouseEvent) => void;

  constructor(options: DrawingManagerOptions = {}) {
    this._options = {
      defaultColor: options.defaultColor ?? '#2962ff',
      defaultLineWidth: options.defaultLineWidth ?? 2,
      defaultLineStyle: options.defaultLineStyle ?? 'solid',
      selectionThreshold: options.selectionThreshold ?? 10,
      anchorThreshold: options.anchorThreshold ?? 15,
    };

    this._boundChartClick = this.handleChartClick.bind(this);
    this._boundCrosshairMove = this.handleCrosshairMove.bind(this);
    this._boundKeyDown = this.handleKeyDown.bind(this);
    this._boundMouseDown = this.handleMouseDown.bind(this);
    this._boundMouseMove = this.handleMouseMove.bind(this);
    this._boundMouseUp = this.handleMouseUp.bind(this);
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>, container: HTMLElement): void {
    if (this._isAttached) this.detach();

    this._chart = chart;
    this._series = series;
    this._containerElement = container;
    this._isAttached = true;
    
    chart.subscribeClick(this._boundChartClick);
    chart.subscribeCrosshairMove(this._boundCrosshairMove);
    
    container.addEventListener('mousedown', this._boundMouseDown, { passive: true });
    document.addEventListener('mousemove', this._boundMouseMove, { passive: true });
    document.addEventListener('mouseup', this._boundMouseUp, { passive: true });
    document.addEventListener('keydown', this._boundKeyDown);
  }

  detach(): void {
    if (!this._isAttached) return;

    if (this._rafId) cancelAnimationFrame(this._rafId);
    this.clearAll();
    
    if (this._chart) {
      try {
        this._chart.unsubscribeClick(this._boundChartClick);
        this._chart.unsubscribeCrosshairMove(this._boundCrosshairMove);
      } catch {}
    }
    
    if (this._containerElement) {
      this._containerElement.removeEventListener('mousedown', this._boundMouseDown);
    }
    document.removeEventListener('mousemove', this._boundMouseMove);
    document.removeEventListener('mouseup', this._boundMouseUp);
    document.removeEventListener('keydown', this._boundKeyDown);
    
    this._chart = null;
    this._series = null;
    this._containerElement = null;
    this._isAttached = false;
  }

  isAttached(): boolean {
    return this._isAttached;
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  setActiveTool(tool: DrawingToolType): void {
    if (this._session) this.cancelDrawing();
    this._activeTool = tool;
    this.updateCursor();
    if (tool !== null) this.deselect();
  }

  getActiveTool(): DrawingToolType {
    return this._activeTool;
  }

  // ============================================
  // DRAWING CREATION - Optimized
  // ============================================

  private startDrawing(point: ChartPoint, freePoint?: FreePoint): void {
    if (!this._activeTool) return;
    
    const toolInfo = getToolInfo(this._activeTool);
    if (!toolInfo) return;
    
    // Check if this is a "free positioning" tool (trend lines, etc.)
    const isFreePositionTool = ['trend-line', 'ray', 'extended-line', 'arrow'].includes(this._activeTool);
    
    this._session = {
      tool: this._activeTool,
      state: 'placing',
      points: [point],
      freePoints: isFreePositionTool && freePoint ? [freePoint] : undefined,
      preview: undefined,
    };
    
    if (toolInfo.pointsRequired === 1) {
      this.completeDrawing();
      return;
    }
    
    // For free position tools, pass freePoints to preview
    const freePoints = this._session.freePoints 
      ? [this._session.freePoints[0], this._session.freePoints[0]] 
      : undefined;
    
    this._session.preview = this.createPreviewPrimitive([point, point], freePoints);
    if (this._session.preview && this._series) {
      this._session.preview.attach(this._chart!, this._series);
    }
    this._session.state = 'drawing';
  }

  private updateDrawing(point: ChartPoint, freePoint?: FreePoint): void {
    if (!this._session || this._session.state !== 'drawing' || !this._session.preview) return;
    
    const preview = this._session.preview;
    const tool = this._session.tool;
    
    try {
      if (tool === 'trend-line' || tool === 'ray' || tool === 'extended-line' || tool === 'arrow') {
        // Use FreePoints for free-positioning tools
        if (this._session.freePoints && freePoint) {
          (preview as any).setPoints(this._session.freePoints[0], freePoint);
        } else {
          // Fallback to ChartPoints (shouldn't happen for these tools)
          const startFree = { timestamp: typeof this._session.points[0].time === 'number' ? this._session.points[0].time : 0, price: this._session.points[0].price };
          const endFree = freePoint ?? { timestamp: typeof point.time === 'number' ? point.time : 0, price: point.price };
          (preview as any).setPoints(startFree, endFree);
        }
      } else if (tool === 'rectangle') {
        (preview as any).setCorners(this._session.points[0], point);
      } else if (tool === 'fibonacci') {
        (preview as any).setPoints(this._session.points[0], point);
      }
    } catch {}
  }

  private completeDrawing(): void {
    if (!this._session) return;
    
    if (this._session.preview) {
      try { this._session.preview.detach(); } catch {}
    }
    
    const points = this._session.points.length === 1 
      ? this._session.points 
      : [this._session.points[0], this._session.points[this._session.points.length - 1]];
    
    // Get FreePoints for free-positioning tools
    const freePoints = this._session.freePoints && this._session.freePoints.length >= 2
      ? [this._session.freePoints[0], this._session.freePoints[this._session.freePoints.length - 1]]
      : undefined;
    
    const drawing = createPrimitive({
      type: this._session.tool,
      points,
      freePoints,
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
    
    if (drawing && this._series) {
      this.addDrawing(drawing);
      this.emitEvent('created', drawing);
      
      // Auto-switch to selection mode and select the new drawing
      this._activeTool = null;
      this.select(drawing.id);
      this.emitToolChanged();
    }
    
    this._session = null;
    this.updateCursor();
  }

  cancelDrawing(): void {
    if (!this._session) return;
    if (this._session.preview) {
      try { this._session.preview.detach(); } catch {}
    }
    this._session = null;
    this.updateCursor();
  }

  private createPreviewPrimitive(points: ChartPoint[], freePoints?: FreePoint[]): AnyPrimitive | null {
    return createPrimitive({
      type: this._activeTool,
      points,
      freePoints,
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
  }

  // ============================================
  // DRAWING MANAGEMENT
  // ============================================

  addDrawing(drawing: AnyPrimitive): void {
    if (!this._series || !this._chart) return;
    drawing.attach(this._chart, this._series);
    this._drawings.set(drawing.id, drawing);
  }

  removeDrawing(id: string): void {
    const drawing = this._drawings.get(id);
    if (!drawing) return;
    
    drawing.detach();
    this._drawings.delete(id);
    if (this._selectedId === id) this._selectedId = null;
    this.emitEvent('deleted', drawing);
  }

  getDrawing(id: string): AnyPrimitive | undefined {
    return this._drawings.get(id);
  }

  getAllDrawings(): AnyPrimitive[] {
    return Array.from(this._drawings.values());
  }

  clearAll(): void {
    for (const drawing of this._drawings.values()) {
      try { drawing.detach(); } catch {}
    }
    this._drawings.clear();
    this._selectedId = null;
    this._hoveredId = null;
  }

  // ============================================
  // SELECTION
  // ============================================

  select(id: string): void {
    if (this._selectedId && this._selectedId !== id) {
      const prev = this._drawings.get(this._selectedId);
      if (prev) {
        prev.setSelected(false);
        this.emitEvent('deselected', prev);
      }
    }
    
    const drawing = this._drawings.get(id);
    if (drawing) {
      drawing.setSelected(true);
      this._selectedId = id;
      this.emitEvent('selected', drawing);
    }
  }

  deselect(): void {
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        drawing.setSelected(false);
        this.emitEvent('deselected', drawing);
      }
      this._selectedId = null;
    }
  }

  getSelectedDrawing(): AnyPrimitive | null {
    return this._selectedId ? this._drawings.get(this._selectedId) || null : null;
  }

  deleteSelected(): void {
    if (this._selectedId) this.removeDrawing(this._selectedId);
  }

  // ============================================
  // HIT TESTING - Cached
  // ============================================

  private hitTest(point: ScreenPoint): AnyPrimitive | null {
    const drawings = Array.from(this._drawings.values()).reverse();
    for (const drawing of drawings) {
      if (drawing.hitTest(point)) return drawing;
    }
    return null;
  }

  private hitTestAnchor(point: ScreenPoint): { drawing: AnyPrimitive; anchor: AnchorPosition } | null {
    if (!this._selectedId) return null;
    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return null;
    
    const anchor = drawing.getAnchorAtPoint(point, this._options.anchorThreshold);
    return anchor ? { drawing, anchor } : null;
  }

  // ============================================
  // COORDINATE CONVERSION - Inline for speed
  // ============================================

  private getScreenPoint(e: MouseEvent): ScreenPoint | null {
    if (!this._containerElement) return null;
    const rect = this._containerElement.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private screenToChart(point: ScreenPoint): ChartPoint | null {
    if (!this._chart || !this._series) return null;
    try {
      const time = this._chart.timeScale().coordinateToTime(point.x as Coordinate);
      const price = this._series.coordinateToPrice(point.y as Coordinate);
      if (time === null || price === null) return null;
      return { time, price };
    } catch { return null; }
  }

  /**
   * Convert screen point to FreePoint-compatible ChartPoint
   * Uses linear interpolation for precise timestamp (MT5-style)
   */
  private screenToFreeChartPoint(point: ScreenPoint): ChartPoint | null {
    if (!this._chart || !this._series) return null;
    try {
      // Get price
      const price = this._series.coordinateToPrice(point.y as Coordinate);
      if (price === null) return null;
      
      // Get precise timestamp via interpolation
      const visibleRange = this._chart.timeScale().getVisibleRange();
      if (!visibleRange) return null;
      
      const chartElement = (this._chart as any).chartElement?.();
      const chartWidth = chartElement?.clientWidth || 800;
      
      const startTime = typeof visibleRange.from === 'number' ? visibleRange.from : 0;
      const endTime = typeof visibleRange.to === 'number' ? visibleRange.to : startTime + 1;
      const timeSpan = endTime - startTime;
      
      if (timeSpan <= 0 || chartWidth <= 0) return null;
      
      // Precise timestamp (no snapping)
      const timestamp = startTime + (point.x / chartWidth) * timeSpan;
      
      return { time: timestamp as any, price };
    } catch { return null; }
  }

  private getChartPointFromEvent(param: MouseEventParams): ChartPoint | null {
    if (!param.point || !this._chart || !this._series) return null;
    try {
      const price = this._series.coordinateToPrice(param.point.y as Coordinate);
      if (price === null || price === undefined) return null;
      
      let time: Time;
      if (param.time) {
        time = param.time;
      } else {
        const timeValue = this._chart.timeScale().coordinateToTime(param.point.x as Coordinate);
        if (timeValue === null) return null;
        time = timeValue;
      }
      return { time, price };
    } catch { return null; }
  }

  /**
   * Get FreePoint from event - MT5-style precise positioning
   * Uses linear interpolation instead of snapping to candle times
   */
  private getFreePointFromEvent(param: MouseEventParams): FreePoint | null {
    if (!param.point || !this._chart || !this._series) return null;
    try {
      // Get price from Y coordinate
      const price = this._series.coordinateToPrice(param.point.y as Coordinate);
      if (price === null || price === undefined) return null;
      
      // Get precise timestamp via linear interpolation
      const visibleRange = this._chart.timeScale().getVisibleRange();
      if (!visibleRange) return null;
      
      // Get chart width for interpolation
      const chartElement = (this._chart as any).chartElement?.();
      const chartWidth = chartElement?.clientWidth || 800;
      
      // Calculate time bounds
      const startTime = typeof visibleRange.from === 'number' ? visibleRange.from : 0;
      const endTime = typeof visibleRange.to === 'number' ? visibleRange.to : startTime + 1;
      const timeSpan = endTime - startTime;
      
      if (timeSpan <= 0 || chartWidth <= 0) return null;
      
      // Linear interpolation for precise timestamp (no snapping!)
      const timestamp = startTime + (param.point.x / chartWidth) * timeSpan;
      
      return { timestamp, price };
    } catch { return null; }
  }

  // ============================================
  // MOUSE HANDLERS - Optimized with RAF
  // ============================================

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    if (this._activeTool || this._session) return;
    
    const screenPoint = this.getScreenPoint(e);
    if (!screenPoint) return;
    
    this._isMouseDown = true;
    this._mouseDownTime = performance.now();
    this._mouseDownPoint = screenPoint;
    
    // Check anchor first
    const anchorHit = this.hitTestAnchor(screenPoint);
    if (anchorHit) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this._dragState = {
          drawing: anchorHit.drawing,
          anchor: anchorHit.anchor,
          startChartPoint: chartPoint,
          lastChartPoint: chartPoint,
        };
        // Disable chart scrolling while dragging drawing
        this.setChartScrollEnabled(false);
        this.setCursor('grabbing');
        return;
      }
    }
    
    // Check drawing
    const hit = this.hitTest(screenPoint);
    if (hit) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        // Select immediately for faster feedback
        if (hit.id !== this._selectedId) {
          this.select(hit.id);
        }
        this._dragState = {
          drawing: hit,
          anchor: null,
          startChartPoint: chartPoint,
          lastChartPoint: chartPoint,
        };
        // Disable chart scrolling while dragging drawing
        this.setChartScrollEnabled(false);
        this.setCursor('move');
        return;
      }
    }
    
    this.deselect();
  }

  private handleMouseMove(e: MouseEvent): void {
    const screenPoint = this.getScreenPoint(e);
    if (!screenPoint) return;
    
    // Dragging - use RAF for smooth updates
    if (this._dragState && this._isMouseDown) {
      if (this._pendingUpdate) return; // Skip if update pending
      
      this._pendingUpdate = true;
      this._rafId = requestAnimationFrame(() => {
        this._pendingUpdate = false;
        
        if (!this._dragState) return;
        
        // Use free coordinates for trend line tools (MT5-style)
        const isFreePositionTool = ['trend-line', 'ray', 'extended-line', 'arrow'].includes(this._dragState.drawing.type);
        const chartPoint = isFreePositionTool 
          ? this.screenToFreeChartPoint(screenPoint)
          : this.screenToChart(screenPoint);
        
        if (!chartPoint) return;
        
        if (this._dragState.anchor) {
          // Anchor drag - direct update
          this._dragState.drawing.moveAnchor(this._dragState.anchor, chartPoint);
        } else {
          // Move entire drawing - calculate both price and time deltas
          const deltaPrice = chartPoint.price - this._dragState.lastChartPoint.price;
          const currentTime = typeof chartPoint.time === 'number' ? chartPoint.time : 0;
          const lastTime = typeof this._dragState.lastChartPoint.time === 'number' ? this._dragState.lastChartPoint.time : 0;
          const deltaTime = currentTime - lastTime;
          
          // Update if meaningful change in either direction
          if (Math.abs(deltaPrice) > 0.00001 || Math.abs(deltaTime) > 0.1) {
            this._dragState.drawing.move(deltaPrice, deltaTime);
            this._dragState.lastChartPoint = chartPoint;
          }
        }
      });
      return;
    }
    
    // Hover cursor - throttled
    if (!this._activeTool && !this._session) {
      const now = performance.now();
      if (now - this._lastHitTestTime > this._hitTestThrottle) {
        this._lastHitTestTime = now;
        this.updateHoverCursor(screenPoint);
      }
    }
  }

  private handleMouseUp(_e: MouseEvent): void {
    this._isMouseDown = false;
    
    if (this._dragState) {
      // Re-enable chart scrolling after drag
      this.setChartScrollEnabled(true);
      this.emitEvent('moved', this._dragState.drawing);
      this._dragState = null;
    }
    
    this._mouseDownPoint = null;
    this.updateCursor();
  }

  private updateHoverCursor(screenPoint: ScreenPoint): void {
    // Anchor hover
    const anchorHit = this.hitTestAnchor(screenPoint);
    if (anchorHit) {
      const anchor = anchorHit.anchor;
      this.setCursor(anchor === 'middle' || anchor === 'center' ? 'move' : 'grab');
      return;
    }
    
    // Drawing hover
    const hit = this.hitTest(screenPoint);
    if (hit) {
      this.setCursor(hit.id === this._selectedId ? 'move' : 'pointer');
      
      // Update hover state only if changed
      if (hit.id !== this._hoveredId) {
        if (this._hoveredId) {
          const prev = this._drawings.get(this._hoveredId);
          if (prev) prev.setHovered(false);
        }
        hit.setHovered(true);
        this._hoveredId = hit.id;
      }
      return;
    }
    
    // Clear hover
    if (this._hoveredId) {
      const prev = this._drawings.get(this._hoveredId);
      if (prev) prev.setHovered(false);
      this._hoveredId = null;
    }
    this.setCursor('default');
  }

  // ============================================
  // CHART EVENT HANDLERS
  // ============================================

  private handleChartClick(param: MouseEventParams): void {
    if (this._dragState || this._isMouseDown) return;
    if (!param.point) return;
    
    // Get FreePoint for MT5-style free positioning (this works anywhere on chart)
    const freePoint = this.getFreePointFromEvent(param);
    
    // For drawing tools, prioritize FreePoint
    if (this._activeTool) {
      // For free-positioning tools (trend-line, ray, etc.), use FreePoint only
      const isFreePositionTool = ['trend-line', 'ray', 'extended-line', 'arrow'].includes(this._activeTool);
      
      if (isFreePositionTool) {
        if (!freePoint) return; // Need FreePoint for these tools
        
        // Create a synthetic ChartPoint from FreePoint
        const chartPoint: ChartPoint = {
          time: freePoint.timestamp as any,
          price: freePoint.price,
        };
        
        if (!this._session) {
          this.startDrawing(chartPoint, freePoint);
        } else if (this._session.state === 'drawing') {
          this._session.points.push(chartPoint);
          if (this._session.freePoints) {
            this._session.freePoints.push(freePoint);
          }
          this.completeDrawing();
        }
      } else {
        // For snap-to-candle tools, try ChartPoint first
        const chartPoint = this.getChartPointFromEvent(param);
        
        // Special case: horizontal line only needs price
        if (!chartPoint && this._activeTool === 'horizontal-line' && freePoint) {
          const syntheticPoint: ChartPoint = { time: 0 as any, price: freePoint.price };
          if (!this._session) {
            this.startDrawing(syntheticPoint);
          } else if (this._session.state === 'drawing') {
            this._session.points.push(syntheticPoint);
            this.completeDrawing();
          }
          return;
        }
        
        if (!chartPoint) return;
        
        if (!this._session) {
          this.startDrawing(chartPoint, freePoint ?? undefined);
        } else if (this._session.state === 'drawing') {
          this._session.points.push(chartPoint);
          if (this._session.freePoints && freePoint) {
            this._session.freePoints.push(freePoint);
          }
          this.completeDrawing();
        }
      }
    }
  }

  private handleCrosshairMove(param: MouseEventParams): void {
    if (!param.point) return;
    
    if (this._session?.state === 'drawing') {
      const freePoint = this.getFreePointFromEvent(param);
      
      // For free-positioning tools, use FreePoint directly
      const isFreePositionTool = ['trend-line', 'ray', 'extended-line', 'arrow'].includes(this._session.tool);
      
      if (isFreePositionTool && freePoint) {
        const chartPoint: ChartPoint = {
          time: freePoint.timestamp as any,
          price: freePoint.price,
        };
        this.updateDrawing(chartPoint, freePoint);
      } else {
        const chartPoint = this.getChartPointFromEvent(param);
        if (chartPoint) this.updateDrawing(chartPoint, freePoint ?? undefined);
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedId) {
      e.preventDefault();
      this.deleteSelected();
      return;
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this._session) this.cancelDrawing();
      else if (this._activeTool) this.setActiveTool(null);
      else this.deselect();
    }
  }

  // ============================================
  // CHART SCROLL CONTROL
  // ============================================

  /**
   * Enable/disable chart scrolling via mouse drag
   * Uses Lightweight Charts official API: handleScroll.pressedMouseMove
   * Reference: https://tradingview.github.io/lightweight-charts/docs/api/interfaces/HandleScrollOptions
   */
  private setChartScrollEnabled(enabled: boolean): void {
    if (!this._chart) return;
    try {
      this._chart.applyOptions({
        handleScroll: {
          pressedMouseMove: enabled,
        },
      });
    } catch {}
  }

  // ============================================
  // CURSOR - Cached
  // ============================================

  private _currentCursor: string = 'default';

  private setCursor(cursor: string): void {
    if (this._currentCursor !== cursor && this._containerElement) {
      this._currentCursor = cursor;
      this._containerElement.style.cursor = cursor;
    }
  }

  private updateCursor(): void {
    if (this._activeTool || this._session) {
      this.setCursor('crosshair');
    } else if (this._dragState) {
      this.setCursor('grabbing');
    } else {
      this.setCursor('default');
    }
  }

  // ============================================
  // EVENTS
  // ============================================

  on(event: DrawingEventType, handler: DrawingEventHandler): void {
    if (!this._eventHandlers.has(event)) {
      this._eventHandlers.set(event, new Set());
    }
    this._eventHandlers.get(event)!.add(handler);
  }

  off(event: DrawingEventType, handler: DrawingEventHandler): void {
    this._eventHandlers.get(event)?.delete(handler);
  }

  private emitEvent(type: DrawingEventType, drawing: AnyPrimitive): void {
    const event: DrawingEvent = { type, drawing, timestamp: Date.now() };
    this._eventHandlers.get(type)?.forEach(handler => handler(event));
  }

  private emitToolChanged(): void {
    // Emit a special event with a dummy drawing for tool changes
    const event: DrawingEvent = { 
      type: 'toolChanged', 
      drawing: null as any, 
      timestamp: Date.now() 
    };
    this._eventHandlers.get('toolChanged')?.forEach(handler => handler(event));
  }

  // ============================================
  // SERIALIZATION
  // ============================================

  serialize(): SerializedDrawing[] {
    return Array.from(this._drawings.values()).map(d => d.toJSON());
  }

  deserialize(data: SerializedDrawing[]): void {
    this.clearAll();
    
    for (const item of data) {
      let points: ChartPoint[] = [];
      
      if ('startPoint' in item.options && 'endPoint' in item.options) {
        points = [item.options.startPoint as ChartPoint, item.options.endPoint as ChartPoint];
      } else if ('price' in item.options) {
        points = [{ time: 0 as any, price: item.options.price as number }];
      } else if ('time' in item.options) {
        points = [{ time: item.options.time as any, price: 0 }];
      } else if ('topLeft' in item.options && 'bottomRight' in item.options) {
        points = [item.options.topLeft as ChartPoint, item.options.bottomRight as ChartPoint];
      }
      
      const drawing = createPrimitive({
        type: item.type,
        points,
        options: { ...item.options, id: item.id },
      });
      
      if (drawing) this.addDrawing(drawing);
    }
  }

  // ============================================
  // OPTIONS
  // ============================================

  setDefaultColor(color: string): void {
    this._options.defaultColor = color;
  }

  setDefaultLineWidth(width: number): void {
    this._options.defaultLineWidth = width;
  }

  setDefaultLineStyle(style: 'solid' | 'dashed' | 'dotted'): void {
    this._options.defaultLineStyle = style;
  }

  getDefaultOptions(): Required<DrawingManagerOptions> {
    return { ...this._options };
  }
}
