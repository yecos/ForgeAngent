'use client'

import { useApp, AGENT_META, type AgentName } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Cpu, Database, Globe, Code, Brain, Zap } from 'lucide-react'

export function SettingsPanel() {
  const { lang, memory, skills, documents, connected } = useApp()

  const tools = [
    { name: 'web_search', icon: Globe, color: '#3b82f6', desc_es: 'Búsqueda web en tiempo real', desc_en: 'Real-time web search' },
    { name: 'doc_search', icon: Database, color: '#a855f7', desc_es: 'RAG sobre documentos subidos', desc_en: 'RAG over uploaded docs' },
    { name: 'execute_code', icon: Code, color: '#10b981', desc_es: 'Ejecución de código (sandbox)', desc_en: 'Code execution (sandbox)' },
    { name: 'memory_remember', icon: Brain, color: '#f59e0b', desc_es: 'Guardar hecho/preferencia', desc_en: 'Store fact/preference' },
    { name: 'memory_recall', icon: Brain, color: '#f59e0b', desc_es: 'Recordar memorias previas', desc_en: 'Recall previous memories' },
    { name: 'skill_create', icon: Zap, color: '#ec4899', desc_es: 'Crear habilidad reutilizable', desc_en: 'Create reusable skill' },
    { name: 'skill_lookup', icon: Zap, color: '#ec4899', desc_es: 'Buscar habilidad existente', desc_en: 'Look up existing skill' },
  ]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Cpu className="h-4 w-4" />
          {lang === 'es' ? 'Estado del Sistema' : 'System Status'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4">
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Agentes' : 'Agents'}
          </h4>
          {(Object.keys(AGENT_META) as AgentName[]).map((name) => {
            const meta = AGENT_META[name]
            return (
              <div key={name} className="flex items-center gap-2 text-sm">
                <span style={{ color: meta.color }} className="text-lg">{meta.emoji}</span>
                <div className="flex-1">
                  <div className="font-medium">{meta.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {lang === 'es' ? meta.description_es : meta.description_en}
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">ready</Badge>
              </div>
            )
          })}
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Herramientas' : 'Tools'}
          </h4>
          <div className="grid gap-1.5">
            {tools.map((t) => {
              const Icon = t.icon
              return (
                <div key={t.name} className="flex items-center gap-2 text-xs p-1.5 rounded border bg-muted/30">
                  <Icon className="h-3.5 w-3.5" style={{ color: t.color }} />
                  <code className="font-mono">{t.name}</code>
                  <span className="text-muted-foreground ml-auto text-[11px]">
                    {lang === 'es' ? t.desc_es : t.desc_en}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Recursos' : 'Resources'}
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={lang === 'es' ? 'Memorias' : 'Memories'} value={memory.length} />
            <Stat label={lang === 'es' ? 'Skills' : 'Skills'} value={skills.length} />
            <Stat label={lang === 'es' ? 'Docs' : 'Docs'} value={documents.length} />
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {lang === 'es' ? 'Conexión' : 'Connection'}
          </h4>
          <div className="flex items-center justify-between text-xs">
            <span>Runtime WebSocket</span>
            <Badge variant={connected ? 'default' : 'destructive'} className="text-[10px]">
              {connected ? 'connected' : 'offline'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span>LLM Backend</span>
            <Badge variant="outline" className="text-[10px]">z-ai-web-dev-sdk (demo)</Badge>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded">
            {lang === 'es'
              ? '💡 Para uso local real con GPU NVIDIA, ejecuta el backend Python en /python-backend con Ollama + CrewAI + ChromaDB.'
              : '💡 For real local use with NVIDIA GPU, run the Python backend in /python-backend with Ollama + CrewAI + ChromaDB.'}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border rounded p-2 text-center bg-muted/30">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
