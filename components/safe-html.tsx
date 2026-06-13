'use client'

import React from 'react'
import { useMemo, createElement, type ReactNode } from 'react'

const ALLOWED_TAGS = new Set([
  'B', 'I', 'U', 'BR', 'P', 'STRONG', 'EM', 'UL', 'OL', 'LI', 'A', 'SPAN', 'DIV',
] as const)

function sanitizeHref(href: string): string | null {
  if (!href) return null
  try {
    const url = new URL(href, window.location.href)
    if (url.protocol === 'https:' || url.protocol === 'http:' || url.protocol === 'mailto:') {
      return url.href
    }
  } catch {
    if (href.startsWith('mailto:')) return href
  }
  return null
}

function nodeToReact(node: Node, key: number): ReactNode {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return null

  const el = node as HTMLElement
  const tagName = el.tagName as string
  if (!ALLOWED_TAGS.has(tagName as typeof ALLOWED_TAGS extends Set<infer T> ? T : never)) return null

  const children = Array.from(el.childNodes).map((child, i) => nodeToReact(child, i))

  if (tagName === 'A') {
    const href = sanitizeHref(el.getAttribute('href') || '')
    if (!href) return <React.Fragment key={key}>{children}</React.Fragment>
    return (
      <a
        key={key}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-400 underline"
      >
        {children}
      </a>
    )
  }

  // Usar createElement para evitar problemas con keyof JSX.IntrinsicElements
  return createElement(tagName.toLowerCase(), { key }, ...children)
}

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const nodes = useMemo(() => {
    if (typeof window === 'undefined') return null
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    return Array.from(doc.body.childNodes).map((node, i) => nodeToReact(node, i))
  }, [html])

  return <div className={className}>{nodes}</div>
}
