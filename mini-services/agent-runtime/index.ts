/**
 * Forge — Agent Runtime (mini-service on port 3003)
 *
 * Multi-agent orchestrator inspired by NousResearch Hermes Agent.
 * Implements: orchestrator + coder + researcher + doc_analyst + reviewer.
 *
 * Capabilities:
 *   - Streaming LLM responses (z-ai-web-dev-sdk as a stand-in for Ollama)
 *   - Multi-agent delegation with parallel sub-tasks
 *   - Persistent memory (long-term facts about the user)
 *   - Document RAG (search user-uploaded docs by keyword)
 *   - Web search (real-time information retrieval)
 *   - Code execution (sandboxed evaluator — JS only in this demo; Python in real backend)
 *   - Skills library (procedural memory the agent creates and reuses — Hermes-style)
 *   - SOUL.md personality layer (Hermes-style)
 *
 * In production on the user's NVIDIA machine, this exact same orchestration
 * is performed by the Python backend in /python-backend (FastAPI + Ollama + CrewAI).
 * The TypeScript service is the demo-compatible runtime that runs in the preview.
 */

import { createServer } from 'http'
import { Server } from 'socket.io'
import ZAI from 'z-ai-web-dev-sdk'

// ──────────────────────────────────────────────────────────────────────────
//  Types
// ──────────────────────────────────────────────────────────────────────────

type AgentName = 'orchestrator' | 'coder' | 'researcher' | 'doc_analyst' | 'reviewer'

interface AgentEvent {
  type: 'step_start' | 'step_end' | 'token' | 'tool_call' | 'tool_result' | 'agent_message' | 'run_complete' | 'error' | 'plan'
  runId: string
  agent?: AgentName
  content?: string
  toolName?: string
  toolArgs?: any
  toolResult?: any
  status?: 'pending' | 'running' | 'done' | 'error'
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  agentName?: AgentName
}

// ──────────────────────────────────────────────────────────────────────────
//  Agent registry — Hermes-style role definitions
// ──────────────────────────────────────────────────────────────────────────

const AGENTS: Record<AgentName, { name: string; emoji: string; role: string; color: string }> = {
  orchestrator: { name: 'Orchestrator', emoji: '🧭', role: 'Planifica, delega y sintetiza. Decide qué agentes actúan.', color: '#f59e0b' },
  coder: { name: 'Coder', emoji: '💻', role: 'Escribe, ejecuta y depura código. Produce archivos completos.', color: '#10b981' },
  researcher: { name: 'Researcher', emoji: '🔍', role: 'Busca información en la web y sintetiza hallazgos.', color: '#3b82f6' },
  doc_analyst: { name: 'Doc Analyst', emoji: '📚', role: 'Lee los documentos del usuario y extrae respuestas (RAG).', color: '#a855f7' },
  reviewer: { name: 'Reviewer', emoji: '✅', role: 'Revisa código, hallazgos y planes. Sugiere mejoras.', color: '#ec4899' },
}

// ──────────────────────────────────────────────────────────────────────────
//  SOUL.md — Hermes-style personality layer (editable from the UI)
// ──────────────────────────────────────────────────────────────────────────

let SOUL_MD = `# SOUL — Forge Agent Personality

You are Forge, a multi-agent AI development assistant that runs locally on the user's machine.
You operate in Spanish and English, switching to match the user's language.

## Identity
- You are a team of specialized agents coordinated by an Orchestrator.
- You speak directly and concisely. You avoid filler phrases.
- You prefer working code over long explanations.

## Working style
- When the user asks for an app: Orchestrator plans → Coder writes → Reviewer audits → final answer.
- When the user asks a factual question: Researcher searches → Reviewer verifies → answer.
- When the user references uploaded documents: Doc Analyst extracts → answer cites the source.
- Always explain which agent is acting and why.

## Constraints
- Never claim capabilities you do not have.
- If a tool fails, surface the error and propose an alternative.
- Cite web sources with the URL.
- When executing code, show the output verbatim.

## Memory
- Remember the user's preferences across sessions.
- Create a Skill when the user teaches you a reusable workflow.
- Improve existing Skills when you find a better approach.`

// ──────────────────────────────────────────────────────────────────────────
//  In-memory store (the Next.js app persists to Prisma; this is the live cache)
// ──────────────────────────────────────────────────────────────────────────

const memory: { kind: string; content: string; source: string; pinned: boolean; createdAt: Date }[] = []
const skills: { name: string; description: string; trigger: string; steps: string[]; uses: number }[] = []
const documents: { id: string; filename: string; content: string; mimetype: string }[] = []

// ──────────────────────────────────────────────────────────────────────────
//  ZAI client (demo LLM stand-in for Ollama)
// ──────────────────────────────────────────────────────────────────────────

let zai: any = null
async function getZAI() {
  if (!zai) zai = await ZAI.create()
  return zai
}

async function llm(messages: ChatMessage[], opts: { stream?: boolean; temperature?: number } = {}): Promise<string> {
  const client = await getZAI()
  try {
    const res = await client.chat.completions.create({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: opts.temperature ?? 0.7,
      thinking: { type: 'disabled' },
    })
    return res.choices[0]?.message?.content ?? ''
  } catch (e: any) {
    return `[LLM error: ${e.message}]`
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Tools — implemented locally so the demo works without external services
// ──────────────────────────────────────────────────────────────────────────

async function tool_web_search(query: string): Promise<any> {
  try {
    const client = await getZAI()
    const results = await client.functions.invoke('web_search', { query, num: 5 })
    return results.map((r: any) => ({
      title: r.name,
      url: r.url,
      snippet: r.snippet,
      host: r.host_name,
      date: r.date,
    }))
  } catch (e: any) {
    return { error: e.message }
  }
}

async function tool_doc_search(query: string): Promise<any> {
  if (documents.length === 0) return { error: 'No documents uploaded yet.' }
  const q = query.toLowerCase()
  const matches = documents
    .map(d => {
      const idx = d.content.toLowerCase().indexOf(q)
      if (idx === -1) return null
      const start = Math.max(0, idx - 200)
      const end = Math.min(d.content.length, idx + 400)
      return {
        document: d.filename,
        documentId: d.id,
        excerpt: d.content.slice(start, end),
        position: idx,
      }
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.position - b.position)
    .slice(0, 3)
  return matches.length ? matches : { error: 'No matching passages found.' }
}

async function tool_execute_code(language: string, code: string): Promise<any> {
  // Safe subset: JavaScript expression evaluator
  // (The Python backend in /python-backend provides a real Python sandbox.)
  if (language.toLowerCase() !== 'javascript' && language.toLowerCase() !== 'js') {
    return {
      supported: false,
      message: `In the preview runtime only JavaScript is supported. The Python backend (/python-backend) supports Python, shell and more.`,
      note: 'To execute Python code locally, run the Python backend with Ollama on your GPU machine.',
    }
  }
  try {
    const blocked = /require|import|process|child_process|fs|net|http|https|fetch|eval|Function\(/i
    if (blocked.test(code)) {
      return { error: 'Blocked keyword detected. The sandbox forbids network/fs/process access.' }
    }
    // Capture console.log output
    const logs: string[] = []
    const sandboxConsole = { log: (...a: any[]) => logs.push(a.map(String).join(' ')) }
    const fn = new Function('console', `"use strict";\n${code}`)
    const result = fn(sandboxConsole)
    return {
      supported: true,
      language: 'javascript',
      stdout: logs.join('\n'),
      result: result === undefined ? undefined : String(result),
    }
  } catch (e: any) {
    return { supported: true, language: 'javascript', error: e.message }
  }
}

async function tool_memory_remember(content: string, kind: string = 'fact'): Promise<any> {
  memory.push({ kind, content, source: 'agent', pinned: false, createdAt: new Date() })
  return { stored: true, total: memory.length }
}

async function tool_memory_recall(query: string): Promise<any> {
  const q = query.toLowerCase()
  const matches = memory
    .filter(m => m.content.toLowerCase().includes(q) || m.kind.toLowerCase().includes(q))
    .slice(0, 5)
  return matches.length ? matches : { note: 'No matching memories.' }
}

async function tool_skill_create(name: string, description: string, trigger: string, steps: string[]): Promise<any> {
  const existing = skills.findIndex(s => s.name === name)
  if (existing >= 0) {
    skills[existing] = { name, description, trigger, steps, uses: skills[existing].uses }
    return { updated: true, name }
  }
  skills.push({ name, description, trigger, steps, uses: 0 })
  return { created: true, name, total: skills.length }
}

async function tool_skill_lookup(query: string): Promise<any> {
  const q = query.toLowerCase()
  const matches = skills
    .filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.trigger.toLowerCase().includes(q))
    .slice(0, 3)
  return matches.length ? matches : { note: 'No matching skills.' }
}

// ──────────────────────────────────────────────────────────────────────────
//  Tool dispatch
// ──────────────────────────────────────────────────────────────────────────

async function dispatchTool(name: string, args: any): Promise<any> {
  switch (name) {
    case 'web_search': return await tool_web_search(args.query)
    case 'doc_search': return await tool_doc_search(args.query)
    case 'execute_code': return await tool_execute_code(args.language || 'javascript', args.code)
    case 'memory_remember': return await tool_memory_remember(args.content, args.kind)
    case 'memory_recall': return await tool_memory_recall(args.query)
    case 'skill_create': return await tool_skill_create(args.name, args.description, args.trigger, args.steps)
    case 'skill_lookup': return await tool_skill_lookup(args.query)
    default: return { error: `Unknown tool: ${name}` }
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Orchestrator: decides the plan
// ──────────────────────────────────────────────────────────────────────────

async function planTask(userMessage: string): Promise<{ plan: string; agents: AgentName[] }> {
  const planPrompt: ChatMessage[] = [
    {
      role: 'system',
      content: `${SOUL_MD}

You are the Orchestrator agent. Given the user request, decide:
1. A one-sentence plan
2. Which agents should act, in order

Agents available:
- coder (writes code, executes it)
- researcher (web search)
- doc_analyst (search uploaded documents)
- reviewer (verify code, facts)

Always include yourself implicitly as orchestrator. Respond in strict JSON:
{"plan":"<one sentence>","agents":["coder","researcher",...]}`
    },
    { role: 'user', content: userMessage },
  ]
  const raw = await llm(planPrompt, { temperature: 0.2 })
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) return JSON.parse(match[0])
  } catch {}
  // Fallback heuristic plan
  const agents: AgentName[] = []
  if (/code|funci[oó]n|script|programa|app|aplicaci[oó]n|build|implement|c[oó]digo/i.test(userMessage)) agents.push('coder')
  if (/search|busca|investiga|latest|últim|reciente|web|internet/i.test(userMessage)) agents.push('researcher')
  if (/document|pdf|archivo|doc/i.test(userMessage)) agents.push('doc_analyst')
  if (agents.length === 0) agents.push('coder')
  agents.push('reviewer')
  return { plan: 'Plan heurístico generado por el Orchestrator.', agents }
}

// ──────────────────────────────────────────────────────────────────────────
//  Agent runners
// ──────────────────────────────────────────────────────────────────────────

function agentSystemPrompt(agent: AgentName, userMessage: string): string {
  const base = `${SOUL_MD}

You are the ${AGENTS[agent].name} agent. Role: ${AGENTS[agent].role}
Respond concisely. Use tools when needed by writing JSON tool calls.

Available tools (emit as a JSON block, one per turn):
{"tool":"web_search","args":{"query":"..."}}
{"tool":"doc_search","args":{"query":"..."}}
{"tool":"execute_code","args":{"language":"javascript","code":"..."}}
{"tool":"memory_remember","args":{"content":"...","kind":"fact"}}
{"tool":"memory_recall","args":{"query":"..."}}
{"tool":"skill_create","args":{"name":"...","description":"...","trigger":"...","steps":["..."]}}
{"tool":"skill_lookup","args":{"query":"..."}}

If no tool is needed, respond directly with your contribution.
The user request is: "${userMessage}"
`
  return base
}

async function runAgent(
  io: Server,
  socketId: string,
  agent: AgentName,
  userMessage: string,
  context: { previousToolResults: any[]; plan: string }
): Promise<string> {
  const evt = (e: Partial<AgentEvent>) => io.to(socketId).emit('agent_event', { agent, ...e })

  evt({ type: 'step_start', status: 'running' })

  const messages: ChatMessage[] = [
    { role: 'system', content: agentSystemPrompt(agent, userMessage) },
    {
      role: 'user',
      content: `Plan: ${context.plan}
${context.previousToolResults.length ? `Previous tool results from other agents:\n${JSON.stringify(context.previousToolResults, null, 2)}` : ''}
Produce your contribution now.`,
    },
  ]

  const raw = await llm(messages, { temperature: 0.6 })
  evt({ type: 'agent_message', content: raw })

  // Detect tool calls
  const toolCallPattern = /\{"tool":"([^"]+)","args":(\{[\s\S]*?\})\}/g
  let match: RegExpExecArray | null
  let toolOutput: any = null
  while ((match = toolCallPattern.exec(raw)) !== null) {
    const toolName = match[1]
    let args: any
    try { args = JSON.parse(match[2]) } catch { args = {} }
    evt({ type: 'tool_call', toolName, toolArgs: args })
    const result = await dispatchTool(toolName, args)
    evt({ type: 'tool_result', toolName, toolResult: result, status: 'done' })
    toolOutput = result
    context.previousToolResults.push({ agent, tool: toolName, args, result })

    // Follow-up: if a tool was called, get the agent to interpret the result
    if (toolOutput) {
      const followup: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: raw },
        {
          role: 'user',
          content: `Tool ${toolName} returned:
${JSON.stringify(result, null, 2)}

Interpret this and produce your final contribution. Do not call another tool unless strictly necessary.`,
        },
      ]
      const final = await llm(followup, { temperature: 0.5 })
      evt({ type: 'agent_message', content: final })
      evt({ type: 'step_end', status: 'done' })
      return final
    }
  }

  evt({ type: 'step_end', status: 'done' })
  return raw
}

// ──────────────────────────────────────────────────────────────────────────
//  Full orchestration run
// ──────────────────────────────────────────────────────────────────────────

async function runOrchestration(
  io: Server,
  socketId: string,
  runId: string,
  userMessage: string,
): Promise<void> {
  const evt = (e: Partial<AgentEvent>) => io.to(socketId).emit('agent_event', { runId, ...e })

  try {
    // 1. Orchestrator plans
    evt({ type: 'step_start', agent: 'orchestrator', status: 'running' })
    const { plan, agents } = await planTask(userMessage)
    evt({ type: 'plan', agent: 'orchestrator', content: plan, toolResult: { agents } })
    evt({ type: 'step_end', agent: 'orchestrator', status: 'done' })

    // 2. Run each agent in sequence (Hermes-style delegated chain)
    const context = { previousToolResults: [] as any[], plan }
    const contributions: { agent: AgentName; text: string }[] = []
    for (const a of agents) {
      const text = await runAgent(io, socketId, a, userMessage, context)
      contributions.push({ agent: a, text })
    }

    // 3. Orchestrator synthesizes final answer
    evt({ type: 'step_start', agent: 'orchestrator', status: 'running' })
    const synthesis: ChatMessage[] = [
      {
        role: 'system',
        content: `${SOUL_MD}

You are the Orchestrator. Synthesize the contributions of the specialist agents into a single coherent final answer to the user.
- Speak in the user's language (Spanish or English).
- Use Markdown. Include code blocks with language tags.
- If agents ran tools, cite the relevant tool outputs.
- Be concise but complete.`,
      },
      {
        role: 'user',
        content: `User request: ${userMessage}

Plan: ${plan}

Agent contributions:
${contributions.map(c => `## ${AGENTS[c.agent].name}\n${c.text}`).join('\n\n')}

Synthesize the final answer.`,
      },
    ]
    const final = await llm(synthesis, { temperature: 0.5 })
    evt({ type: 'agent_message', agent: 'orchestrator', content: final })
    evt({ type: 'step_end', agent: 'orchestrator', status: 'done' })
    evt({ type: 'run_complete', status: 'done', content: final })
  } catch (e: any) {
    evt({ type: 'error', content: e.message })
  }
}

// ──────────────────────────────────────────────────────────────────────────
//  Socket.IO server
// ──────────────────────────────────────────────────────────────────────────

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 120000,
  pingInterval: 25000,
})

io.on('connection', (socket) => {
  console.log(`[agent-runtime] connected: ${socket.id}`)

  socket.on('run', async (data: { message: string; runId: string }) => {
    console.log(`[agent-runtime] run ${data.runId}: ${data.message.slice(0, 80)}`)
    socket.join(`run-${data.runId}`)
    await runOrchestration(io, socket.id, data.runId, data.message)
  })

  // ── Document management ──────────────────────────────────────────────
  socket.on('document:add', (data: { id: string; filename: string; content: string; mimetype: string }) => {
    documents.push(data)
    io.emit('document:added', { id: data.id, filename: data.filename, size: data.content.length })
    console.log(`[agent-runtime] document added: ${data.filename} (${data.content.length} chars)`)
  })

  socket.on('document:list', () => {
    socket.emit('document:list', documents.map(d => ({ id: d.id, filename: d.filename, size: d.content.length, mimetype: d.mimetype })))
  })

  // ── Memory management ────────────────────────────────────────────────
  socket.on('memory:list', () => {
    socket.emit('memory:list', memory)
  })

  socket.on('memory:add', (data: { content: string; kind?: string; pinned?: boolean }) => {
    memory.push({
      kind: data.kind || 'fact',
      content: data.content,
      source: 'user',
      pinned: data.pinned ?? false,
      createdAt: new Date(),
    })
    io.emit('memory:added', { total: memory.length })
  })

  socket.on('memory:clear', () => {
    memory.length = 0
    io.emit('memory:cleared')
  })

  // ── Skills management ────────────────────────────────────────────────
  socket.on('skills:list', () => {
    socket.emit('skills:list', skills)
  })

  // ── SOUL.md management ───────────────────────────────────────────────
  socket.on('soul:get', () => {
    socket.emit('soul', SOUL_MD)
  })

  socket.on('soul:update', (data: { content: string }) => {
    SOUL_MD = data.content
    io.emit('soul', SOUL_MD)
    console.log('[agent-runtime] SOUL.md updated')
  })

  // ── Agents metadata ──────────────────────────────────────────────────
  socket.on('agents:info', () => {
    socket.emit('agents:info', AGENTS)
  })

  // ── Tool: direct web search (for UI tools panel) ─────────────────────
  socket.on('tool:web_search', async (data: { query: string }) => {
    const results = await tool_web_search(data.query)
    socket.emit('tool:web_search:result', { query: data.query, results })
  })

  socket.on('disconnect', () => {
    console.log(`[agent-runtime] disconnected: ${socket.id}`)
  })
})

const PORT = 3003
httpServer.listen(PORT, () => {
  console.log(`[agent-runtime] WebSocket server running on port ${PORT}`)
})

process.on('SIGTERM', () => httpServer.close(() => process.exit(0)))
process.on('SIGINT', () => httpServer.close(() => process.exit(0)))
