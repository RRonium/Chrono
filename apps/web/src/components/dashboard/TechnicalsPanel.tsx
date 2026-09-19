"use client";

import React, { useEffect, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { fetchOHLC } from "@/lib/api";

export function TechnicalsPanel({ symbol = "AAPL" }: { symbol?: string }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    fetchOHLC(symbol).then((res) => {
      if (res && res.length > 0) {
        setData(res.reverse());
      } else {
        setData([
          { time: "10:00", close: 150, sma: 148, ema: 149 },
          { time: "11:00", close: 152, sma: 149, ema: 150 },
          { time: "12:00", close: 151, sma: 150, ema: 150 },
          { time: "13:00", close: 155, sma: 152, ema: 153 },
          { time: "14:00", close: 154, sma: 153, ema: 153.5 }
        ]);
      }
    });
  }, [symbol]);

  return (
    <div className="hud-panel rounded-lg p-4 flex flex-col h-72">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-mono text-sm text-cyan-300 tracking-wider font-bold">TECHNICALS & OHLC ({symbol})</h3>
        <div className="flex items-center space-x-3 text-[10px] font-mono">
          <span className="text-cyan-400">SMA</span>
          <span className="text-yellow-400">EMA</span>
          <span className="text-[#ff00ff]">RSI</span>
        </div>
      </div>
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="cyanGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#00f0ff" stopOpacity={0.4}/>
                <stop offset="95%" stopColor="#00f0ff" stopOpacity={0.0}/>
              </linearGradient>
            </defs>
            <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
            <YAxis stroke="#64748b" fontSize={10} domain={["auto", "auto"]} />
            <Tooltip contentStyle={{ backgroundColor: "#12121a", borderColor: "#00f0ff" }} />
            <Area type="monotone" dataKey="close" stroke="#00f0ff" strokeWidth={2} fillOpacity={1} fill="url(#cyanGradient)" />
            <Area type="monotone" dataKey="sma" stroke="#ffd700" strokeWidth={1.5} fill="none" />
            <Area type="monotone" dataKey="ema" stroke="#ff00ff" strokeWidth={1.5} fill="none" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
