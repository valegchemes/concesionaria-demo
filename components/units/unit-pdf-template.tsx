'use client'

import React from 'react'
import { formatPrice } from '@/lib/utils'
import { Car, Phone, Mail, MapPin } from 'lucide-react'

interface UnitPdfTemplateProps {
  unit: any
  company: any
}

// A4 dimensions at 96 DPI are approximately 794px x 1123px
// We use a fixed size container to ensure perfect PDF rendering
export const UnitPdfTemplate = React.forwardRef<HTMLDivElement, UnitPdfTemplateProps>(
  ({ unit, company }, ref) => {
    if (!unit) return null

    // Helper to get formatted characteristics
    const getSpecs = () => {
      const specs = []
      if (unit.type) specs.push({ label: 'Tipo', value: unit.type === 'CAR' ? 'Auto' : unit.type === 'MOTORCYCLE' ? 'Moto' : 'Lancha' })
      if (unit.domain) specs.push({ label: 'Patente', value: unit.domain })
      if (unit.vin) specs.push({ label: 'VIN', value: unit.vin })
      if (unit.engineNumber) specs.push({ label: 'Motor', value: unit.engineNumber })
      
      // Add custom attributes
      if (unit.attributes && unit.attributes.length > 0) {
        unit.attributes.forEach((attr: any) => {
          specs.push({ label: attr.key, value: attr.value })
        })
      }
      return specs
    }

    const specs = getSpecs()

    return (
      <div
        ref={ref}
        className="bg-white text-slate-900"
        style={{
          width: '794px',
          minHeight: '1123px',
          padding: '40px',
          boxSizing: 'border-box',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b-2 border-slate-200 pb-6 mb-8">
          <div className="flex items-center gap-4">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="h-16 w-16 object-contain" crossOrigin="anonymous" />
            ) : (
              <div className="h-16 w-16 bg-slate-100 rounded-lg flex items-center justify-center">
                <Car className="h-8 w-8 text-slate-400" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">{company?.name || 'Concesionaria'}</h1>
              <p className="text-slate-500 font-medium">Catálogo Oficial de Vehículos</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-600 space-y-1">
            {company?.phone && <div className="flex items-center justify-end gap-2"><Phone className="h-3 w-3" /> {company.phone}</div>}
            {company?.whatsappCentral && <div className="flex items-center justify-end gap-2"><Phone className="h-3 w-3 text-green-500" /> WhatsApp: {company.whatsappCentral}</div>}
            {company?.email && <div className="flex items-center justify-end gap-2"><Mail className="h-3 w-3" /> {company.email}</div>}
            {company?.city && <div className="flex items-center justify-end gap-2"><MapPin className="h-3 w-3" /> {company.city}</div>}
          </div>
        </div>

        {/* Main Content */}
        <div className="space-y-8">
          {/* Title & Price */}
          <div className="flex justify-between items-end">
            <div className="max-w-[500px]">
              <h2 className="text-4xl font-black text-slate-900 leading-tight">{unit.title}</h2>
              {unit.location && <p className="text-slate-500 mt-2 flex items-center gap-1"><MapPin className="h-4 w-4" /> {unit.location}</p>}
            </div>
            <div className="text-right bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Precio de Venta</p>
              {unit.priceUsd ? (
                <div>
                  <p className="text-4xl font-black text-slate-900">${unit.priceUsd.toLocaleString()} USD</p>
                  {unit.priceArs && <p className="text-lg text-slate-500 font-medium mt-1">{formatPrice(unit.priceArs, 'ARS')}</p>}
                </div>
              ) : unit.priceArs ? (
                <p className="text-4xl font-black text-slate-900">{formatPrice(unit.priceArs, 'ARS')}</p>
              ) : (
                <p className="text-2xl font-black text-slate-400">Consultar</p>
              )}
            </div>
          </div>

          {/* Main Photo */}
          <div className="w-full h-[400px] rounded-2xl overflow-hidden bg-slate-100 shadow-inner">
            {unit.photos && unit.photos.length > 0 ? (
              <img
                src={unit.photos[0].url}
                alt={unit.title}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <Car className="h-20 w-20 mb-4 opacity-50" />
                <p className="font-medium text-lg">Sin imagen disponible</p>
              </div>
            )}
          </div>

          {/* Specs Grid */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Características Técnicas</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {specs.map((spec, idx) => (
                <div key={idx} className="flex justify-between border-b border-slate-100 pb-2">
                  <span className="text-slate-500 font-medium">{spec.label}</span>
                  <span className="text-slate-900 font-bold text-right">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {unit.description && (
            <div>
              <h3 className="text-lg font-bold text-slate-900 border-b border-slate-200 pb-2 mb-4">Descripción</h3>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm">
                {unit.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-10 left-10 right-10 border-t-2 border-slate-100 pt-6 flex justify-between items-center text-sm text-slate-400 font-medium">
          <p>Ficha técnica generada automáticamente.</p>
          <p>Fecha: {new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </div>
    )
  }
)

UnitPdfTemplate.displayName = 'UnitPdfTemplate'
