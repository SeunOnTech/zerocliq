
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import dotenv from "dotenv"

dotenv.config()

const connectionString = process.env.DATABASE_URL as string
const pool = new Pool({
    connectionString: connectionString ? connectionString.replace(/\?.*$/, '') : '',
    ssl: {
        rejectUnauthorized: false,
        ca: process.env.CA_CERTIFICATE,
    },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const subCardId = 'cmjstknrd0002wyx494hxeaic' // ID from the previous error log

    console.log(`Resetting budget for SubCard: ${subCardId}`)

    try {
        const updated = await prisma.subCard.update({
            where: { id: subCardId },
            data: {
                currentSpent: '0',
                totalSpent: '0' // Optional: reset total if we want a clean slate
            }
        })

        console.log('✅ Budget reset successfully!')
        console.log('New State:', updated)

    } catch (error) {
        console.error('Error resetting budget:', error)
    } finally {
        await prisma.$disconnect()
    }
}

main()
