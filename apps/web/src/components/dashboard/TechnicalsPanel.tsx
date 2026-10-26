"use client";

import React, { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";
import { API_URL, symbolLabel } from "@/lib/constants";

// Helper function to safely parse any time format into a primitive Unix timestamp in seconds
const parseTimestamp = (timeVal: any): number => {
  if (typeof timeVal === "number") {
    return timeVal > 1e11 ? Math.floor(timeVal / 1000) : timeVal;
  }
  if (timeVal instanceof Date) {
    return Math.floor(timeVal.getTime() / 1000);
  }
  if (typeof timeVal === "string") {
    const parsed = Date.parse(timeVal);
    if (!isNaN(parsed)) return Math.floor(parsed / 1000);
  }
  return Math.floor(Date.now() / 1000);
};

const CHART_WINDOW_SECONDS = 5 * 60 * 60;
const CHART_SYMBOLS = ["AAPL", "^GSPC", "^NSEI", "RELIANCE.NS"];

export function TechnicalsPanel({ symbol: initialSymbol = "AAPL" }: { symbol?: string }) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [isSample, setIsSample] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const liveCandlesRef = useRef<Map<number, { open: number; high: number; low: number; close: number; volume: number }>>(new Map());

  const { ticks, connected } = useWebSocket();

  // 1. Chart Initialization & Teardown
  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize chart with dark theme
    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth,
      height: 200,
      layout: {
        background: { color: "transparent" },
        textColor: "#8fa0b8",
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "#21262d",
        scaleMargins: { top: 0.1, bottom: 0.25 },
      },
      timeScale: {
        borderColor: "#21262d",
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
      },
      // Hide left scale or disable
      leftPriceScale: {
        visible: false,
      },
    });

    chartRef.current = chart;

    // Candlestick Series initialized and configured via applyOptions
    const candleSeries = chart.addCandlestickSeries();
    candleSeries.applyOptions({
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = candleSeries;

    // Volume Histogram Series Overlay
    const volumeSeries = chart.addHistogramSeries({
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries;

    // Initial Fetch for Historical Data
    setIsSample(false);
    fetch(`${API_URL}/api/v1/market/ohlc/${encodeURIComponent(symbol)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch OHLC data");
        return res.json();
      })
      .then((data: any[]) => {
        if (!Array.isArray(data) || data.length === 0) {
          throw new Error("Empty OHLC response");
        }
        const candleData = data.map((d) => ({
          time: parseTimestamp(d.time) as any,
          open: Number(d.open),
          high: Number(d.high),
          low: Number(d.low),
          close: Number(d.close),
        }));

        const volumeData = data.map((d) => ({
          time: parseTimestamp(d.time) as any,
          value: Number(d.volume ?? 100),
          color: Number(d.close) >= Number(d.open) ? "#22c55e80" : "#ef444480",
        }));

        candleSeries.setData(candleData);
        volumeSeries.setData(volumeData);
        chart.timeScale().setVisibleRange({
          from: (Math.floor(Date.now() / 1000) - CHART_WINDOW_SECONDS) as any,
          to: Math.floor(Date.now() / 1000) as any,
        });
      })
      .catch((err) => {
        console.warn("Using fallback demo data for TechnicalsPanel:", err);
        setIsSample(true);
        const now = Math.floor(Date.now() / 1000);
        const demoCandles = [
          { time: (now - 3600 * 4) as any, open: 150, high: 152, low: 149, close: 151 },
          { time: (now - 3600 * 3) as any, open: 151, high: 153, low: 150, close: 155 },
          { time: (now - 3600 * 2) as any, open: 155, high: 157, low: 154, close: 154 },
          { time: (now - 3600) as any, open: 154, high: 156, low: 152, close: 153 },
          { time: now as any, open: 153, high: 155, low: 151, close: 154 },
        ];
        const demoVolume = [
          { time: (now - 3600 * 4) as any, value: 900, color: "#22c55e80" },
          { time: (now - 3600 * 3) as any, value: 1200, color: "#22c55e80" },
          { time: (now - 3600 * 2) as any, value: 2400, color: "#ef444480" },
          { time: (now - 3600) as any, value: 1800, color: "#ef444480" },
          { time: now as any, value: 2100, color: "#22c55e80" },
        ];
        candleSeries.setData(demoCandles);
        volumeSeries.setData(demoVolume);
        chart.timeScale().setVisibleRange({ from: (now - CHART_WINDOW_SECONDS) as any, to: now as any });
      });

    // Responsive Container Observer
    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries[0] || !chartRef.current || !containerRef.current) return;
      const { width } = entries[0].contentRect;
      chartRef.current.applyOptions({ width });
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      liveCandlesRef.current.clear();
    };
  }, [symbol]);

  // 2. WebSocket Stream Updates with Strict Primitive Timestamp Conversion
  useEffect(() => {
    if (!candleSeriesRef.current || !ticks.length) return;

    const latestTick = [...ticks]
      .filter((tick) => tick?.symbol?.toUpperCase() === symbol.toUpperCase())
      .sort((left, right) => parseTimestamp(right.time) - parseTimestamp(left.time))[0];
    if (!latestTick) return;

    const tickTime = Math.floor(parseTimestamp(latestTick.time) / 60) * 60;
    const tickPrice = Number(latestTick.price);

    if (isNaN(tickTime) || isNaN(tickPrice)) return;

    try {
      const previous = liveCandlesRef.current.get(tickTime);
      const candle = {
        open: previous?.open ?? Number(latestTick.open ?? tickPrice),
        high: Math.max(previous?.high ?? tickPrice, Number(latestTick.high ?? tickPrice), tickPrice),
        low: Math.min(previous?.low ?? tickPrice, Number(latestTick.low ?? tickPrice), tickPrice),
        close: tickPrice,
        volume: (previous?.volume ?? 0) + Number(latestTick.volume ?? 0),
      };
      liveCandlesRef.current.set(tickTime, candle);

      candleSeriesRef.current.update({
        time: tickTime as any,
        ...candle,
      });

      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.update({
          time: tickTime as any,
          value: candle.volume || 100,
          color: candle.close >= candle.open ? "#22c55e80" : "#ef444480",
        });
      }
    } catch (e) {
      // Lightweight charts can throw if time is not ordered or duplicate
      console.debug("Chart update skip:", e);
    }
  }, [ticks]);

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col h-80 w-full">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-display text-sm tracking-[0.15em] text-gold">PRICE ACTION</h3>
        <span className="text-[10px] font-mono text-ink-faint">
          {isSample && <span className="mr-2 px-1.5 py-0.5 rounded border border-amber-500/40 text-amber-400">SAMPLE DATA</span>}
          FEED: {connected ? <span className="text-cyber-green">LIVE</span> : <span className="text-cyber-red">OFFLINE</span>}
        </span>
      </div>
      <div className="flex gap-1 mb-2 font-mono text-[10px]">
        {CHART_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => setSymbol(s)}
            className={`px-2 py-0.5 rounded border ${symbol === s ? "border-gold text-gold bg-gold/10" : "border-white/10 text-ink-faint hover:text-ink"}`}
          >
            {symbolLabel(s)}
          </button>
        ))}
      </div>
      <div className="flex-1 w-full relative" ref={containerRef} />
    </div>
  );
}
