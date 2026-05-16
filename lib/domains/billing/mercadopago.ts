import { MercadoPagoConfig, Preference, Payment } from 'mercadopago'

let _client: MercadoPagoConfig | null = null

function getMPClient(): MercadoPagoConfig {
  if (_client) return _client

  const accessToken = process.env.MP_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error(
      'MP_ACCESS_TOKEN is required. Please set it in your environment variables.'
    )
  }

  _client = new MercadoPagoConfig({
    accessToken,
    options: { timeout: 10000 },
  })

  return _client
}

export function getMPPreference() {
  return new Preference(getMPClient())
}

export function getMPPayment() {
  return new Payment(getMPClient())
}
