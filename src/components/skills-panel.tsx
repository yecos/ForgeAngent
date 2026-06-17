'use client'

import { useApp } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Zap } from 'lucide-react'

export function SkillsPanel() {
  const { skills, lang } = useApp()
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Zap className="h-4 w-4 text-emerald-500" />
          {lang === 'es' ? 'Habilidades (Skills)' : 'Skills Library'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === 'es'
            ? 'Memoria procedural. Forge crea y reutiliza workflows — estilo Hermes.'
            : 'Procedural memory. Forge creates and reuses workflows — Hermes-style.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full">
          {skills.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              <Zap className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>{lang === 'es' ? 'Forge aún no ha creado skills.' : 'Forge has not created any skills yet.'}</p>
              <p className="mt-1 text-[11px]">
                {lang === 'es'
                  ? 'Pídele "crea una skill para …" y la guardará aquí.'
                  : 'Ask "create a skill for …" and it will be stored here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {skills.map((s, i) => (
                <div key={i} className="border rounded p-3 bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="font-semibold text-sm">{s.name}</h4>
                    <Badge variant="secondary" className="text-[10px] h-4">uses: {s.uses}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">⚡ {s.trigger}</p>
                  <ol className="text-[11px] mt-1 list-decimal list-inside text-foreground/80">
                    {s.steps.map((step, j) => (
                      <li key={j}>{step}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
