"use client";

import React, { useEffect, useRef } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { createChart, IChartApi, ISeriesApi } from "lightweight-charts";

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

export function TechnicalsPanel({ symbol = "AAPL" }: { symbol?: string }) {
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
      height: 220,
      layout: {
        background: { color: "#0d1117" },
        textColor: "#8b949e",
      },
      grid: {
        vertLines: { color: "#21262d" },
        horzLines: { color: "#21262d" },
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
      upColor: "#00ff9d",
      downColor: "#ff0055",
      borderUpColor: "#00ff9d",
      borderDownColor: "#ff0055",
      wickUpColor: "#00ff9d",
      wickDownColor: "#ff0055",
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
    fetch(`/api/v1/market/ohlc/${symbol}`)
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
          color: Number(d.close) >= Number(d.open) ? "#00ff9d80" : "#ff005580",
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
        const now = Math.floor(Date.now() / 1000);
        const demoCandles = [
          { time: (now - 3600 * 4) as any, open: 150, high: 152, low: 149, close: 151 },
          { time: (now - 3600 * 3) as any, open: 151, high: 153, low: 150, close: 155 },
          { time: (now - 3600 * 2) as any, open: 155, high: 157, low: 154, close: 154 },
          { time: (now - 3600) as any, open: 154, high: 156, low: 152, close: 153 },
          { time: now as any, open: 153, high: 155, low: 151, close: 154 },
        ];
        const demoVolume = [
          { time: (now - 3600 * 4) as any, value: 900, color: "#00ff9d80" },
          { time: (now - 3600 * 3) as any, value: 1200, color: "#00ff9d80" },
          { time: (now - 3600 * 2) as any, value: 2400, color: "#ff005580" },
          { time: (now - 3600) as any, value: 1800, color: "#ff005580" },
          { time: now as any, value: 2100, color: "#00ff9d80" },
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
          color: candle.close >= candle.open ? "#00ff9d80" : "#ff005580",
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
        <h3 className="font-mono text-sm text-cyan-300 tracking-wider font-bold">
          TECHNICALS & OHLC ({symbol})
        </h3>
        <span className="text-xs font-mono text-gray-400">
          WS:{" "}
          {connected ? (
            <span className="text-emerald-400">ONLINE</span>
          ) : (
            <span className="text-rose-500">OFFLINE</span>
          )}
        </span>
      </div>
      <div className="flex-1 w-full relative" ref={containerRef} />
    </div>
  );
}
