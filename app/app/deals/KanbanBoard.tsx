'use client'

import React, { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import { Card, CardContent } from '@/components/ui/card'
import { formatPrice, formatDate } from '@/lib/utils'
import { Clock, TrendingUp, CheckCircle, DollarSign, Car, User, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface Deal {
  id: string
  status: string
  finalPrice: number
  finalPriceCurrency: string
  createdAt: string
  lead: { name: string; phone: string }
  unit: { title: string; type: string }
  seller: { name: string }
}

const statusConfig: Record<string, { label: string; classes: string; dot: string; icon: any }> = {
  NEGOTIATION: { label: 'Negociación', classes: 'bg-blue-50 text-blue-700', dot: 'bg-blue-400', icon: TrendingUp },
  RESERVED:    { label: 'Reservado',   classes: 'bg-pink-50 text-pink-700', dot: 'bg-pink-400', icon: Clock },
  APPROVED:    { label: 'Aprobado',    classes: 'bg-violet-50 text-violet-700', dot: 'bg-violet-400', icon: CheckCircle },
  IN_PAYMENT:  { label: 'En Pago',     classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-400', icon: DollarSign },
  DELIVERED:   { label: 'Entregado',   classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-400', icon: CheckCircle },
}

const kanbanColumns = ['NEGOTIATION', 'RESERVED', 'APPROVED', 'IN_PAYMENT', 'DELIVERED']

interface KanbanBoardProps {
  deals: Deal[]
  onStatusChange: (dealId: string, newStatus: string) => void
}

export function KanbanBoard({ deals, onStatusChange }: KanbanBoardProps) {
  const router = useRouter()
  // Disable strict mode warning for DND by waiting for mount
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const newStatus = destination.droppableId
    onStatusChange(draggableId, newStatus)
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex w-full gap-4 overflow-x-auto pb-4 custom-scrollbar">
        {kanbanColumns.map(colId => {
          const conf = statusConfig[colId]
          const colDeals = deals.filter(d => d.status === colId)
          
          return (
            <div key={colId} className="flex flex-col min-w-[300px] w-[300px] bg-slate-50/50 dark:bg-slate-900/30 rounded-xl p-3 border border-slate-200/60 dark:border-slate-800/60">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <conf.icon className={cn("h-4 w-4", conf.classes.split(' ')[1])} />
                  <h3 className="font-semibold text-sm text-slate-700 dark:text-slate-300">{conf.label}</h3>
                </div>
                <span className="text-xs font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-2 py-0.5 rounded-full">
                  {colDeals.length}
                </span>
              </div>
              
              <Droppable droppableId={colId}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex flex-col gap-3 min-h-[150px] transition-colors rounded-lg",
                      snapshot.isDraggingOver ? "bg-slate-100/50 dark:bg-slate-800/30" : ""
                    )}
                  >
                    {colDeals.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            style={{ ...provided.draggableProps.style }}
                            onClick={() => router.push(`/app/deals/${deal.id}`)}
                          >
                            <Card className={cn(
                              "border border-slate-200/80 dark:border-slate-700/80 shadow-sm hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                              snapshot.isDragging ? "shadow-lg scale-[1.02] rotate-1 z-50 ring-2 ring-blue-500" : ""
                            )}>
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start mb-2">
                                  <p className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate w-[70%]">{deal.lead.name}</p>
                                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                                    {deal.finalPriceCurrency} {formatPrice(deal.finalPrice, '')}
                                  </p>
                                </div>
                                <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <div className="flex items-center gap-1.5">
                                    <Car className="h-3 w-3" />
                                    <span className="truncate text-slate-700 dark:text-slate-300">{deal.unit.title}</span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                      <User className="h-3 w-3" />
                                      <span className="truncate max-w-[100px]">{deal.seller.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px]">
                                      <Clock className="h-3 w-3" />
                                      <span>{formatDate(deal.createdAt)}</span>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
