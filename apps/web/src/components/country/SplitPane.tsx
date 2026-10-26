"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "chrono:country-split";
const DEFAULT_SPLIT = 0.55;
const MIN_PANE_VIEWPORT = 0.1; // each pane is at least 10% of the viewport width
const KEY_STEP = 0.02;
const DIVIDER_PX = 12; // w-3

function readStoredSplit(): number {
  try {
    const stored = Number(window.localStorage.getItem(STORAGE_KEY));
    return stored > 0 && stored < 1 ? stored : DEFAULT_SPLIT;
  } catch {
    return DEFAULT_SPLIT;
  }
}

// Two side-by-side panes with a draggable divider. Below the lg breakpoint they stack instead.
export function SplitPane({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(DEFAULT_SPLIT);
  const [dragging, setDragging] = useState(false);
  const [limits, setLimits] = useState({ min: MIN_PANE_VIEWPORT, max: 1 - MIN_PANE_VIEWPORT });

  // Smallest and largest allowed fraction of the container for the left pane.
  const bounds = useCallback(() => {
    const width = containerRef.current?.clientWidth || window.innerWidth;
    const minPx = window.innerWidth * MIN_PANE_VIEWPORT;
    const min = Math.min(0.5, minPx / width);
    return { min, max: Math.max(min, (width - minPx - DIVIDER_PX) / width) };
  }, []);

  const clamp = useCallback(
    (value: number) => {
      const { min, max } = bounds();
      return Math.min(max, Math.max(min, value));
    },
    [bounds],
  );

  useEffect(() => {
    setSplit(clamp(readStoredSplit()));
    setLimits(bounds());
    const onResize = () => {
      setLimits(bounds());
      setSplit((current) => clamp(current));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [bounds, clamp]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, split.toFixed(4));
    } catch {}
  }, [split]);

  const moveTo = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setSplit(clamp((clientX - rect.left) / rect.width));
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const { min, max } = limits;
    const next: Record<string, number> = {
      ArrowLeft: split - KEY_STEP,
      ArrowRight: split + KEY_STEP,
      Home: min,
      End: max,
    };
    if (event.key in next) {
      event.preventDefault();
      setSplit(clamp(next[event.key]));
    }
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col lg:flex-row flex-1 min-h-0 ${dragging ? "select-none cursor-col-resize" : ""}`}
      style={{ "--split": `${split * 100}%` } as React.CSSProperties}
    >
      <div className="relative h-[45vh] lg:h-auto lg:w-[var(--split)] shrink-0 min-w-0">{left}</div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize map and data panes"
        aria-valuemin={Math.round(limits.min * 100)}
        aria-valuemax={Math.round(limits.max * 100)}
        aria-valuenow={Math.round(split * 100)}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onDoubleClick={() => setSplit(clamp(DEFAULT_SPLIT))}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={(event) => dragging && moveTo(event.clientX)}
        onPointerUp={(event) => {
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        className="hidden lg:flex group relative w-3 shrink-0 cursor-col-resize items-center justify-center touch-none outline-none"
        title="Drag to resize · double-click to reset"
      >
        <span className={`h-full w-px transition-colors ${dragging ? "bg-gold" : "bg-gold/25 group-hover:bg-gold/70 group-focus-visible:bg-gold"}`} />
        <span className="absolute flex flex-col gap-1 rounded border border-gold/40 bg-[#07101e] px-0.5 py-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="h-1 w-1 rounded-full bg-gold/70" />
          ))}
        </span>
      </div>
      <div className="flex-1 min-w-0 min-h-0">{right}</div>
    </div>
  );
}
