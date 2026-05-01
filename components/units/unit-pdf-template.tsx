'use client'

import React from 'react'
import { formatPrice } from '@/lib/utils'

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
          height: '1123px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          position: 'relative',
          padding: 0,
        }}
      >
        {/* Full Bleed Dark Header */}
        <div className="bg-slate-900 text-white px-10 py-8 flex justify-between items-center rounded-b-3xl shadow-lg relative z-10">
          <div className="flex items-center gap-4">
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Logo" className="h-16 w-16 bg-white rounded-lg p-1 object-contain shadow-md" crossOrigin="anonymous" />
            ) : (
              <div className="h-16 w-16 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center shadow-inner">
                <span className="text-2xl font-black text-slate-500">Auto</span>
              </div>
            )}
            <div>
              <h1 className="text-3xl font-black tracking-tight">{company?.name || 'Concesionaria'}</h1>
              <p className="text-slate-400 font-medium text-sm tracking-wide uppercase mt-1">Ficha Técnica Oficial</p>
            </div>
          </div>
          <div className="text-right text-sm text-slate-300 space-y-1.5">
            {company?.phone && <div>Teléfono: <span className="text-white font-semibold">{company.phone}</span></div>}
            {company?.whatsappCentral && <div>WhatsApp: <span className="text-green-400 font-semibold">{company.whatsappCentral}</span></div>}
            {company?.email && <div>Email: <span className="text-white font-semibold">{company.email}</span></div>}
          </div>
        </div>

        {/* Content Body */}
        <div className="px-10 py-8 space-y-8">
          {/* Title & Price */}
          <div className="flex justify-between items-start gap-6">
            <div className="flex-1">
              <h2 className="text-4xl font-black text-slate-900 leading-tight uppercase tracking-tight">{unit.title}</h2>
              {unit.location && <p className="text-slate-500 mt-2 font-medium">Ubicación: {unit.location}</p>}
            </div>
            <div className="text-right bg-blue-600 text-white p-5 rounded-2xl shadow-xl min-w-[220px]">
              <p className="text-[10px] font-bold uppercase tracking-widest text-blue-200 mb-1">Precio de Venta</p>
              {unit.priceUsd ? (
                <div>
                  <p className="text-3xl font-black">${unit.priceUsd.toLocaleString()} USD</p>
                  {unit.priceArs && <p className="text-sm text-blue-200 font-medium mt-1">{formatPrice(unit.priceArs, 'ARS')}</p>}
                </div>
              ) : unit.priceArs ? (
                <p className="text-3xl font-black">{formatPrice(unit.priceArs, 'ARS')}</p>
              ) : (
                <p className="text-2xl font-black text-blue-200">Consultar</p>
              )}
            </div>
          </div>

          {/* Main Photo */}
          <div className="w-full h-[340px] rounded-2xl overflow-hidden shadow-2xl relative border border-slate-100 bg-slate-50">
            {unit.photos && unit.photos.length > 0 ? (
              <img
                src={unit.photos[0].url}
                alt={unit.title}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <span className="text-xl font-bold uppercase tracking-widest text-slate-400">Sin Imagen</span>
              </div>
            )}
          </div>

          {/* Specs Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-5">Especificaciones Técnicas</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {specs.map((spec, idx) => (
                <div key={idx} className="flex flex-col border-l-4 border-blue-600 pl-4 bg-white py-2 shadow-sm rounded-r-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{spec.label}</span>
                  <span className="text-sm font-semibold text-slate-800 mt-1 whitespace-normal break-words">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {unit.description?.trim() && (
            <div className="px-2">
              <h3 className="text-lg font-bold text-slate-900 border-b-2 border-slate-100 pb-2 mb-3">Descripción Adicional</h3>
              <div className="text-slate-600 leading-relaxed text-sm">
                {unit.description.trim().split('\n').map((line: string, i: number) => (
                  <p key={i} className="mb-1 min-h-[1.5rem]">{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900 text-slate-400 px-10 py-5 flex justify-between items-center text-xs font-medium">
          <p>Documento generado por {company?.name || 'la Concesionaria'}. Prohibida su alteración.</p>
          <p>Fecha de emisión: {new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </div>
    )
  }
)

UnitPdfTemplate.displayName = 'UnitPdfTemplate'
