'use client'

import { useApp, AGENT_META, type ChatMessage } from '@/lib/store'
import { AgentActivity } from './agent-activity'
import { useEffect, useRef } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { User, Sparkles, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

export function ChatView() {
  const { messages, isRunning, connected } = useApp()
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isRunning])

  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p>Conectando con el runtime de agentes…</p>
          <p className="text-xs mt-1">Connecting to agent runtime…</p>
        </div>
      </div>
    )
  }

  if (messages.length === 0) {
    return <EmptyState />
  }

  return (
    <ScrollArea className="flex-1">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {isRunning && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
            <Sparkles className="h-4 w-4" />
            <span>Agentes trabajando…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </ScrollArea>
  )
}

function EmptyState() {
  const { sendMessage, lang } = useApp()
  const examples =
    lang === 'es'
      ? [
          'Crea una API REST en Python con FastAPI para gestionar tareas',
          'Busca las últimas novedades de Next.js 16 y resúmelas',
          'Escribe una función JavaScript que valide emails y pruébala',
          'Analiza los documentos que subí y dame un resumen',
        ]
      : [
          'Build a REST API in Python with FastAPI to manage tasks',
          'Search the latest Next.js 16 news and summarize them',
          'Write a JavaScript function that validates emails and test it',
          'Analyze the documents I uploaded and give me a summary',
        ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <div className="text-6xl mb-4">⚒️</div>
      <h2 className="text-2xl font-semibold mb-2">
        {lang === 'es' ? 'Forge — Multi-Agente Local' : 'Forge — Local Multi-Agent'}
      </h2>
      <p className="text-muted-foreground max-w-md mb-6">
        {lang === 'es'
          ? 'Un equipo de agentes especializados coordina para resolver tus tareas de desarrollo. Inspirado en Hermes Agent de NousResearch.'
          : 'A team of specialized agents coordinates to solve your development tasks. Inspired by NousResearch Hermes Agent.'}
      </p>
      <div className="grid sm:grid-cols-2 gap-2 max-w-2xl w-full">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => sendMessage(ex)}
            className="text-left p-3 rounded-lg border border-border hover:border-primary/50 hover:bg-muted/50 transition text-sm"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
        {isUser ? <User className="h-4 w-4" /> : <span>{message.agentName ? AGENT_META[message.agentName].emoji : '🤖'}</span>}
      </div>
      <div className={`flex-1 min-w-0 ${isUser ? 'text-right' : ''}`}>
        {!isUser && message.agentName && (
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <span style={{ color: AGENT_META[message.agentName].color }}>{AGENT_META[message.agentName].name}</span>
          </div>
        )}
        {message.runId && !isUser && <AgentActivity runId={message.runId} />}
        <div className={`inline-block max-w-full ${isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'} rounded-lg px-4 py-2 text-left`}>
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                components={{
                  code({ className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || '')
                    const inline = !className
                    return !inline && match ? (
                      <SyntaxHighlighter
                        // @ts-ignore
                        style={oneDark}
                        language={match[1]}
                        PreTag="div"
                        className="rounded-md text-xs"
                      >
                        {String(children).replace(/\n$/, '')}
                      </SyntaxHighlighter>
                    ) : (
                      <code className="px-1 py-0.5 bg-muted-foreground/10 rounded text-xs" {...props}>
                        {children}
                      </code>
                    )
                  },
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
