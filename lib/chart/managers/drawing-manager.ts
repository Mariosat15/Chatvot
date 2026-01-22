/**
 * Drawing Manager
 * Manages all chart drawings, handles mouse interactions, selection, and state
 */

import { IChartApi, ISeriesApi, Time, Coordinate, MouseEventParams } from 'lightweight-charts';
import {
  DrawingToolType,
  ChartPoint,
  ScreenPoint,
  DrawingOptions,
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
  enableSnapping?: boolean;
  snapToPrice?: boolean;
  snapToTime?: boolean;
}

interface DragState {
  drawing: AnyPrimitive;
  anchor: AnchorPosition | null;
  startPoint: ScreenPoint;
  startChartPoint: ChartPoint;
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
  private _isMouseDown: boolean = false;
  
  // Bound event handlers for cleanup
  private _boundMouseDown: (e: MouseEvent) => void;
  private _boundMouseMove: (e: MouseEvent) => void;
  private _boundMouseUp: (e: MouseEvent) => void;
  private _boundKeyDown: (e: KeyboardEvent) => void;
  private _boundChartClick: (param: MouseEventParams) => void;

  constructor(options: DrawingManagerOptions = {}) {
    this._options = {
      defaultColor: options.defaultColor ?? '#2962ff',
      defaultLineWidth: options.defaultLineWidth ?? 2,
      defaultLineStyle: options.defaultLineStyle ?? 'solid',
      selectionThreshold: options.selectionThreshold ?? 10,
      anchorThreshold: options.anchorThreshold ?? 15,
      enableSnapping: options.enableSnapping ?? false,
      snapToPrice: options.snapToPrice ?? false,
      snapToTime: options.snapToTime ?? false,
    };

    // Bind event handlers
    this._boundMouseDown = this.handleMouseDown.bind(this);
    this._boundMouseMove = this.handleMouseMove.bind(this);
    this._boundMouseUp = this.handleMouseUp.bind(this);
    this._boundKeyDown = this.handleKeyDown.bind(this);
    this._boundChartClick = this.handleChartClick.bind(this);
  }

  // ============================================
  // LIFECYCLE
  // ============================================

  attach(chart: IChartApi, series: ISeriesApi<'Candlestick'>, container: HTMLElement): void {
    this._chart = chart;
    this._series = series;
    this._containerElement = container;
    
    // Add event listeners to container
    container.addEventListener('mousedown', this._boundMouseDown);
    container.addEventListener('mousemove', this._boundMouseMove);
    container.addEventListener('mouseup', this._boundMouseUp);
    document.addEventListener('keydown', this._boundKeyDown);
    
    // Subscribe to chart click events
    chart.subscribeClick(this._boundChartClick);
  }

  detach(): void {
    // Remove all drawings
    this.clearAll();
    
    // Remove event listeners
    if (this._containerElement) {
      this._containerElement.removeEventListener('mousedown', this._boundMouseDown);
      this._containerElement.removeEventListener('mousemove', this._boundMouseMove);
      this._containerElement.removeEventListener('mouseup', this._boundMouseUp);
    }
    document.removeEventListener('keydown', this._boundKeyDown);
    
    // Unsubscribe from chart
    if (this._chart) {
      this._chart.unsubscribeClick(this._boundChartClick);
    }
    
    this._chart = null;
    this._series = null;
    this._containerElement = null;
  }

  // ============================================
  // TOOL MANAGEMENT
  // ============================================

  setActiveTool(tool: DrawingToolType): void {
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
    if (!toolInfo) return;
    
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
    
    // Create preview primitive
    this._session.preview = this.createPreviewPrimitive([point, point]);
    if (this._session.preview && this._series) {
      this._session.preview.attach(this._chart!, this._series);
    }
    
    this._session.state = 'drawing';
  }

  private updateDrawing(point: ChartPoint): void {
    if (!this._session || this._session.state !== 'drawing') return;
    if (!this._session.preview) return;
    
    // Update preview with new endpoint
    const points = [this._session.points[0], point];
    
    // Update the preview primitive
    if (this._session.tool === 'trend-line' || this._session.tool === 'ray' || 
        this._session.tool === 'extended-line' || this._session.tool === 'arrow') {
      (this._session.preview as any).setPoints(points[0], points[1]);
    } else if (this._session.tool === 'rectangle') {
      (this._session.preview as any).setCorners(points[0], points[1]);
    } else if (this._session.tool === 'fibonacci') {
      (this._session.preview as any).setPoints(points[0], points[1]);
    }
  }

  private completeDrawing(): void {
    if (!this._session) return;
    
    // Remove preview
    if (this._session.preview) {
      this._session.preview.detach();
    }
    
    // Create actual drawing
    const drawing = createPrimitive({
      type: this._session.tool,
      points: this._session.points.length === 1 
        ? this._session.points 
        : [this._session.points[0], this._session.points[this._session.points.length - 1]],
      options: {
        color: this._options.defaultColor,
        lineWidth: this._options.defaultLineWidth,
        lineStyle: this._options.defaultLineStyle,
      },
    });
    
    if (drawing && this._series) {
      this.addDrawing(drawing);
      this.emitEvent('created', drawing);
    }
    
    // Clear session
    this._session = null;
    
    // Keep tool active for multiple drawings (hold shift to deselect tool)
    // this._activeTool = null;
    this.updateCursor();
  }

  cancelDrawing(): void {
    if (!this._session) return;
    
    // Remove preview
    if (this._session.preview) {
      this._session.preview.detach();
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
    if (!this._series) return;
    
    drawing.attach(this._chart!, this._series);
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
      drawing.detach();
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

  private hitTestAnchor(point: ScreenPoint, drawing: AnyPrimitive): AnchorPosition | null {
    return drawing.getAnchorAtPoint(point, this._options.anchorThreshold);
  }

  // ============================================
  // COORDINATE CONVERSION
  // ============================================

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

  private getMousePoint(e: MouseEvent): ScreenPoint | null {
    if (!this._containerElement) return null;
    
    const rect = this._containerElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  // ============================================
  // EVENT HANDLERS
  // ============================================

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return; // Only left click
    
    const screenPoint = this.getMousePoint(e);
    if (!screenPoint) return;
    
    this._isMouseDown = true;
    
    // If drawing, continue with the drawing flow
    if (this._session?.state === 'drawing') {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this._session.points.push(chartPoint);
        this.completeDrawing();
      }
      return;
    }
    
    // If we have a selected drawing, check for anchor drag
    if (this._selectedId) {
      const drawing = this._drawings.get(this._selectedId);
      if (drawing) {
        const anchor = this.hitTestAnchor(screenPoint, drawing);
        if (anchor) {
          const chartPoint = this.screenToChart(screenPoint);
          if (chartPoint) {
            this._dragState = {
              drawing,
              anchor,
              startPoint: screenPoint,
              startChartPoint: chartPoint,
            };
            e.preventDefault();
            e.stopPropagation();
            return;
          }
        }
      }
    }
    
    // Check for drawing hit (for dragging entire drawing)
    const hit = this.hitTest(screenPoint);
    if (hit && hit.id === this._selectedId) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this._dragState = {
          drawing: hit,
          anchor: null, // null means drag entire drawing
          startPoint: screenPoint,
          startChartPoint: chartPoint,
        };
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    const screenPoint = this.getMousePoint(e);
    if (!screenPoint) return;
    
    // If dragging
    if (this._dragState && this._isMouseDown) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        if (this._dragState.anchor) {
          // Dragging an anchor
          this._dragState.drawing.moveAnchor(this._dragState.anchor, chartPoint);
        } else {
          // Dragging entire drawing
          const deltaPrice = chartPoint.price - this._dragState.startChartPoint.price;
          this._dragState.drawing.move(deltaPrice, 0);
          this._dragState.startChartPoint = chartPoint;
        }
        this.emitEvent('moved', this._dragState.drawing);
      }
      return;
    }
    
    // If drawing, update preview
    if (this._session?.state === 'drawing') {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this.updateDrawing(chartPoint);
      }
      return;
    }
    
    // Hover detection
    const hit = this.hitTest(screenPoint);
    const hitId = hit?.id || null;
    
    if (hitId !== this._hoveredId) {
      // Clear previous hover
      if (this._hoveredId) {
        const prev = this._drawings.get(this._hoveredId);
        if (prev) prev.setHovered(false);
      }
      
      // Set new hover
      if (hitId) {
        hit!.setHovered(true);
      }
      
      this._hoveredId = hitId;
    }
    
    this.updateCursor();
  }

  private handleMouseUp(_e: MouseEvent): void {
    this._isMouseDown = false;
    
    if (this._dragState) {
      this.emitEvent('resized', this._dragState.drawing);
      this._dragState = null;
    }
  }

  private handleChartClick(param: MouseEventParams): void {
    if (!param.point) return;
    
    const screenPoint: ScreenPoint = { x: param.point.x, y: param.point.y };
    
    // If we have an active tool, start drawing
    if (this._activeTool && !this._session) {
      const chartPoint = this.screenToChart(screenPoint);
      if (chartPoint) {
        this.startDrawing(chartPoint);
      }
      return;
    }
    
    // Otherwise, handle selection
    if (!this._activeTool && !this._session) {
      const hit = this.hitTest(screenPoint);
      
      if (hit) {
        this.select(hit.id);
      } else {
        this.deselect();
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
    
    let cursor = 'default';
    
    if (this._activeTool || this._session) {
      cursor = 'crosshair';
    } else if (this._dragState) {
      cursor = 'grabbing';
    } else if (this._hoveredId) {
      const drawing = this._drawings.get(this._hoveredId);
      if (drawing && this._selectedId === this._hoveredId) {
        // Check if near an anchor
        cursor = 'move';
      } else {
        cursor = 'pointer';
      }
    }
    
    this._containerElement.style.cursor = cursor;
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
