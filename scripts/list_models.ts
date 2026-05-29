import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()

async function main() {
  const geminiKey = process.env.GEMINI_API_KEY
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY is not defined in local env.')
    return
  }

  console.log('Fetching models from v1 API...')
  try {
    const res1 = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${geminiKey}`)
    const json1 = await res1.json()
    console.log('--- v1 Models ---')
    if (json1.models) {
      json1.models.forEach((m: any) => console.log(`- Name: ${m.name} | Supported methods: ${m.supportedGenerationMethods.join(', ')}`))
    } else {
      console.log('No models returned or error:', json1)
    }
  } catch (err) {
    console.error('Error fetching v1 models:', err)
  }

  console.log('\nFetching models from v1beta API...')
  try {
    const resBeta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`)
    const jsonBeta = await resBeta.json()
    console.log('--- v1beta Models ---')
    if (jsonBeta.models) {
      jsonBeta.models.forEach((m: any) => console.log(`- Name: ${m.name} | Supported methods: ${m.supportedGenerationMethods.join(', ')}`))
    } else {
      console.log('No models returned or error:', jsonBeta)
    }
  } catch (err) {
    console.error('Error fetching v1beta models:', err)
  }
}

main()
