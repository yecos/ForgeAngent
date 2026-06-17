'use client'

import { useApp, type DocumentItem } from '@/lib/store'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, Upload, Trash2 } from 'lucide-react'
import { useRef } from 'react'

export function DocumentsPanel() {
  const { documents, addDocument, lang } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFiles = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      const text = await file.text()
      const doc: DocumentItem = {
        id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        filename: file.name,
        content: text,
        mimetype: file.type || 'text/plain',
        size: file.size,
      }
      addDocument(doc)
    }
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-purple-500" />
          {lang === 'es' ? 'Documentos (RAG)' : 'Documents (RAG)'}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {lang === 'es'
            ? 'Sube archivos de texto. El agente Doc Analyst los busca cuando los necesitas.'
            : 'Upload text files. The Doc Analyst agent searches them when needed.'}
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
        <input
          ref={fileRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.csv,.py,.js,.ts,.tsx,.html,.css,.yml,.yaml,.xml,.log"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full">
          <Upload className="h-4 w-4 mr-2" />
          {lang === 'es' ? 'Subir documentos' : 'Upload documents'}
        </Button>
        <ScrollArea className="flex-1 min-h-0">
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              {lang === 'es' ? 'Sin documentos.' : 'No documents.'}
            </p>
          ) : (
            <div className="space-y-2">
              {documents.map((d) => (
                <div key={d.id} className="border rounded p-2 bg-muted/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText className="h-3.5 w-3.5 text-purple-500 flex-shrink-0" />
                      <span className="text-xs font-medium truncate">{d.filename}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-4 flex-shrink-0">
                      {(d.size / 1024).toFixed(1)}KB
                    </Badge>
                  </div>
                  {d.content && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                      {d.content.slice(0, 120)}…
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
