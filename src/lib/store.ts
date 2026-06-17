'use client'

import { create } from 'zustand'
import { io, Socket } from 'socket.io-client'

export type AgentName = 'orchestrator' | 'coder' | 'researcher' | 'doc_analyst' | 'reviewer'

export interface AgentEvent {
  type: 'step_start' | 'step_end' | 'token' | 'tool_call' | 'tool_result' | 'agent_message' | 'run_complete' | 'error' | 'plan'
  runId: string
  agent?: AgentName
  content?: string
  toolName?: string
  toolArgs?: any
  toolResult?: any
  status?: 'pending' | 'running' | 'done' | 'error'
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  agentName?: AgentName
  timestamp: Date
  runId?: string
  events?: AgentEvent[]
}

export interface AgentStep {
  agent: AgentName
  status: 'pending' | 'running' | 'done' | 'error'
  startedAt: Date
  endedAt?: Date
  events: AgentEvent[]
}

export interface MemoryItem {
  kind: string
  content: string
  source: string
  pinned: boolean
  createdAt: Date
}

export interface SkillItem {
  name: string
  description: string
  trigger: string
  steps: string[]
  uses: number
}

export interface DocumentItem {
  id: string
  filename: string
  content: string
  mimetype: string
  size: number
}

type Lang = 'es' | 'en'

interface AppState {
  // connection
  socket: Socket | null
  connected: boolean
  connect: () => void

  // ui
  lang: Lang
  setLang: (l: Lang) => void
  activePanel: 'chat' | 'agents' | 'memory' | 'skills' | 'docs' | 'soul' | 'settings'
  setActivePanel: (p: AppState['activePanel']) => void

  // chat
  messages: ChatMessage[]
  runs: Record<string, { steps: AgentStep[]; status: string; plan?: string }>
  isRunning: boolean
  sendMessage: (text: string) => void

  // memory
  memory: MemoryItem[]
  loadMemory: () => void
  addMemory: (content: string, kind?: string, pinned?: boolean) => void
  clearMemory: () => void

  // skills
  skills: SkillItem[]
  loadSkills: () => void

  // documents
  documents: DocumentItem[]
  loadDocuments: () => void
  addDocument: (doc: DocumentItem) => void

  // soul
  soulMd: string
  loadSoul: () => void
  updateSoul: (content: string) => void
}

let socketSingleton: Socket | null = null

function getSocket(): Socket {
  if (socketSingleton) return socketSingleton
  // IMPORTANT: use the URL form '/?XTransformPort=3003' so Caddy forwards
  // to the mini-service on port 3003. Do NOT set path or absolute URL.
  socketSingleton = io('/?XTransformPort=3003', {
    transports: ['polling', 'websocket'],
    forceNew: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
    timeout: 20000,
  })
  return socketSingleton
}

export const useApp = create<AppState>((set, get) => ({
  socket: null,
  connected: false,
  connect: () => {
    if (get().socket) return
    try {
      const socket = getSocket()
      socket.on('connect', () => set({ connected: true }))
      socket.on('disconnect', () => set({ connected: false }))

    socket.on('agent_event', (e: AgentEvent) => {
      const { runs, messages } = get()
      // update runs map
      const run = runs[e.runId] || { steps: [], status: 'running' }
      let steps = [...run.steps]
      if (e.agent) {
        let stepIdx = steps.findIndex(s => s.agent === e.agent && s.status === 'running')
        if (e.type === 'step_start') {
          if (stepIdx === -1) {
            steps.push({ agent: e.agent, status: 'running', startedAt: new Date(), events: [] })
            stepIdx = steps.length - 1
          }
        }
        if (stepIdx >= 0) {
          const step = { ...steps[stepIdx], events: [...steps[stepIdx].events, e] }
          if (e.type === 'step_end') {
            step.status = e.status === 'error' ? 'error' : 'done'
            step.endedAt = new Date()
          }
          steps = steps.map((s, i) => (i === stepIdx ? step : s))
        }
      }
      if (e.type === 'plan') {
        run.plan = e.content
      }
      if (e.type === 'run_complete') {
        run.status = 'done'
        // Append final assistant message
        const finalMsg: ChatMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: e.content || '',
          agentName: 'orchestrator',
          timestamp: new Date(),
          runId: e.runId,
        }
        set({
          runs: { ...runs, [e.runId]: { ...run, steps } },
          messages: [...messages, finalMsg],
          isRunning: false,
        })
        return
      }
      if (e.type === 'error') {
        run.status = 'failed'
        set({
          runs: { ...runs, [e.runId]: { ...run, steps } },
          isRunning: false,
        })
        return
      }
      set({ runs: { ...runs, [e.runId]: { ...run, steps } } })
    })

    socket.on('memory:list', (items: MemoryItem[]) => set({ memory: items }))
    socket.on('memory:added', () => get().loadMemory())
    socket.on('memory:cleared', () => set({ memory: [] }))

    socket.on('skills:list', (items: SkillItem[]) => set({ skills: items }))

    socket.on('document:added', () => get().loadDocuments())
    socket.on('document:list', (items: any[]) =>
      set({
        documents: items.map(i => ({ ...i, content: '' })),
      }),
    )

      socket.on('soul', (content: string) => set({ soulMd: content }))

      set({ socket })

      // initial loads
      socket.emit('memory:list')
      socket.emit('skills:list')
      socket.emit('document:list')
      socket.emit('soul:get')
    } catch (e: any) {
      console.error('[Forge] socket init failed:', e.message)
    }
  },

  lang: 'es',
  setLang: (lang) => set({ lang }),
  activePanel: 'chat',
  setActivePanel: (activePanel) => set({ activePanel }),

  messages: [],
  runs: {},
  isRunning: false,
  sendMessage: (text) => {
    const socket = get().socket
    if (!socket) return
    const runId = `run-${Date.now()}`
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
      runId,
    }
    set((s) => ({
      messages: [...s.messages, userMsg],
      runs: { ...s.runs, [runId]: { steps: [], status: 'running' } },
      isRunning: true,
    }))
    socket.emit('run', { message: text, runId })
  },

  memory: [],
  loadMemory: () => get().socket?.emit('memory:list'),
  addMemory: (content, kind = 'fact', pinned = false) => {
    get().socket?.emit('memory:add', { content, kind, pinned })
  },
  clearMemory: () => get().socket?.emit('memory:clear'),

  skills: [],
  loadSkills: () => get().socket?.emit('skills:list'),

  documents: [],
  loadDocuments: () => get().socket?.emit('document:list'),
  addDocument: (doc) => {
    get().socket?.emit('document:add', doc)
    set((s) => ({ documents: [...s.documents, doc] }))
  },

  soulMd: '',
  loadSoul: () => get().socket?.emit('soul:get'),
  updateSoul: (content) => get().socket?.emit('soul:update', { content }),
}))

export const AGENT_META: Record<AgentName, { name: string; emoji: string; color: string; description_es: string; description_en: string }> = {
  orchestrator: { name: 'Orchestrator', emoji: '🧭', color: '#f59e0b', description_es: 'Planifica, delega y sintetiza', description_en: 'Plans, delegates and synthesizes' },
  coder: { name: 'Coder', emoji: '💻', color: '#10b981', description_es: 'Escribe y ejecuta código', description_en: 'Writes and runs code' },
  researcher: { name: 'Researcher', emoji: '🔍', color: '#3b82f6', description_es: 'Busca información en la web', description_en: 'Searches the web' },
  doc_analyst: { name: 'Doc Analyst', emoji: '📚', color: '#a855f7', description_es: 'Analiza tus documentos', description_en: 'Analyzes your documents' },
  reviewer: { name: 'Reviewer', emoji: '✅', color: '#ec4899', description_es: 'Revisa y sugiere mejoras', description_en: 'Reviews and suggests' },
}
