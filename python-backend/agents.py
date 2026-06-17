"""
Forge — Agents.

CrewAI-based multi-agent system. Mirrors the orchestrator/coder/researcher/
doc_analyst/reviewer topology used by the TypeScript runtime, but uses
real CrewAI agents backed by Ollama.
"""
from __future__ import annotations

from typing import Dict, List
from crewai import Agent, Task, Crew, Process
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


def _build_agents() -> Dict[str, Agent]:
    """Create the five specialized agents."""
    return {
        "orchestrator": Agent(
            role="Orchestrator",
            goal="Plan the workflow, delegate to specialist agents, synthesize the final answer.",
            backstory=SOUL_PROMPT + "\nYou coordinate the team and ensure quality.",
            allow_delegation=True,
            verbose=True,
        ),
        "coder": Agent(
            role="Coder",
            goal="Write, execute and debug code. Produce complete, runnable files.",
            backstory=SOUL_PROMPT + "\nYou are an expert programmer who writes clean, working code.",
            allow_delegation=False,
            tools=[execute_code],
            verbose=True,
        ),
        "researcher": Agent(
            role="Researcher",
            goal="Search the web for accurate, up-to-date information and synthesize findings.",
            backstory=SOUL_PROMPT + "\nYou are a meticulous researcher.",
            allow_delegation=False,
            tools=[web_search],
            verbose=True,
        ),
        "doc_analyst": Agent(
            role="Document Analyst",
            goal="Read the user's uploaded documents and extract relevant answers.",
            backstory=SOUL_PROMPT + "\nYou excel at finding information in user-provided documents.",
            allow_delegation=False,
            tools=[doc_search],
            verbose=True,
        ),
        "reviewer": Agent(
            role="Reviewer",
            goal="Verify code correctness, fact-check research, and suggest improvements.",
            backstory=SOUL_PROMPT + "\nYou are a senior reviewer with attention to detail.",
            allow_delegation=False,
            tools=[memory_recall, memory_remember, skill_lookup, skill_create],
            verbose=True,
        ),
    }


def plan_task(user_message: str) -> Dict:
    """Ask the orchestrator to plan which agents should act."""
    messages = [
        {"role": "system", "content": SOUL_PROMPT + "\n\nDecide which agents should act on this user request. Respond as JSON: {\"plan\": \"...\", \"agents\": [\"coder\", \"researcher\", ...]}"},
        {"role": "user", "content": user_message},
    ]
    raw = chat(messages, temperature=0.2)
    import json, re
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    # Fallback heuristic
    agents = []
    if any(k in user_message.lower() for k in ["code", "función", "script", "programa", "app", "aplicación", "build", "implement", "código"]):
        agents.append("coder")
    if any(k in user_message.lower() for k in ["search", "busca", "investiga", "latest", "últim", "reciente", "web", "internet"]):
        agents.append("researcher")
    if any(k in user_message.lower() for k in ["document", "pdf", "archivo", "doc"]):
        agents.append("doc_analyst")
    if not agents:
        agents.append("coder")
    agents.append("reviewer")
    return {"plan": "Plan heurístico.", "agents": agents}


def run_orchestration(user_message: str, on_event=None) -> str:
    """
    Execute the full multi-agent pipeline.

    on_event: optional callback(event: dict) for streaming events to WebSocket.
    Returns the final synthesized answer.
    """
    import time

    def emit(event: dict):
        if on_event:
            on_event(event)

    # 1. Plan
    emit({"type": "step_start", "agent": "orchestrator", "status": "running"})
    plan_data = plan_task(user_message)
    emit({"type": "plan", "agent": "orchestrator", "content": plan_data.get("plan", ""), "toolResult": plan_data})
    emit({"type": "step_end", "agent": "orchestrator", "status": "done"})

    agents_to_run = plan_data.get("agents", ["coder", "reviewer"])
    # 2. Run each agent sequentially, Hermes-style
    contributions: List[str] = []
    tool_results: List[dict] = []
    for a in agents_to_run:
        emit({"type": "step_start", "agent": a, "status": "running"})
        # Per-agent prompt — let agent decide whether to call a tool
        agent_prompt = f"""
Plan: {plan_data.get("plan")}

Previous tool results from other agents:
{tool_results if tool_results else "none"}

User request: {user_message}

Respond with your contribution. If you need a tool, output a JSON block: {{"tool":"<name>","args":{{...}}}}
"""
        msg = [
            {"role": "system", "content": SOUL_PROMPT + f"\nYou are the {a} agent."},
            {"role": "user", "content": agent_prompt},
        ]
        text = chat(msg, temperature=0.6)
        emit({"type": "agent_message", "agent": a, "content": text})

        # Detect tool calls (basic)
        import re, json
        m = re.search(r'\{"tool":"([^"]+)","args":(\{[\s\S]*?\})\}', text)
        if m:
            tool_name, args_json = m.group(1), m.group(2)
            try:
                args = json.loads(args_json)
            except Exception:
                args = {}
            emit({"type": "tool_call", "agent": a, "toolName": tool_name, "toolArgs": args})
            import tools as T
            result = getattr(T, tool_name, lambda **k: {"error": "unknown tool"})(**args)
            emit({"type": "tool_result", "agent": a, "toolName": tool_name, "toolResult": result, "status": "done"})
            tool_results.append({"agent": a, "tool": tool_name, "args": args, "result": result})

            # Follow-up
            follow_msg = msg + [
                {"role": "assistant", "content": text},
                {"role": "user", "content": f"Tool {tool_name} returned:\n{json.dumps(result, indent=2)}\n\nProduce your final contribution."},
            ]
            text = chat(follow_msg, temperature=0.5)
            emit({"type": "agent_message", "agent": a, "content": text})
        contributions.append(text)
        emit({"type": "step_end", "agent": a, "status": "done"})

    # 3. Synthesize final answer
    emit({"type": "step_start", "agent": "orchestrator", "status": "running"})
    synthesis_msg = [
        {"role": "system", "content": SOUL_PROMPT + "\n\nYou are the Orchestrator. Synthesize the agent contributions into a single coherent final answer in Markdown."},
        {"role": "user", "content": f"User request: {user_message}\n\nPlan: {plan_data.get('plan')}\n\nContributions:\n" + "\n\n".join(contributions)},
    ]
    final = chat(synthesis_msg, temperature=0.5)
    emit({"type": "agent_message", "agent": "orchestrator", "content": final})
    emit({"type": "step_end", "agent": "orchestrator", "status": "done"})
    emit({"type": "run_complete", "status": "done", "content": final})
    return final
