"use client"

import { ErrorToast } from "@/components/ui/toast"
import { useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function RichDescriptionEditor({ onChange, initialContent = "", invalid = false, label = "Custom idea description" }: { label?: string; invalid?: boolean; initialContent?: string; onChange: (text: string, html: string) => void }) {
  const [previewUrl, setPreviewUrl] = useState("")
  function previewLink(href: unknown) {
    try {
      const parsed = new URL(typeof href === "string" ? href : "")
      setPreviewUrl(["http:", "https:"].includes(parsed.protocol) ? parsed.href : "")
    } catch { setPreviewUrl("") }
  }
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState("")
  const [url, setUrl] = useState("")
  const [error, setError] = useState("")
  const editor = useEditor({
    immediatelyRender: false,
    content: initialContent,
    shouldRerenderOnTransaction: true,
    extensions: [StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false, underline: false, link: { openOnClick: false, protocols: ["http", "https"] } })],
    editorProps: { attributes: { role: "textbox", "aria-label": label, "aria-multiline": "true", "aria-invalid": String(invalid), class: "min-h-32 p-3 outline-none [&_a]:underline [&_a]:text-jade [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_p]:mb-2" } },
    onUpdate: ({ editor }) => { onChange(editor.getText(), editor.getHTML()); setPreviewUrl("") },
    onSelectionUpdate: ({ editor }) => previewLink(editor.getAttributes("link").href),
  })
  return <div className={`rounded-md border font-normal focus-within:ring-2 ${invalid ? "border-red-500 ring-1 ring-red-500 focus-within:ring-red-500" : "border-input focus-within:ring-ring"}`}>
    <div className="flex flex-wrap gap-1 border-b border-input p-2" role="group" aria-label="Description formatting">
      <Button type="button" variant="ghost" size="sm" disabled={!editor} aria-pressed={editor?.isActive("bold") ?? false} onClick={() => editor?.chain().focus().toggleBold().run()}><strong>Bold</strong></Button>
      <Button type="button" variant="ghost" size="sm" disabled={!editor} aria-pressed={editor?.isActive("italic") ?? false} onClick={() => editor?.chain().focus().toggleItalic().run()}><em>Italic</em></Button>
      <Button type="button" variant="ghost" size="sm" disabled={!editor} aria-pressed={editor?.isActive("bulletList") ?? false} onClick={() => editor?.chain().focus().toggleBulletList().run()}>List</Button>
      <Button type="button" variant="ghost" size="sm" disabled={!editor} onClick={() => { if (!editor) return
        if (editor.isActive("link")) editor.commands.extendMarkRange("link")
        const { from, to } = editor.state.selection
        setLinkText(editor.state.doc.textBetween(from, to, " "))
        setUrl(editor.getAttributes("link").href ?? ""); setLinkOpen(true) }}>Link</Button>
      <Button type="button" variant="ghost" size="sm" disabled={!editor?.isActive("link")} onClick={() => editor?.chain().focus().extendMarkRange("link").unsetLink().run()}>Unlink</Button>
    </div>
    {linkOpen && <div className="grid gap-2 border-b border-input p-3">
      <label className="grid gap-1 text-sm">Link URL<Input value={url} onChange={event => setUrl(event.target.value)} placeholder="https://example.com" /></label>
      <p className="text-sm text-ink/70">{linkText ? <>Link will be applied to <em className="font-medium text-ink">“{linkText}”</em>.</> : "The URL will be inserted at your cursor as a clickable link."}</p>
      {error && <ErrorToast>{error}</ErrorToast>}
      <div className="flex gap-2"><Button type="button" size="sm" onClick={() => {
        try {
          const parsed = new URL(url)
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
          if (editor?.state.selection.empty && !editor.isActive("link")) editor.chain().focus().insertContent({ type: "text", text: url, marks: [{ type: "link", attrs: { href: url } }] }).run()
          else editor?.chain().focus().extendMarkRange("link").setLink({ href: url }).run()
          setLinkOpen(false); setError("")
        } catch { setError("Enter a full http:// or https:// URL.") }
      }}>Apply link</Button><Button type="button" variant="ghost" size="sm" onClick={() => { setLinkOpen(false); setError(""); editor?.commands.focus() }}>Cancel</Button></div>
    </div>}
    <div onMouseOver={event => {
      const anchor = (event.target as Element).closest("a")
      if (anchor) previewLink(anchor.getAttribute("href"))
    }} onClick={event => {
      const anchor = (event.target as Element).closest("a")
      if (anchor) { event.preventDefault(); previewLink(anchor.getAttribute("href")) }
      else setPreviewUrl("")
    }} onKeyDown={event => { if (event.key === "Escape") setPreviewUrl("") }}>
      <EditorContent editor={editor} />
    </div>
    {previewUrl && <div role="region" aria-label="Link preview" className="mx-3 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-ink/15 bg-card p-3 text-sm shadow-lg" onKeyDown={event => {
      if (event.key === "Escape") { setPreviewUrl(""); editor?.commands.focus() }
    }}>
      <span className="min-w-0 flex-1 break-all text-ink/70">{previewUrl}</span>
      <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md px-2 py-1 font-semibold text-jade underline focus-visible:ring-2 focus-visible:ring-ring">Open link ↗<span className="sr-only"> (new tab)</span></a>
      <Button type="button" variant="ghost" size="sm" aria-label="Close link preview" onClick={() => { setPreviewUrl(""); editor?.commands.focus() }}>Close</Button>
    </div>}
  </div>
}
