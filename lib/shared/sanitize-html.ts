import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = ['b', 'i', 'u', 'br', 'p', 'span', 'div', 'a', 'ul', 'ol', 'li', 'strong', 'em']
const ALLOWED_ATTRIBUTES = {
  a: ['href', 'target', 'rel'],
  span: ['class'],
  div: ['class'],
  p: ['class'],
}
const ALLOWED_SCHEMES = ['https', 'mailto', 'http']

export function sanitizeForRender(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: false,
  })
}

export function sanitizeForStorage(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    disallowedTagsMode: 'discard',
    enforceHtmlBoundary: false,
  })
}