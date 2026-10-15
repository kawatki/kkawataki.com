import sanitizeHtml from "sanitize-html"

export function cleanDescription(html: string, newTab = false) {
  return sanitizeHtml(html, {
    allowedTags: ["p", "br", "strong", "em", "ul", "ol", "li", "a"],
    allowedAttributes: { a: newTab ? ["href", "target", "rel"] : ["href"] },
    transformTags: newTab ? { a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }) } : {},
    allowedSchemes: ["http", "https"],
    allowProtocolRelative: false,
  })
}
export function escapeDescription(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}
export function descriptionText(html: string) {
  return sanitizeHtml(html.replace(/<\/(p|li)>|<br\s*\/?\s*>/gi, "\n"), { allowedTags: [], allowedAttributes: {} }).replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").trim()
}

// Google Tasks notes use readable text, retaining the destinations of links.
export function descriptionForTask(html: string) {
  const safe = cleanDescription(html)
  return descriptionText(safe.replace(/<a href="([^"]*)">([\s\S]*?)<\/a>/g, "$2 ($1)").replace(/<li>/g, "• "))
}
