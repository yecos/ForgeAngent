"""
Forge — Multi-agent orchestration.

Implements the orchestrator/coder/researcher/doc_analyst/reviewer topology
with plain Ollama chat calls — no CrewAI dependency needed.

Each agent gets:
  - A system prompt built from SOUL.md + role
  - The user message + plan + previous tool results
  - An optional tool call (parsed from JSON in the response)
  - A follow-up turn to interpret the tool result

The orchestrator:
  1. Plans which agents should act (LLM call with low temperature)
  2. Runs each agent sequentially (Hermes-style delegation)
  3. Synthesizes a final answer from all contributions
"""
from __future__ import annotations

import json
import re
from typing import Callable, Dict, List, Optional

from llm import chat
from tools import (
    web_search,
    doc_search,
    execute_code,
    memory_remember,
    memory_recall,
    skill_create,
    skill_lookup,
)

SOUL_PROMPT = """
You are Forge, a multi-agent AI development assistant that runs locally.
Operate in Spanish or English matching the user's language.
Be concise, prefer working code over long explanations.
"""

# Tool dispatcher — agent emits JSON {"tool":"<name>","args":{...}} and
# the orchestrator runs it here. Same tool names as the TS runtime.
_TOOLS = {
    "web_search": web_search,
    "doc_search": doc_search,
    "execute_code": execute_code,
    "memory_remember": memory_remember,
    "memory_recall": memory_recall,
    "skill_create": skill_create,
    "skill_lookup": skill_lookup,
}


def plan_task(user_message: str) -> Dict:
    """Ask the orchestrator to plan which agents should act."""
    messages = [
        {
            "role": "system",
            "content": SOUL_PROMPT
            + "\n\nDecide which agents should act on this user request. "
            + "Respond as JSON: {\"plan\": \"...\", \"agents\": [\"coder\", \"researcher\", ...]}",
        },
        {"role": "user", "content": user_message},
    ]
    raw = chat(messages, temperature=0.2)
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    # Fallback heuristic plan
    agents: List[str] = []
    if any(
        k in user_message.lower()
        for k in ["code", "función", "script", "programa", "app", "aplicación", "build", "implement", "código"]
    ):
        agents.append("coder")
    if any(
        k in user_message.lower()
        for k in ["search", "busca", "investiga", "latest", "últim", "reciente", "web", "internet"]
    ):
        agents.append("researcher")
    if any(k in user_message.lower() for k in ["document", "pdf", "archivo", "doc"]):
        agents.append("doc_analyst")
    if not agents:
        agents.append("coder")
    agents.append("reviewer")
    return {"plan": "Plan heurístico.", "agents": agents}


def _agent_system_prompt(agent: str) -> str:
    roles = {
        "orchestrator": "Planifica, delega y sintetiza. Decide qué agentes actúan.",
        "coder": "Escribe, ejecuta y depura código. Produce archivos completos.",
        "researcher": "Busca información en la web y sintetiza hallazgos.",
        "doc_analyst": "Lee los documentos del usuario y extrae respuestas (RAG).",
        "reviewer": "Revisa código, hallazgos y planes. Sugiere mejoras.",
    }
    return (
        SOUL_PROMPT
        + f"\nYou are the {agent} agent. Role: {roles.get(agent, 'specialist')}\n"
        + "Respond concisely. Use tools when needed by writing JSON tool calls.\n\n"
        + 'Available tools (emit as a JSON block): {"tool":"<name>","args":{...}}\n'
        + "Tools: " + ", ".join(_TOOLS.keys()) + "\n"
        + "If no tool is needed, respond directly with your contribution."
    )


def _extract_tool_call(text: str) -> Optional[tuple[str, Dict]]:
    """Find the first {"tool":"...","args":{...}} block in text."""
    m = re.search(r'\{"tool":"([^"]+)","args":(\{[\s\S]*?\})\}', text)
    if not m:
        return None
    tool_name = m.group(1)
    try:
        args = json.loads(m.group(2))
    except Exception:
        args = {}
    return tool_name, args


def run_orchestration(user_message: str, on_event: Optional[Callable[[Dict], None]] = None) -> str:
    """
    Execute the full multi-agent pipeline.

    on_event: optional callback(event: dict) for streaming events to WebSocket.
    Returns the final synthesized answer.
    """
    if on_event is None:
        on_event = lambda _event: None  # noqa: E731

    # 1. Plan
    on_event({"type": "step_start", "agent": "orchestrator", "status": "running"})
    plan_data = plan_task(user_message)
    on_event(
        {
            "type": "plan",
            "agent": "orchestrator",
            "content": plan_data.get("plan", ""),
            "toolResult": plan_data,
        }
    )
    on_event({"type": "step_end", "agent": "orchestrator", "status": "done"})

    agents_to_run = plan_data.get("agents", ["coder", "reviewer"])
    if not agents_to_run:
        agents_to_run = ["coder", "reviewer"]

    # 2. Run each agent sequentially, Hermes-style
    contributions: List[str] = []
    tool_results: List[Dict] = []
    for a in agents_to_run:
        on_event({"type": "step_start", "agent": a, "status": "running"})
        agent_prompt = (
            f"Plan: {plan_data.get('plan')}\n\n"
            + "Previous tool results from other agents:\n"
            + (json.dumps(tool_results, indent=2) if tool_results else "none")
            + f"\n\nUser request: {user_message}\n\n"
            + "Respond with your contribution. If you need a tool, "
            + 'output a JSON block: {"tool":"<name>","args":{...}}'
        )
        msg = [
            {"role": "system", "content": _agent_system_prompt(a)},
            {"role": "user", "content": agent_prompt},
        ]
        text = chat(msg, temperature=0.6)
        on_event({"type": "agent_message", "agent": a, "content": text})

        # Detect tool calls
        tool_call = _extract_tool_call(text)
        if tool_call:
            tool_name, args = tool_call
            on_event(
                {
                    "type": "tool_call",
                    "agent": a,
                    "toolName": tool_name,
                    "toolArgs": args,
                }
            )
            tool_fn = _TOOLS.get(tool_name)
            if tool_fn is None:
                result = {"error": f"Unknown tool: {tool_name}"}
            else:
                try:
                    result = tool_fn(**args)
                except Exception as e:
                    result = {"error": f"{type(e).__name__}: {e}"}
            on_event(
                {
                    "type": "tool_result",
                    "agent": a,
                    "toolName": tool_name,
                    "toolResult": result,
                    "status": "done",
                }
            )
            tool_results.append({"agent": a, "tool": tool_name, "args": args, "result": result})

            # Follow-up: ask the agent to interpret the tool result
            follow_msg = msg + [
                {"role": "assistant", "content": text},
                {
                    "role": "user",
                    "content": (
                        f"Tool {tool_name} returned:\n"
                        + json.dumps(result, indent=2, default=str)
                        + "\n\nProduce your final contribution. Do not call another tool unless strictly necessary."
                    ),
                },
            ]
            text = chat(follow_msg, temperature=0.5)
            on_event({"type": "agent_message", "agent": a, "content": text})

        contributions.append(text)
        on_event({"type": "step_end", "agent": a, "status": "done"})

    # 3. Synthesize final answer
    on_event({"type": "step_start", "agent": "orchestrator", "status": "running"})
    synthesis_msg = [
        {
            "role": "system",
            "content": SOUL_PROMPT
            + "\n\nYou are the Orchestrator. Synthesize the agent contributions "
            + "into a single coherent final answer in Markdown. "
            + "Use code blocks with language tags when showing code.",
        },
        {
            "role": "user",
            "content": (
                f"User request: {user_message}\n\n"
                + f"Plan: {plan_data.get('plan')}\n\n"
                + "Agent contributions:\n"
                + "\n\n".join(f"## {c[0]}\n{c[1]}" for c in zip(agents_to_run, contributions))
            ),
        },
    ]
    final = chat(synthesis_msg, temperature=0.5)
    on_event({"type": "agent_message", "agent": "orchestrator", "content": final})
    on_event({"type": "step_end", "agent": "orchestrator", "status": "done"})
    on_event({"type": "run_complete", "status": "done", "content": final})
    return final
