import { PrismaClient } from '@prisma/client'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.production' })
const prisma = new PrismaClient()

async function main() {
  const units = await prisma.unit.findMany()
  console.log('Units in DB:', units.length)
  if (units.length > 0) {
    console.log(units[0])
  }
}

main()
