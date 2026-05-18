import { z } from 'zod'
import { zodSanitizedString, zodRichTextString } from '@/lib/shared/validators/sanitize'

/**
 * Esquema de validación para la creación de un Vehículo (Unidad).
 * Reemplaza el clásico `CreateVehicleDto` de NestJS.
 * Utiliza los preprocesadores seguros para evitar XSS y strings vacíos ("   ").
 */
export const CreateVehicleSchema = z.object({
  // Patente: Obligatoria, máximo 10 chars, limpia de HTML
  patente: zodSanitizedString(
    z.string()
      .max(10, 'La patente no puede exceder los 10 caracteres')
      .min(1, 'La patente es obligatoria y no puede estar vacía')
  ),

  // Marca: Obligatoria, limpia de HTML
  marca: zodSanitizedString(
    z.string().min(1, 'La marca es obligatoria')
  ),

  // Modelo: Obligatorio, limpio de HTML
  modelo: zodSanitizedString(
    z.string().min(1, 'El modelo es obligatorio')
  ),

  // Observaciones: Opcional, permite HTML básico (ej. <b>, <i>, <strong>), rechaza scripts
  observaciones: zodRichTextString().optional(),
  
  // Otros campos genéricos de ejemplo...
  year: z.number().int().min(1900).max(new Date().getFullYear() + 1).optional(),
  price: z.number().positive().optional(),
})

// Tipo inferido para TypeScript (equivalente a la clase del DTO)
export type CreateVehicleDto = z.infer<typeof CreateVehicleSchema>
