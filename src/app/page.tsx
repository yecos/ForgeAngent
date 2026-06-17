'use client'

import { useEffect } from 'react'
import { useApp } from '@/lib/store'
import { ChatView } from '@/components/chat-view'
import { ChatInput } from '@/components/chat-input'
import { MemoryPanel } from '@/components/memory-panel'
import { SkillsPanel } from '@/components/skills-panel'
import { DocumentsPanel } from '@/components/documents-panel'
import { SoulPanel } from '@/components/soul-panel'
import { SettingsPanel } from '@/components/settings-panel'
import { MessageSquare, Brain, Zap, FileText, Heart, Cpu, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function Home() {
  const {
    connect,
    connected,
    lang,
    setLang,
    activePanel,
    setActivePanel,
  } = useApp()

  useEffect(() => {
    connect()
  }, [connect])

  const t = (es: string, en: string) => (lang === 'es' ? es : en)

  const navItems = [
    { id: 'chat' as const, icon: MessageSquare, label_es: 'Chat', label_en: 'Chat' },
    { id: 'memory' as const, icon: Brain, label_es: 'Memoria', label_en: 'Memory' },
    { id: 'skills' as const, icon: Zap, label_es: 'Skills', label_en: 'Skills' },
    { id: 'docs' as const, icon: FileText, label_es: 'Docs', label_en: 'Docs' },
    { id: 'soul' as const, icon: Heart, label_es: 'SOUL', label_en: 'SOUL' },
    { id: 'settings' as const, icon: Cpu, label_es: 'Sistema', label_en: 'System' },
  ]

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur z-10">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚒️</span>
            <div className="font-semibold tracking-tight">Forge</div>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              {t('Multi-Agente Local · inspirado en Hermes', 'Local Multi-Agent · inspired by Hermes')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {connected ? <Wifi className="h-3.5 w-3.5 text-emerald-500" /> : <WifiOff className="h-3.5 w-3.5 text-red-500" />}
              <span className="hidden sm:inline">{connected ? 'online' : 'offline'}</span>
            </div>
            <div className="flex border rounded overflow-hidden text-xs">
              <button
                onClick={() => setLang('es')}
                className={cn('px-2 py-1', lang === 'es' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              >
                ES
              </button>
              <button
                onClick={() => setLang('en')}
                className={cn('px-2 py-1', lang === 'en' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted')}
              >
                EN
              </button>
            </div>
          </div>
        </div>
        {/* Mobile nav */}
        <div className="sm:hidden flex border-t border-border overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={cn(
                  'flex-1 min-w-[64px] flex flex-col items-center py-2 text-[10px] gap-0.5',
                  activePanel === item.id ? 'text-primary bg-primary/5' : 'text-muted-foreground',
                )}
              >
                <Icon className="h-4 w-4" />
                {lang === 'es' ? item.label_es : item.label_en}
              </button>
            )
          })}
        </div>
      </header>

      {/* Body — 3 column layout on desktop, single column on mobile */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left nav (desktop) */}
        <nav className="hidden sm:flex w-48 border-r border-border flex-col p-2 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <Button
                key={item.id}
                variant={activePanel === item.id ? 'secondary' : 'ghost'}
                className="justify-start"
                onClick={() => setActivePanel(item.id)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {lang === 'es' ? item.label_es : item.label_en}
              </Button>
            )
          })}
          <div className="mt-auto p-2 text-[10px] text-muted-foreground/60 border-t border-border">
            <p className="font-mono">v1.0 · local-first</p>
            <p className="mt-1">Ollama · CrewAI · ChromaDB</p>
          </div>
        </nav>

        {/* Main content — chat or side panel */}
        <main className="flex-1 flex overflow-hidden">
          {activePanel === 'chat' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              <ChatView />
              <ChatInput />
            </div>
          ) : (
            <div className="flex-1 p-3 overflow-hidden">
              {activePanel === 'memory' && <MemoryPanel />}
              {activePanel === 'skills' && <SkillsPanel />}
              {activePanel === 'docs' && <DocumentsPanel />}
              {activePanel === 'soul' && <SoulPanel />}
              {activePanel === 'settings' && <SettingsPanel />}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
