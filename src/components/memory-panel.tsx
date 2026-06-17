'use client'

import { useApp } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Brain, Plus, Trash2, Pin } from 'lucide-react'
import { useState } from 'react'

export function MemoryPanel() {
  const { memory, addMemory, clearMemory, lang } = useApp()
  const [text, setText] = useState('')
  const [kind, setKind] = useState('fact')

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Brain className="h-4 w-4 text-amber-500" />
          {lang === 'es' ? 'Memoria Persistente' : 'Persistent Memory'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === 'es'
            ? 'Hechos y preferencias que Forge recuerda entre sesiones.'
            : 'Facts and preferences Forge remembers across sessions.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
        <div className="flex gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={lang === 'es' ? 'Nuevo recuerdo…' : 'New memory…'}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) {
                addMemory(text.trim(), kind)
                setText('')
              }
            }}
          />
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className="border rounded px-2 text-xs bg-background"
          >
            <option value="fact">fact</option>
            <option value="preference">preference</option>
            <option value="event">event</option>
          </select>
          <Button
            size="icon"
            onClick={() => {
              if (text.trim()) {
                addMemory(text.trim(), kind)
                setText('')
              }
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          {memory.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {lang === 'es' ? 'Sin memorias aún.' : 'No memories yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {memory.map((m, i) => (
                <div key={i} className="border rounded p-2 text-xs bg-muted/30">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px] h-4">{m.kind}</Badge>
                    <span className="text-[10px] text-muted-foreground">{m.source}</span>
                    {m.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                  </div>
                  <p className="text-foreground/90 whitespace-pre-wrap">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        {memory.length > 0 && (
          <Button variant="outline" size="sm" onClick={clearMemory} className="text-xs">
            <Trash2 className="h-3 w-3 mr-1" />
            {lang === 'es' ? 'Borrar todo' : 'Clear all'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
