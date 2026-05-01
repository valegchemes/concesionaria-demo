'use client'
import React, { useRef, forwardRef, useImperativeHandle } from 'react'
import SignatureCanvas from 'react-signature-canvas'

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  toDataURL: (type?: string) => string
}

export interface SignaturePadProps {
  penColor?: string
  backgroundColor?: string
  width?: number
  height?: number
}

const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  ({ penColor = '#1e293b', backgroundColor = 'rgb(248,250,252)', width = 440, height = 180 }, ref) => {
    const canvasRef = useRef<SignatureCanvas>(null)

    useImperativeHandle(ref, () => ({
      clear:     () => canvasRef.current?.clear(),
      isEmpty:   () => canvasRef.current?.isEmpty() ?? true,
      toDataURL: (type?: string) => canvasRef.current?.toDataURL(type) ?? '',
    }))

    return (
      <SignatureCanvas
        ref={canvasRef}
        penColor={penColor}
        backgroundColor={backgroundColor}
        canvasProps={{ width, height, className: 'w-full' }}
      />
    )
  }
)

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
