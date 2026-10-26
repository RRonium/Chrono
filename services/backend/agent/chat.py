"""One chat turn with a country's agent: Gemini plus the tools in tools.py, looped until it answers."""

import datetime as dt

from services.backend.agent import gemini
from services.backend.agent.tools import DECLARATIONS, CountryTools

MAX_TOOL_ROUNDS = 8
MAX_HISTORY = 20
MAX_MESSAGE_CHARS = 4000


def system_prompt(iso: str, tools: CountryTools) -> str:
    name = tools.names.get(iso, iso)
    indicator_list = "\n".join(f"- {key}: {d['label']} ({d['unit']})" for key, d in tools.defs.items())
    return f"""You are Chrono's analyst for {name} ({iso}), inside a financial command-center dashboard.
Today is {dt.date.today().isoformat()}. Answer questions about {name}'s economy, markets, policy and news.

Rules:
- Get every number from the tools. Never state a figure you did not receive from a tool; if a tool has no data, say so.
- When an answer involves a trend, a comparison or more than three numbers, call show_chart and/or show_table so the
  user sees it in the charts pane, then refer to it ("see chart 1"). Do not describe the chart's look; interpret it.
- Use draw_custom_chart only when show_chart cannot express the visual (derived series, scatter, annotations).
- Indicators are annual World Bank data; mention the latest year when it matters. Live prices and headlines come
  from Chrono's own feeds and may be missing; say so plainly.
- You may use general knowledge for context (institutions, history, policy), but mark it as background, not data.
- Be concise: short paragraphs or bullets, **bold** for key figures. No tables or code in the text; use the tools.
- Not investment advice. If asked what to buy or sell, explain the data and risks instead.

Indicator ids:
{indicator_list}
"""


def _history_contents(history: list[dict]) -> list[dict]:
    contents = []
    for message in history[-MAX_HISTORY:]:
        role = "model" if message.get("role") == "model" else "user"
        text = str(message.get("text", ""))[:MAX_MESSAGE_CHARS]
        if text:
            contents.append({"role": role, "parts": [{"text": text}]})
    return contents


async def run_turn(iso: str, history: list[dict], message: str, artifact_offset: int = 0) -> dict:
    tools = CountryTools(iso, artifact_offset)
    contents = _history_contents(history) + [{"role": "user", "parts": [{"text": message[:MAX_MESSAGE_CHARS]}]}]
    body = {
        "systemInstruction": {"parts": [{"text": system_prompt(iso, tools)}]},
        "tools": [{"functionDeclarations": DECLARATIONS}],
        "contents": contents,
    }
    model_used = None
    for _ in range(MAX_TOOL_ROUNDS):
        response, model_used = await gemini.generate(body, prefer=model_used)
        candidate = (response.get("candidates") or [{}])[0]
        content = candidate.get("content") or {"role": "model", "parts": []}
        # Send the model's turn back unchanged: its thought signatures must accompany the function results.
        contents.append(content)
        calls = [p["functionCall"] for p in content.get("parts", []) if "functionCall" in p]
        if not calls:
            text = "".join(p.get("text", "") for p in content.get("parts", []) if not p.get("thought")).strip()
            if not text:
                reason = candidate.get("finishReason", "no answer")
                text = f"I couldn't produce an answer ({reason}). Try rephrasing the question."
            return {"reply": text, "artifacts": tools.artifacts, "steps": tools.steps, "model": model_used}
        results = []
        for call in calls:
            result = await tools.call(call["name"], call.get("args") or {})
            response_part = {"name": call["name"], "response": result}
            if call.get("id"):
                response_part["id"] = call["id"]
            results.append({"functionResponse": response_part})
        contents.append({"role": "user", "parts": results})
    return {
        "reply": "I ran out of steps before finishing. Ask a narrower question and I'll try again.",
        "artifacts": tools.artifacts,
        "steps": tools.steps,
        "model": model_used,
    }
