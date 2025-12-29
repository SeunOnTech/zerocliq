// Script to delete all CardStacks (run with: npx tsx scripts/cleanup-stacks.ts)
// Uses the app's configured prisma instance (with PG adapter)
const { prisma } = require('../lib/prisma')

async function main() {
    console.log("Connecting to database...")
    await prisma.$connect()

    console.log("Deleting all SubCards...")
    const subCardResult = await prisma.subCard.deleteMany({})
    console.log(`Deleted ${subCardResult.count} SubCards`)

    console.log("Deleting all CardStacks...")
    const stackResult = await prisma.cardStack.deleteMany({})
    console.log(`Deleted ${stackResult.count} CardStacks`)

    console.log("Cleanup complete!")
}

main()
    .catch(e => {
        console.error("Cleanup failed:", e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
