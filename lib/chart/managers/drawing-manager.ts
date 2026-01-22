/**
 * Drawing Manager
 * Manages all chart drawings, handles mouse interactions, selection, and state
 */

import { IChartApi, ISeriesApi, Time, Coordinate, MouseEventParams } from 'lightweight-charts';
import {
  DrawingToolType,
  ChartPoint,
  ScreenPoint,
  DrawingState,
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
  anchor: AnchorPosition | null; // null means dragging entire drawing
  startScreenPoint: ScreenPoint;
  startChartPoint: ChartPoint;
  lastChartPoint: ChartPoint;
  hasMoved: boolean;
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
  private _pendingClickHit: AnyPrimitive | null = null;
  
  // Bound event handlers for cleanup
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

    // Bind event handlers
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
    if (this._isAttached) {
      this.detach();
    }

    this._chart = chart;
    this._series = series;
    this._containerElement = container;
    this._isAttached = true;
    
    // Subscribe to chart events (for drawing new shapes)
    chart.subscribeClick(this._boundChartClick);
    chart.subscribeCrosshairMove(this._boundCrosshairMove);
    
    // Add DOM event listeners (for dragging/editing)
    container.addEventListener('mousedown', this._boundMouseDown);
    document.addEventListener('mousemove', this._boundMouseMove);
    document.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('keydown', this._boundKeyDown);

    console.log('[DrawingManager] Attached to chart');
  }

  detach(): void {
    if (!this._isAttached) return;

    // Remove all drawings
    this.clearAll();
    
    // Unsubscribe from chart events
    if (this._chart) {
      try {
        this._chart.unsubscribeClick(this._boundChartClick);
        this._chart.unsubscribeCrosshairMove(this._boundCrosshairMove);
      } catch {
        // Chart may be disposed
      }
    }
    
    // Remove DOM event listeners
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
    
    console.log('[DrawingManager] Detached from chart');
  }

  isAttached(): boolean {
    return this._isAttached;
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  setActiveTool(tool: DrawingToolType): void {
    console.log('[DrawingManager] setActiveTool:', tool);
    
    // Cancel any active session
    if (this._session) {
      this.cancelDrawing();
    }
    
    this._activeTool = tool;
    
    // Update cursor
    this.updateCursor();
    
    // Deselect if switching to a drawing tool
    if (tool !== null) {
      this.deselect();
    }
  }

  getActiveTool(): DrawingToolType {
    return this._activeTool;
  }

  // ============================================
  // DRAWING CREATION
  // ============================================

  private startDrawing(point: ChartPoint): void {
    if (!this._activeTool) return;
    
    const toolInfo = getToolInfo(this._activeTool);
    if (!toolInfo) {
      console.log('[DrawingManager] Unknown tool:', this._activeTool);
      return;
    }
    
    console.log('[DrawingManager] Starting drawing:', this._activeTool, 'at', point);
    
    this._session = {
      tool: this._activeTool,
      state: 'placing',
      points: [point],
      preview: undefined,
    };
    
    // If tool only needs one point, complete immediately
    if (toolInfo.pointsRequired === 1) {
      this.completeDrawing();
      return;
    }
    
    // Create preview primitive for 2-point tools
    this._session.preview = this.createPreviewPrimitive([point, point]);
    if (this._session.preview && this._series) {
      this._session.preview.attach(this._chart!, this._series);
      console.log('[DrawingManager] Preview created');
    }
    
    this._session.state = 'drawing';
  }

  private updateDrawing(point: ChartPoint): void {
    if (!this._session || this._session.state !== 'drawing') return;
    if (!this._session.preview) return;
    
    // Update preview with new endpoint
    const preview = this._session.preview;
    const tool = this._session.tool;
    
    try {
      if (tool === 'trend-line' || tool === 'ray' || 
          tool === 'extended-line' || tool === 'arrow') {
        (preview as any).setPoints(this._session.points[0], point);
      } else if (tool === 'rectangle') {
        (preview as any).setCorners(this._session.points[0], point);
      } else if (tool === 'fibonacci') {
        (preview as any).setPoints(this._session.points[0], point);
      }
    } catch (error) {
      console.error('[DrawingManager] Failed to update preview:', error);
    }
  }

  private completeDrawing(): void {
    if (!this._session) return;
    
    console.log('[DrawingManager] Completing drawing');
    
    // Remove preview
    if (this._session.preview) {
      try {
        this._session.preview.detach();
      } catch {}
    }
    
    // Get final points
    const points = this._session.points.length === 1 
      ? this._session.points 
      : [this._session.points[0], this._session.points[this._session.points.length - 1]];
    
    // Create actual drawing
    const drawing = createPrimitive({
      type: this._session.tool,
      points,
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
    
    if (drawing && this._series) {
      this.addDrawing(drawing);
      this.emitEvent('created', drawing);
      console.log('[DrawingManager] Drawing created:', drawing.id);
    }
    
    // Clear session
    this._session = null;
    this.updateCursor();
  }

  cancelDrawing(): void {
    if (!this._session) return;
    
    console.log('[DrawingManager] Canceling drawing');
    
    // Remove preview
    if (this._session.preview) {
      try {
        this._session.preview.detach();
      } catch {}
    }
    
    this._session = null;
    this.updateCursor();
  }

  private createPreviewPrimitive(points: ChartPoint[]): AnyPrimitive | null {
    return createPrimitive({
      type: this._activeTool,
      points,
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
    
    if (this._selectedId === id) {
      this._selectedId = null;
    }
    
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
      try {
        drawing.detach();
      } catch {}
    }
    this._drawings.clear();
    this._selectedId = null;
    this._hoveredId = null;
  }

  // ============================================
  // SELECTION
  // ============================================

  select(id: string): void {
    // Deselect previous
    if (this._selectedId && this._selectedId !== id) {
      const prev = this._drawings.get(this._selectedId);
      if (prev) {
        prev.setSelected(false);
        this.emitEvent('deselected', prev);
      }
    }
    
    // Select new
    const drawing = this._drawings.get(id);
    if (drawing) {
      drawing.setSelected(true);
      this._selectedId = id;
      this.emitEvent('selected', drawing);
      console.log('[DrawingManager] Selected drawing:', id);
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
    if (this._selectedId) {
      this.removeDrawing(this._selectedId);
    }
  }

  // ============================================
  // HIT TESTING
  // ============================================

  private hitTest(point: ScreenPoint): AnyPrimitive | null {
    // Test in reverse order (top to bottom)
    const drawings = Array.from(this._drawings.values()).reverse();
    
    for (const drawing of drawings) {
      if (drawing.hitTest(point)) {
        return drawing;
      }
    }
    
    return null;
  }

  private hitTestAnchor(point: ScreenPoint): { drawing: AnyPrimitive; anchor: AnchorPosition } | null {
    // Only test anchors on selected drawing
    if (!this._selectedId) return null;
    
    const drawing = this._drawings.get(this._selectedId);
    if (!drawing) return null;
    
    const anchor = drawing.getAnchorAtPoint(point, this._options.anchorThreshold);
    if (anchor) {
      return { drawing, anchor };
    }
    
    return null;
  }

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

  private getScreenPoint(e: MouseEvent): ScreenPoint | null {
    if (!this._containerElement) return null;
    
    const rect = this._containerElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private screenToChart(point: ScreenPoint): ChartPoint | null {
    if (!this._chart || !this._series) return null;
    
    try {
      const time = this._chart.timeScale().coordinateToTime(point.x as Coordinate);
      const price = this._series.coordinateToPrice(point.y as Coordinate);
      
      if (time === null || price === null) return null;
      
      return { time, price };
    } catch {
      return null;
    }
  }

  private getChartPointFromEvent(param: MouseEventParams): ChartPoint | null {
    if (!param.point || !this._chart || !this._series) {
      return null;
    }

    try {
      // Get price from Y coordinate
      const price = this._series.coordinateToPrice(param.point.y as Coordinate);
      if (price === null || price === undefined) {
        return null;
      }

      // Get time - use param.time if available, otherwise convert from X
      let time: Time;
      if (param.time) {
        time = param.time;
      } else {
        const timeValue = this._chart.timeScale().coordinateToTime(param.point.x as Coordinate);
        if (timeValue === null) {
          return null;
        }
        time = timeValue;
      }

      return { time, price };
    } catch {
      return null;
    }
  }

  // ============================================
  // MOUSE EVENT HANDLERS (for dragging and selection)
  // ============================================

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Only left click
    
    // Don't interfere with drawing mode
    if (this._activeTool || this._session) return;
    
    const screenPoint = this.getScreenPoint(e);
    if (!screenPoint) return;
    
    this._isMouseDown = true;
    this._pendingClickHit = null;
    
    // Check if we're clicking on an anchor of the selected drawing
    const anchorHit = this.hitTestAnchor(screenPoint);
    if (anchorHit) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this._dragState = {
          drawing: anchorHit.drawing,
          anchor: anchorHit.anchor,
          startScreenPoint: screenPoint,
          startChartPoint: chartPoint,
          lastChartPoint: chartPoint,
          hasMoved: false,
        };
        console.log('[DrawingManager] Prepared anchor drag:', anchorHit.anchor);
        this.updateCursorForDrag('anchor');
        return;
      }
    }
    
    // Check if we're clicking on a drawing
    const hit = this.hitTest(screenPoint);
    if (hit) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        // If clicking on unselected drawing, store for potential selection
        if (hit.id !== this._selectedId) {
          this._pendingClickHit = hit;
        }
        
        // Prepare for potential drag
        this._dragState = {
          drawing: hit,
          anchor: null, // null = move entire drawing
          startScreenPoint: screenPoint,
          startChartPoint: chartPoint,
          lastChartPoint: chartPoint,
          hasMoved: false,
        };
        console.log('[DrawingManager] Prepared drawing drag (selected:', hit.id === this._selectedId, ')');
        this.updateCursorForDrag('move');
        return;
      }
    }
    
    // Clicked on empty space - deselect
    this.deselect();
  }

  private handleMouseMove(e: MouseEvent): void {
    const screenPoint = this.getScreenPoint(e);
    if (!screenPoint) return;
    
    // Handle dragging
    if (this._dragState && this._isMouseDown) {
      const chartPoint = this.screenToChart(screenPoint);
      if (!chartPoint) return;
      
      // Calculate movement
      const dx = screenPoint.x - this._dragState.startScreenPoint.x;
      const dy = screenPoint.y - this._dragState.startScreenPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // Only start actual drag after moving more than 3 pixels
      const DRAG_THRESHOLD = 3;
      if (distance > DRAG_THRESHOLD) {
        this._dragState.hasMoved = true;
        
        // If dragging an unselected drawing, select it first
        if (!this._dragState.anchor && this._dragState.drawing.id !== this._selectedId) {
          this.select(this._dragState.drawing.id);
        }
        
        if (this._dragState.anchor) {
          // Dragging an anchor - resize/reshape
          this._dragState.drawing.moveAnchor(this._dragState.anchor, chartPoint);
        } else {
          // Dragging entire drawing - move it
          const deltaPrice = chartPoint.price - this._dragState.lastChartPoint.price;
          this._dragState.drawing.move(deltaPrice, 0);
          this._dragState.lastChartPoint = chartPoint;
        }
        
        this.emitEvent('moved', this._dragState.drawing);
      }
      return;
    }
    
    // Update cursor based on hover state (only when not drawing)
    if (!this._activeTool && !this._session) {
      this.updateHoverCursor(screenPoint);
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    this._isMouseDown = false;
    
    if (this._dragState) {
      if (this._dragState.hasMoved) {
        // Completed a drag
        console.log('[DrawingManager] Finished dragging');
        this.emitEvent('resized', this._dragState.drawing);
      } else {
        // Was a click, not a drag
        if (this._pendingClickHit) {
          // Select the drawing that was clicked
          this.select(this._pendingClickHit.id);
          console.log('[DrawingManager] Selected via click:', this._pendingClickHit.id);
        }
      }
      
      this._dragState = null;
    }
    
    this._pendingClickHit = null;
    this.updateCursor();
  }

  private updateHoverCursor(screenPoint: ScreenPoint): void {
    if (!this._containerElement) return;
    
    // Check anchor hover on selected drawing
    const anchorHit = this.hitTestAnchor(screenPoint);
    if (anchorHit) {
      // Different cursors for different anchors
      const anchor = anchorHit.anchor;
      if (anchor === 'start' || anchor === 'end') {
        this._containerElement.style.cursor = 'grab';
      } else if (anchor === 'middle' || anchor === 'center') {
        this._containerElement.style.cursor = 'move';
      } else {
        this._containerElement.style.cursor = 'grab';
      }
      return;
    }
    
    // Check drawing hover
    const hit = this.hitTest(screenPoint);
    if (hit) {
      this._containerElement.style.cursor = hit.id === this._selectedId ? 'move' : 'pointer';
      
      // Update hover state
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
    
    this._containerElement.style.cursor = 'default';
  }

  private updateCursorForDrag(type: 'anchor' | 'move'): void {
    if (!this._containerElement) return;
    this._containerElement.style.cursor = type === 'anchor' ? 'grabbing' : 'move';
  }

  // ============================================
  // CHART EVENT HANDLERS (for drawing new shapes)
  // ============================================

  private handleChartClick(param: MouseEventParams): void {
    // If dragging, ignore chart clicks
    if (this._dragState || this._isMouseDown) return;
    
    if (!param.point) {
      return;
    }
    
    // Get chart coordinates from the event
    const chartPoint = this.getChartPointFromEvent(param);
    
    if (!chartPoint) {
      console.log('[DrawingManager] Could not get chart coordinates from click');
      return;
    }
    
    // If we have an active tool, handle drawing
    if (this._activeTool) {
      if (!this._session) {
        // Start new drawing
        this.startDrawing(chartPoint);
      } else if (this._session.state === 'drawing') {
        // Complete the drawing
        this._session.points.push(chartPoint);
        this.completeDrawing();
      }
      return;
    }
    
    // No active tool - selection is handled by mousedown/mouseup events
  }

  private handleCrosshairMove(param: MouseEventParams): void {
    if (!param.point) return;
    
    // If drawing, update preview
    if (this._session?.state === 'drawing') {
      const chartPoint = this.getChartPointFromEvent(param);
      if (chartPoint) {
        this.updateDrawing(chartPoint);
      }
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Delete selected drawing
    if ((e.key === 'Delete' || e.key === 'Backspace') && this._selectedId) {
      e.preventDefault();
      this.deleteSelected();
      return;
    }
    
    // Cancel drawing or deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this._session) {
        this.cancelDrawing();
      } else if (this._activeTool) {
        this.setActiveTool(null);
      } else {
        this.deselect();
      }
      return;
    }
  }

  // ============================================
  // CURSOR MANAGEMENT
  // ============================================

  private updateCursor(): void {
    if (!this._containerElement) return;
    
    if (this._activeTool || this._session) {
      this._containerElement.style.cursor = 'crosshair';
    } else if (this._dragState) {
      this._containerElement.style.cursor = 'grabbing';
    } else {
      this._containerElement.style.cursor = 'default';
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
    const event: DrawingEvent = {
      type,
      drawing,
      timestamp: Date.now(),
    };
    
    this._eventHandlers.get(type)?.forEach(handler => handler(event));
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
      // Recreate points from options
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
      
      if (drawing) {
        this.addDrawing(drawing);
      }
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
