"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { Toast } from "@base-ui/react/toast"
import { CircleAlert, X } from "lucide-react"

export const toast = Toast.createToastManager()
let errorSequence = 0
export function dismissError(id: string) {
  toast.close(id)
}
export function showError(message: string) {
  toast.close("site-error-" + errorSequence)
  const id = "site-error-" + ++errorSequence
  toast.add({ id, type: "error", title: "Please check", description: message, timeout: 8000 })
  return id
}
function ToastList() {
  const { toasts } = Toast.useToastManager()
  return <Toast.Portal><Toast.Viewport className="fixed left-1/2 top-[max(1rem,env(safe-area-inset-top))] z-[10000] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 flex-col gap-3 outline-none">
    {toasts.map(item => <Toast.Root key={item.id} toast={item} swipeDirection="up" className="relative rounded-xl border border-destructive/40 bg-popover p-4 text-popover-foreground shadow-xl transition duration-200 data-starting-style:-translate-y-4 data-starting-style:opacity-0 data-ending-style:opacity-0 data-limited:hidden motion-reduce:transition-none">
      <Toast.Content className="flex gap-3 pr-6"><CircleAlert className="mt-0.5 size-5 shrink-0 text-destructive" /><div><Toast.Title className="font-semibold" /><Toast.Description className="mt-1 text-sm leading-6" /></div></Toast.Content>
      <Toast.Close aria-label="Dismiss notification" className="absolute right-2 top-2 rounded p-1 focus-visible:ring-2 focus-visible:ring-ring"><X className="size-4" /></Toast.Close>
    </Toast.Root>)}
  </Toast.Viewport></Toast.Portal>
}
export function Toaster() {
  useEffect(() => {
    let reporting = false
    let reported: { field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement; id: string } | undefined
    const invalid = (event: Event) => {
      const field = event.target
      if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return
      event.preventDefault()
      if (reporting) return
      reporting = true
      const label = field.labels?.[0]?.textContent?.trim().split("\n")[0] || field.name || "This field"
      reported = { field, id: showError(`${label}: ${field.validationMessage}`) }
      field.setAttribute("aria-invalid", "true")
      field.focus()
      queueMicrotask(() => { reporting = false })
    }
    const clear = (event: Event) => {
      const field = event.target
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
        if (field.validity.valid) {
          field.removeAttribute("aria-invalid")
          if (reported?.field === field) { dismissError(reported.id); reported = undefined }
        }
      }
    }
    document.addEventListener("invalid", invalid, true)
    document.addEventListener("input", clear)
    document.addEventListener("change", clear)
    return () => { document.removeEventListener("invalid", invalid, true); document.removeEventListener("input", clear); document.removeEventListener("change", clear); if (reported) dismissError(reported.id) }
  }, [])
  return <Toast.Provider toastManager={toast} limit={3}><ToastList /></Toast.Provider>
}
// Existing conditional errors share one presentation, while invalid fields retain their outlines.
export function ErrorToast({ children }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const last = useRef("")
  const notification = useRef<string | null>(null)
  useEffect(() => () => { if (notification.current) dismissError(notification.current) }, [])
  useEffect(() => {
    const node = ref.current
    const message = !node || node.parentElement?.closest("[hidden]") ? "" : node.textContent?.trim() ?? ""
    if (!message) {
      if (notification.current) dismissError(notification.current)
      notification.current = null
      last.current = ""
      return
    }
    if (message && message !== last.current) { notification.current = showError(message); last.current = message }
  })
  return <span ref={ref} hidden>{children}</span>
}
