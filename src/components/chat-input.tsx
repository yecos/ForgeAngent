'use client'

import { useApp } from '@/lib/store'
import { useState, KeyboardEvent } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Send, Square } from 'lucide-react'

export function ChatInput() {
  const { sendMessage, isRunning, lang } = useApp()
  const [text, setText] = useState('')

  const handleSend = () => {
    const t = text.trim()
    if (!t || isRunning) return
    sendMessage(t)
    setText('')
  }

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="border-t border-border bg-background/80 backdrop-blur p-3">
      <div className="max-w-4xl mx-auto flex gap-2 items-end">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder={lang === 'es' ? 'Pide algo a Forge…  (Enter para enviar, Shift+Enter para salto de línea)' : 'Ask Forge something… (Enter to send, Shift+Enter for newline)'}
          className="min-h-[52px] max-h-[200px] resize-none"
          rows={2}
        />
        <Button onClick={handleSend} disabled={!text.trim() || isRunning} size="icon" className="h-[52px] w-[52px]">
          {isRunning ? <Square className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <div className="max-w-4xl mx-auto text-[11px] text-muted-foreground/70 mt-1 text-center">
        {lang === 'es'
          ? 'Forge ejecuta localmente con Ollama. Las habilidades y memoria persisten entre sesiones.'
          : 'Forge runs locally with Ollama. Skills and memory persist across sessions.'}
      </div>
    </div>
  )
}
