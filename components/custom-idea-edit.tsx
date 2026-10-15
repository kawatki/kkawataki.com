"use client"

import { ErrorToast } from "@/components/ui/toast"
import { useState } from "react"
import { RichDescriptionEditor } from "@/components/rich-description-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cleanDescription, escapeDescription } from "@/lib/rich-description"

type Idea = { title: string; description: string; descriptionHtml?: string }
export function CustomIdeaEdit({ idea, onSave, onCancel }: { idea: Idea; onSave: (idea: Idea) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(idea.title)
  const [text, setText] = useState(idea.description)
  const [html, setHtml] = useState(idea.descriptionHtml ?? escapeDescription(idea.description))
  const valid = title.trim().length >= 3 && title.length <= 100 && text.trim().length >= 3 && text.length <= 450 && html.length <= 1500
  return <div className="mt-4 grid gap-3 border-t border-ink/15 pt-4">
    <label className="grid gap-2 text-sm">Edit title<Input autoFocus value={title} maxLength={100} onChange={event => setTitle(event.target.value)} /></label>
    <p className="text-sm">Edit description</p>
    <RichDescriptionEditor initialContent={html} onChange={(text, html) => { setText(text); setHtml(html) }} />
    <p className="text-xs text-ink/60">{text.length}/450 characters. Each field needs at least 3 characters.</p>
    {html.length > 1500 && <ErrorToast>Please shorten links or simplify formatting.</ErrorToast>}
    <div className="flex justify-end gap-2">
      <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      <Button type="button" disabled={!valid} onClick={() => { if (valid) onSave({ title: title.trim(), description: text.trim(), descriptionHtml: cleanDescription(html) }) }}>Save changes</Button>
    </div>
  </div>
}
