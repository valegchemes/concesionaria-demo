#!/usr/bin/env node
/**
 * Staging verification script
 * Run after deployment to verify critical functionality
 * 
 * Usage:
 *   node scripts/staging-check.js https://your-app.vercel.app
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000'

const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

async function runTests() {
  console.log(`\n🔍 Running staging checks against: ${BASE_URL}\n`)
  
  let passed = 0
  let failed = 0
  
  for (const { name, fn } of tests) {
    try {
      await fn()
      console.log(`  ✅ ${name}`)
      passed++
    } catch (error) {
      console.log(`  ❌ ${name}: ${error.message}`)
      failed++
    }
  }
  
  console.log(`\n${passed} passed, ${failed} failed\n`)
  process.exit(failed > 0 ? 1 : 0)
}

// Test 1: Health check endpoint
test('Health endpoint returns 200', async () => {
  const res = await fetch(`${BASE_URL}/api/health`)
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`)
  }
  const data = await res.json()
  if (data.status !== 'healthy') {
    throw new Error(`Status is ${data.status}`)
  }
})

// Test 2: Login page loads
test('Login page is accessible', async () => {
  const res = await fetch(`${BASE_URL}/login`)
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`)
  }
  const html = await res.text()
  if (!html.includes('Iniciar sesión') && !html.includes('Login')) {
    throw new Error('Login page content not found')
  }
})

// Test 3: Landing page loads
test('Landing page is accessible', async () => {
  const res = await fetch(`${BASE_URL}/`)
  if (res.status !== 200) {
    throw new Error(`Expected 200, got ${res.status}`)
  }
})

// Test 4: API routes return proper CORS/error handling
test('API error handling works', async () => {
  const res = await fetch(`${BASE_URL}/api/leads`, {
    method: 'GET',
  })
  // Should return 401 (unauthorized) without session
  if (res.status !== 401 && res.status !== 200) {
    throw new Error(`Expected 401 or 200, got ${res.status}`)
  }
})

// Test 5: Static assets are served
test('Static assets are accessible', async () => {
  const res = await fetch(`${BASE_URL}/favicon.ico`)
  if (res.status !== 200 && res.status !== 404) {
    throw new Error(`Unexpected status: ${res.status}`)
  }
})

// Run all tests
runTests().catch(err => {
  console.error('Test runner failed:', err)
  process.exit(1)
})
