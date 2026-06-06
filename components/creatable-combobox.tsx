'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'

interface CreatableComboboxProps {
  options: string[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  emptyText?: string
  disabled?: boolean
}

export function CreatableCombobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  emptyText = 'No encontrado',
  disabled = false,
}: CreatableComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredOptions = options.filter(option => 
    option.toLowerCase().includes(search.toLowerCase())
  )

  const showCreateOption = search.trim() !== '' && !options.some(opt => opt.toLowerCase() === search.toLowerCase().trim())

  return (
    <div className="relative" ref={wrapperRef}>
      <div 
        className={`flex items-center justify-between w-full rounded-md border border-slate-300 bg-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-blue-500 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-text'}`}
        onClick={() => !disabled && setIsOpen(true)}
      >
        <input 
          className="flex-1 outline-none bg-transparent w-full text-ellipsis text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          placeholder={value || placeholder}
          value={isOpen ? search : value}
          onChange={(e) => {
            setSearch(e.target.value)
            setIsOpen(true)
          }}
          disabled={disabled}
        />
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 text-sm shadow-md">
          {filteredOptions.length === 0 && !showCreateOption && (
            <div className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none opacity-50">
              {emptyText}
            </div>
          )}
          
          {filteredOptions.map((option) => (
            <div
              key={option}
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              onClick={() => {
                onChange(option)
                setSearch('')
                setIsOpen(false)
              }}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {value === option && <Check className="h-4 w-4" />}
              </span>
              {option}
            </div>
          ))}

          {showCreateOption && (
            <div
              className="relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm font-medium text-blue-600 dark:text-blue-400 outline-none hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-900/30 dark:hover:text-blue-300"
              onClick={() => {
                onChange(search.trim())
                setSearch('')
                setIsOpen(false)
              }}
            >
              <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                <Plus className="h-4 w-4" />
              </span>
              Crear "{search.trim()}"
            </div>
          )}
        </div>
      )}
    </div>
  )
}
