// Client for the country agent (services/backend/routers/agent.py).
import { API_URL } from "@/lib/constants";
import type { IndicatorUnit, SeriesPoint } from "@/lib/countries/types";

export type ChartArtifact =
  | { id: number; type: "chart"; kind: "line"; title: string; unit: IndicatorUnit; series: { label: string; points: SeriesPoint[] }[]; source: string }
  | { id: number; type: "chart"; kind: "bar"; title: string; unit: IndicatorUnit; categories: string[]; series: { label: string; values: (number | null)[] }[]; note?: string; source: string };

export type TableArtifact = {
  id: number;
  type: "table";
  title: string;
  columns: { label: string; unit: IndicatorUnit | null }[];
  rows: (string | number | null)[][];
  source: string;
};

export type ImageArtifact = { id: number; type: "image"; title: string; mime: string; data: string; source: string };

export type Artifact = ChartArtifact | TableArtifact | ImageArtifact;

export type ChatMessage = {
  role: "user" | "model";
  text: string;
  artifactIds?: number[]; // conversation-wide artifact numbers this reply produced
  steps?: string[];
  error?: boolean;
};

export type ChatReply = { reply: string; artifacts: Artifact[]; steps: string[]; model: string | null };

export async function fetchAgentStatus(): Promise<{ configured: boolean; models: string[] } | null> {
  try {
    const res = await fetch(`${API_URL}/api/v1/agent/status`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export async function sendChat(iso: string, history: ChatMessage[], message: string, artifactOffset: number): Promise<ChatReply> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/agent/${iso.toLowerCase()}/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message,
        artifact_offset: artifactOffset,
        history: history.filter((m) => !m.error).map(({ role, text }) => ({ role, text })),
      }),
    });
  } catch {
    throw new Error("Can't reach the Chrono backend. Start it (see README) and try again.");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.detail ?? `The backend returned ${res.status}.`);
  return body as ChatReply;
}
