import { z } from 'zod'
import sanitizeHtml from 'sanitize-html'

/**
 * Preprocesador de Zod que recorta espacios (trim) y elimina ABSOLUTAMENTE
 * todas las etiquetas HTML para prevenir ataques XSS.
 * Ideal para: nombres, patentes, marcas, emails, campos cortos.
 */
export const zodSanitizedString = (schema?: z.ZodString) => 
  z.preprocess((val) => {
    if (typeof val !== 'string') return val
    
    // 1. Aplicar trim para evitar campos llenos solo de espacios ("   ")
    const trimmed = val.trim()
    
    // 2. Limpiar cualquier inyección HTML
    return sanitizeHtml(trimmed, {
      allowedTags: [],
      allowedAttributes: {}
    })
  }, schema || z.string())

/**
 * Preprocesador de Zod que recorta espacios (trim) pero permite
 * etiquetas HTML básicas de formato de texto.
 * Ideal para: observaciones, descripciones, notas (Rich Text).
 */
export const zodRichTextString = (schema?: z.ZodString) =>
  z.preprocess((val) => {
    if (typeof val !== 'string') return val
    
    const trimmed = val.trim()
    
    return sanitizeHtml(trimmed, {
      // Solo permite tags de texto básicas
      allowedTags: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: {},
      // Asegurarse de remover iframes, scripts, estilos, etc.
      disallowedTagsMode: 'discard'
    })
  }, schema || z.string())
