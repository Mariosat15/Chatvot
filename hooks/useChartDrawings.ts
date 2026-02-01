"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { IChartApi, ISeriesApi } from "lightweight-charts";
import { DrawingManager, DrawingManagerOptions } from "@/lib/chart/managers";
import {
  DrawingToolType,
  AnyPrimitive,
  SerializedDrawing,
} from "@/lib/chart/primitives";

// ============================================
// TYPES
// ============================================

export interface UseChartDrawingsOptions extends DrawingManagerOptions {
  storageKey?: string;
  autoSave?: boolean;
}

export interface UseChartDrawingsReturn {
  // Manager reference
  manager: DrawingManager | null;

  // Tool state
  activeTool: DrawingToolType;
  setActiveTool: (tool: DrawingToolType) => void;

  // Selection state
  selectedDrawing: AnyPrimitive | null;
  hasSelection: boolean;

  // Drawings state
  drawings: AnyPrimitive[];
  drawingsCount: number;

  // Actions
  deleteSelected: () => void;
  clearAll: () => void;

  // Settings
  defaultColor: string;
  defaultLineWidth: number;
  setDefaultColor: (color: string) => void;
  setDefaultLineWidth: (width: number) => void;

  // Lifecycle
  attach: (
    chart: IChartApi,
    series: ISeriesApi<"Candlestick">,
    container: HTMLElement,
  ) => void;
  detach: () => void;

  // Serialization
  save: () => void;
  load: () => void;
}

// ============================================
// HOOK
// ============================================

export function useChartDrawings(
  options: UseChartDrawingsOptions = {},
): UseChartDrawingsReturn {
  const {
    storageKey = "chart-drawings",
    autoSave = true,
    ...managerOptions
  } = options;

  // Manager reference - create once and persist
  const managerRef = useRef<DrawingManager | null>(null);

  // Ensure manager exists
  if (!managerRef.current) {
    managerRef.current = new DrawingManager(managerOptions);
    console.log("[useChartDrawings] Created DrawingManager");
  }

  // State
  const [activeTool, setActiveToolState] = useState<DrawingToolType>(null);
  const [selectedDrawing, setSelectedDrawing] = useState<AnyPrimitive | null>(
    null,
  );
  const [drawings, setDrawings] = useState<AnyPrimitive[]>([]);
  const [defaultColor, setDefaultColorState] = useState(
    managerOptions.defaultColor ?? "#2962ff",
  );
  const [defaultLineWidth, setDefaultLineWidthState] = useState(
    managerOptions.defaultLineWidth ?? 2,
  );
  const [_isAttached, setIsAttached] = useState(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[useChartDrawings] Cleaning up");
      managerRef.current?.detach();
    };
  }, []);

  // Set up event listeners when manager changes
  useEffect(() => {
    const manager = managerRef.current;
    if (!manager) return;

    const updateDrawings = () => {
      setDrawings(manager.getAllDrawings());
    };

    const handleSelected = () => {
      setSelectedDrawing(manager.getSelectedDrawing());
      updateDrawings();
    };

    const handleDeselected = () => {
      setSelectedDrawing(null);
      updateDrawings();
    };

    const handleCreated = () => {
      updateDrawings();
      // Sync tool state after creation (manager auto-switches to selection mode)
      setActiveToolState(manager.getActiveTool());
      setSelectedDrawing(manager.getSelectedDrawing());
    };

    const handleDeleted = () => {
      setSelectedDrawing(null);
      updateDrawings();
    };

    const handleMoved = () => {
      updateDrawings();
    };

    const handleToolChanged = () => {
      // Sync React state with manager state
      setActiveToolState(manager.getActiveTool());
    };

    manager.on("selected", handleSelected);
    manager.on("deselected", handleDeselected);
    manager.on("created", handleCreated);
    manager.on("deleted", handleDeleted);
    manager.on("moved", handleMoved);
    manager.on("toolChanged", handleToolChanged);

    return () => {
      manager.off("selected", handleSelected);
      manager.off("deselected", handleDeselected);
      manager.off("created", handleCreated);
      manager.off("deleted", handleDeleted);
      manager.off("moved", handleMoved);
      manager.off("toolChanged", handleToolChanged);
    };
  }, []);

  // Set active tool
  const setActiveTool = useCallback((tool: DrawingToolType) => {
    console.log(
      "[useChartDrawings] setActiveTool:",
      tool,
      "isAttached:",
      managerRef.current?.isAttached(),
    );
    setActiveToolState(tool);
    managerRef.current?.setActiveTool(tool);
  }, []);

  // Set default color
  const setDefaultColor = useCallback((color: string) => {
    setDefaultColorState(color);
    managerRef.current?.setDefaultColor(color);
  }, []);

  // Set default line width
  const setDefaultLineWidth = useCallback((width: number) => {
    setDefaultLineWidthState(width);
    managerRef.current?.setDefaultLineWidth(width);
  }, []);

  // Delete selected
  const deleteSelected = useCallback(() => {
    managerRef.current?.deleteSelected();
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    managerRef.current?.clearAll();
    setSelectedDrawing(null);
    setDrawings([]);
    // Clear localStorage
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  }, [storageKey]);

  // Save drawings to storage
  const save = useCallback(() => {
    if (!managerRef.current) return;

    try {
      const data = managerRef.current.serialize();
      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log("[useChartDrawings] Saved", data.length, "drawings");
    } catch (error) {
      console.error("Failed to save drawings:", error);
    }
  }, [storageKey]);

  // Load drawings from storage
  const load = useCallback(() => {
    if (!managerRef.current || !managerRef.current.isAttached()) {
      console.log("[useChartDrawings] Cannot load - manager not attached");
      return;
    }

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: SerializedDrawing[] = JSON.parse(stored);
        managerRef.current.deserialize(data);
        setDrawings(managerRef.current.getAllDrawings());
        console.log("[useChartDrawings] Loaded", data.length, "drawings");
      }
    } catch (error) {
      console.error("Failed to load drawings:", error);
    }
  }, [storageKey]);

  // Attach to chart
  const attach = useCallback(
    (
      chart: IChartApi,
      series: ISeriesApi<"Candlestick">,
      container: HTMLElement,
    ) => {
      // Guard: Check if chart is valid before attaching
      try {
        // Try to access a chart method to verify it's not disposed
        chart.timeScale();
      } catch {
        console.log("[useChartDrawings] Cannot attach - chart is disposed");
        return;
      }

      console.log("[useChartDrawings] Attaching to chart");
      try {
        managerRef.current?.attach(chart, series, container);
        setIsAttached(true);

        // Load saved drawings after attachment
        setTimeout(() => {
          load();
        }, 100);
      } catch (error) {
        console.log("[useChartDrawings] Error during attach:", error);
        setIsAttached(false);
      }
    },
    [load],
  );

  // Detach from chart
  const detach = useCallback(() => {
    console.log("[useChartDrawings] Detaching from chart");
    try {
      if (autoSave) save();
      managerRef.current?.detach();
    } catch (error) {
      console.log(
        "[useChartDrawings] Error during detach (chart may already be disposed):",
        error,
      );
    }
    setIsAttached(false);
  }, [autoSave, save]);

  return {
    manager: managerRef.current,
    activeTool,
    setActiveTool,
    selectedDrawing,
    hasSelection: selectedDrawing !== null,
    drawings,
    drawingsCount: drawings.length,
    deleteSelected,
    clearAll,
    defaultColor,
    defaultLineWidth,
    setDefaultColor,
    setDefaultLineWidth,
    attach,
    detach,
    save,
    load,
  };
}

export default useChartDrawings;
