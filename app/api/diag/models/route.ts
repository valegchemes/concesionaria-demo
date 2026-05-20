import { NextResponse } from 'next/server'

export async function GET() {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not defined in production.' }, { status: 500 })
  }

  const candidates = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-flash-lite-latest',
    'gemini-2.0-flash-lite'
  ]

  const results: any[] = []

  for (const model of candidates) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'hi' }] }]
          })
        }
      )
      
      const status = res.status
      const body = await res.json()
      
      if (status === 200) {
        results.push({
          model,
          status: 'SUCCESS (200)',
          text: body.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 'No text'
        })
      } else {
        results.push({
          model,
          status: `ERROR (${status})`,
          error: body.error?.message || JSON.stringify(body)
        })
      }
    } catch (err: any) {
      results.push({
        model,
        status: 'EXCEPTION',
        error: err.message || String(err)
      })
    }
  }

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    results
  })
}
