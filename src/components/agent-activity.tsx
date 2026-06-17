'use client'

import { useApp, AGENT_META, type AgentEvent } from '@/lib/store'
import { CheckCircle2, Circle, Loader2, AlertCircle, ChevronRight } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function AgentActivity({ runId }: { runId: string }) {
  const { runs, lang } = useApp()
  const run = runs[runId]
  if (!run) return null

  const t = (es: string, en: string) => (lang === 'es' ? es : en)

  return (
    <div className="border border-border/60 rounded-lg bg-muted/30 p-3 my-3">
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <Loader2 className={`h-3 w-3 ${run.status === 'running' ? 'animate-spin' : 'hidden'}`} />
        <span className="font-mono">{t('Pipeline multi-agente', 'Multi-agent pipeline')}</span>
        <span className="text-muted-foreground/60">·</span>
        <span>{run.steps.length} {t('pasos', 'steps')}</span>
        {run.plan && (
          <>
            <span className="text-muted-foreground/60">·</span>
            <span className="truncate italic">{run.plan}</span>
          </>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {run.steps.map((step, i) => {
          const meta = AGENT_META[step.agent]
          return (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span style={{ color: meta.color }}>{meta.emoji}</span>
              <span className="font-medium">{meta.name}</span>
              {step.status === 'running' && <Loader2 className="h-3 w-3 animate-spin text-amber-500" />}
              {step.status === 'done' && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
              {step.status === 'error' && <AlertCircle className="h-3 w-3 text-red-500" />}
              {step.status === 'pending' && <Circle className="h-3 w-3 text-muted-foreground" />}
              {i < run.steps.length - 1 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
            </div>
          )
        })}
      </div>
      <StepDetails run={run} />
    </div>
  )
}

function StepDetails({ run }: { run: { steps: any[] } }) {
  const [open, setOpen] = useState(false)
  const { lang } = useApp()
  if (run.steps.length === 0) return null
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
      >
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} />
        {open ? (lang === 'es' ? 'Ocultar detalles' : 'Hide details') : (lang === 'es' ? 'Ver detalles' : 'Show details')}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <ScrollArea className="h-64 mt-2 rounded border border-border/40 bg-background/60 p-2">
              {run.steps.map((step, i) => (
                <div key={i} className="mb-3 text-xs font-mono">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span style={{ color: AGENT_META[step.agent as keyof typeof AGENT_META]?.color }}>
                      {AGENT_META[step.agent as keyof typeof AGENT_META]?.emoji}
                    </span>
                    <span className="font-semibold">{AGENT_META[step.agent as keyof typeof AGENT_META]?.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{step.status}</Badge>
                  </div>
                  {step.events.map((e: AgentEvent, j: number) => (
                    <EventLine key={j} event={e} />
                  ))}
                </div>
              ))}
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function EventLine({ event }: { event: AgentEvent }) {
  const colorMap: Record<string, string> = {
    step_start: 'text-blue-500',
    step_end: 'text-emerald-500',
    tool_call: 'text-purple-500',
    tool_result: 'text-amber-600',
    agent_message: 'text-foreground',
    plan: 'text-amber-500',
    error: 'text-red-500',
  }
  const color = colorMap[event.type] || 'text-muted-foreground'

  if (event.type === 'tool_call') {
    return (
      <div className="pl-3 py-0.5 text-purple-600">
        → {event.toolName}({JSON.stringify(event.toolArgs).slice(0, 120)})
      </div>
    )
  }
  if (event.type === 'tool_result') {
    const resultStr = JSON.stringify(event.toolResult, null, 2)
    return (
      <div className="pl-3 py-0.5 text-amber-700 dark:text-amber-400">
        ← {event.toolName}: <pre className="whitespace-pre-wrap text-[11px] mt-0.5 max-h-32 overflow-y-auto">{resultStr.slice(0, 500)}{resultStr.length > 500 ? '…' : ''}</pre>
      </div>
    )
  }
  if (event.type === 'agent_message' && event.content) {
    return (
      <div className={`pl-3 py-0.5 ${color}`}>
        <pre className="whitespace-pre-wrap text-[11px]">{event.content.slice(0, 600)}{event.content.length > 600 ? '…' : ''}</pre>
      </div>
    )
  }
  if (event.type === 'plan') {
    return <div className={`pl-3 py-0.5 ${color} italic`}>plan: {event.content}</div>
  }
  return <div className={`pl-3 py-0.5 ${color} text-[11px]`}>{event.type} {event.status || ''}</div>
}
