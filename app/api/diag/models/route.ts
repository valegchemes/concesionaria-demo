import { NextResponse } from 'next/server'

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not defined in production.' }, { status: 500 })
  }

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`)
    const json = await res.json()
    return NextResponse.json({ success: true, ...json })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Error listing models.' }, { status: 500 })
  }
}
