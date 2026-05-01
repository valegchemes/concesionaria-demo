'use client'

import React from 'react'
import { formatPrice } from '@/lib/utils'

interface UnitPdfTemplateProps {
  unit: any
  company: any
}

export const UnitPdfTemplate = React.forwardRef<HTMLDivElement, UnitPdfTemplateProps>(
  ({ unit, company }, ref) => {
    if (!unit) return null

    const getSpecs = () => {
      const specs = []
      if (unit.type) specs.push({ label: 'Tipo', value: unit.type === 'CAR' ? 'Auto' : unit.type === 'MOTORCYCLE' ? 'Moto' : 'Lancha' })
      if (unit.domain) specs.push({ label: 'Patente', value: unit.domain })
      if (unit.vin) specs.push({ label: 'VIN', value: unit.vin })
      if (unit.engineNumber) specs.push({ label: 'Motor', value: unit.engineNumber })
      
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
        className="bg-white text-slate-900 font-sans"
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
        <div className="bg-slate-900 text-white px-8 py-5 flex justify-between items-center rounded-b-2xl shadow-sm relative z-10">
          <div className="flex items-center gap-3">
            {company?.logoUrl ? (
              <div 
                className="h-12 w-12 bg-white rounded-md shadow-sm"
                style={{
                  backgroundImage: `url(${company.logoUrl})`,
                  backgroundSize: 'contain',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  backgroundOrigin: 'content-box',
                  padding: '4px'
                }}
              />
            ) : (
              <div className="h-12 w-12 bg-slate-800 border border-slate-700 rounded-md flex items-center justify-center">
                <span className="text-sm font-black text-slate-500">Auto</span>
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold tracking-tight">{company?.name || 'Concesionaria'}</h1>
              <p className="text-slate-400 font-medium text-[9px] tracking-widest uppercase mt-0.5">Ficha Técnica Oficial</p>
            </div>
          </div>
          <div className="text-right text-[10px] text-slate-300 space-y-1">
            {company?.phone && <div>Teléfono: <span className="text-white font-medium">{company.phone}</span></div>}
            {company?.whatsappCentral && <div>WhatsApp: <span className="text-green-400 font-medium">{company.whatsappCentral}</span></div>}
            {company?.email && <div>Email: <span className="text-white font-medium">{company.email}</span></div>}
          </div>
        </div>

        {/* Content Body */}
        <div className="px-8 py-6 space-y-5">
          {/* Title & Price */}
          <div className="flex justify-between items-end gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-black text-slate-900 leading-tight uppercase tracking-tight">{unit.title}</h2>
              {unit.location && <p className="text-slate-500 mt-1 font-medium text-xs">Ubicación: {unit.location}</p>}
            </div>
            <div className="text-right bg-blue-600 text-white p-3 rounded-xl shadow-md min-w-[160px]">
              <p className="text-[8px] font-bold uppercase tracking-widest text-blue-200 mb-0.5">Precio de Venta</p>
              {unit.priceUsd ? (
                <div>
                  <p className="text-xl font-black">${unit.priceUsd.toLocaleString()} USD</p>
                  {unit.priceArs && <p className="text-[10px] text-blue-200 font-medium">{formatPrice(unit.priceArs, 'ARS')}</p>}
                </div>
              ) : unit.priceArs ? (
                <p className="text-xl font-black">{formatPrice(unit.priceArs, 'ARS')}</p>
              ) : (
                <p className="text-lg font-black text-blue-200">Consultar</p>
              )}
            </div>
          </div>

          {/* Main Photo */}
          <div className="w-full h-[300px] rounded-xl overflow-hidden shadow-sm border border-slate-200 bg-slate-50 relative">
            {unit.photos && unit.photos.length > 0 ? (
              <div 
                className="w-full h-full"
                style={{ 
                  backgroundImage: `url(${unit.photos[0].url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat'
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-400">Sin Imagen</span>
              </div>
            )}
          </div>

          {/* Specs Grid */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
            <h3 className="text-sm font-bold text-slate-800 mb-3 uppercase tracking-wide">Especificaciones Técnicas</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {specs.map((spec, idx) => (
                <div key={idx} className="flex flex-col border-l-2 border-blue-600 pl-3 bg-white py-1.5 shadow-sm rounded-r-md">
                  <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider">{spec.label}</span>
                  <span className="text-xs font-semibold text-slate-900 mt-0.5 whitespace-normal break-words">{spec.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          {unit.description?.trim() && (
            <div className="px-1">
              <h3 className="text-sm font-bold text-slate-800 border-b border-slate-200 pb-1.5 mb-2 uppercase tracking-wide">Descripción Adicional</h3>
              <div className="text-slate-600 text-[11px] leading-relaxed">
                {unit.description.trim().split('\n').map((line: string, i: number) => (
                  <p key={i} className="mb-1 min-h-[0.75rem]">{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 bg-slate-900 text-slate-400 px-8 py-3 flex justify-between items-center text-[9px] font-medium">
          <p>Documento generado por {company?.name || 'la Concesionaria'}. Prohibida su alteración.</p>
          <p>Fecha de emisión: {new Date().toLocaleDateString('es-AR')}</p>
        </div>
      </div>
    )
  }
)

UnitPdfTemplate.displayName = 'UnitPdfTemplate'
