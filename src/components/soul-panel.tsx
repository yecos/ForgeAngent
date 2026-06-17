'use client'

import { useApp } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Heart, Save, RotateCcw } from 'lucide-react'
import { useState, useEffect } from 'react'

export function SoulPanel() {
  const { soulMd, updateSoul, loadSoul, lang } = useApp()
  const [draft, setDraft] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    loadSoul()
  }, [loadSoul])

  // Initialize draft from soulMd once
  useEffect(() => {
    setDraft(soulMd)
  }, [soulMd])

  const handleSave = () => {
    updateSoul(draft)
    setDirty(false)
  }

  const handleReset = () => {
    setDraft(soulMd)
    setDirty(false)
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Heart className="h-4 w-4 text-pink-500" />
          SOUL.md — {lang === 'es' ? 'Personalidad' : 'Personality'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === 'es'
            ? 'Define la voz y reglas del agente — estilo Hermes Agent.'
            : 'Define agent voice and rules — Hermes Agent style.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex-1 min-h-0">
          <Textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
            }}
            className="h-full font-mono text-xs resize-none"
            placeholder="# SOUL.md&#10;Define personality, working style, constraints…"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={!dirty} size="sm" className="flex-1">
            <Save className="h-3 w-3 mr-1" />
            {lang === 'es' ? 'Guardar' : 'Save'}
          </Button>
          <Button onClick={handleReset} disabled={!dirty} variant="outline" size="sm">
            <RotateCcw className="h-3 w-3 mr-1" />
            {lang === 'es' ? 'Descartar' : 'Revert'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
