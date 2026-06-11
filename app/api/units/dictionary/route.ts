import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/auth-options'
import { prisma } from '@/lib/shared/prisma'
import defaultVehicles from '@/lib/shared/vehicles-ar.json'
import { createLogger } from '@/lib/shared/logger'

const log = createLogger('API:VehicleDictionary')

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const companyId = session.user.companyId

    // Cargar entradas personalizadas de la empresa
    const customEntries = await prisma.customVehicleDictionary.findMany({
      where: { companyId },
      select: { brand: true, model: true }
    })

    // Clonar el diccionario por defecto
    const dictionary: Record<string, string[]> = JSON.parse(JSON.stringify(defaultVehicles))

    // Combinar con las entradas personalizadas
    for (const entry of customEntries) {
      const brand = entry.brand
      const model = entry.model

      // Buscar si la marca ya existe (ignorando mayúsculas/minúsculas)
      const existingBrandKey = Object.keys(dictionary).find(
        k => k.toLowerCase() === brand.toLowerCase()
      )

      if (existingBrandKey) {
        // Si la marca existe, agregar el modelo si no está
        const modelExists = dictionary[existingBrandKey].find(
          m => m.toLowerCase() === model.toLowerCase()
        )
        if (!modelExists) {
          dictionary[existingBrandKey].push(model)
        }
      } else {
        // Si la marca no existe, crearla
        dictionary[brand] = [model]
      }
    }

    // Formatear para el frontend: un array de objetos { brand: string, models: string[] }
    const responseData = Object.keys(dictionary)
      .map(brand => ({
        brand,
        models: dictionary[brand].sort((a, b) => a.localeCompare(b))
      }))
      .sort((a, b) => a.brand.localeCompare(b.brand))

    return NextResponse.json({ data: responseData }, { status: 200 })
  } catch (error) {
    log.error({ err: String(error) }, 'Error fetching vehicle dictionary')
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
