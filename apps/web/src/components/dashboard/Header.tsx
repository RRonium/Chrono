import React from "react";
import { Activity, Globe2 } from "lucide-react";

export function Header({ connected }: { connected: boolean }) {
  return (
    <header className="bg-[#12121a] border-b border-cyan-500/30 px-6 py-4 flex items-center justify-between shadow-[0_0_15px_rgba(0,240,255,0.1)]">
      <div className="flex items-center space-x-3">
        <Globe2 className="w-6 h-6 text-cyan-400 animate-pulse" />
        <h1 className="text-xl font-bold tracking-wider font-mono text-white drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]">PROJECT CHRONO</h1>
      </div>
      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-2 font-mono text-xs bg-black/40 px-3 py-1.5 rounded border border-cyan-500/20">
          <span className={`w-2.5 h-2.5 rounded-full ${connected ? "bg-[#00ff9d] animate-pulse shadow-[0_0_8px_#00ff9d]" : "bg-[#ff0055]"}`} />
          <span className="text-slate-300">{connected ? "SYSTEM ONLINE" : "DISCONNECTED"}</span>
        </div>
        <div className="flex items-center space-x-2 text-cyan-300 font-mono text-xs border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 rounded shadow-[0_0_10px_rgba(0,240,255,0.15)]">
          <Activity className="w-4 h-4 text-cyan-400 animate-spin" />
          <span>MESH ACTIVE</span>
        </div>
      </div>
    </header>
  );
}
