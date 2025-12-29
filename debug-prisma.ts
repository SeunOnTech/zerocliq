
// Use the app's actual prisma instance which is correctly configured with the adapter
const { prisma } = require('./lib/prisma');

async function main() {
    console.log("Checking Prisma Client models on APP instance...");

    // Check if connected
    try {
        await prisma.$connect();
        console.log("Successfully connected to DB.");
    } catch (e) {
        console.error("Connection failed:", e);
    }

    const keys = Object.keys(prisma);
    console.log("Available keys on prisma instance (first level):", keys);

    // @ts-ignore
    console.log("prisma.cardStack:", prisma.cardStack);

    // @ts-ignore
    if (prisma.cardStack) {
        console.log("SUCCESS: prisma.cardStack exists.");
    } else {
        console.error("FAILURE: prisma.cardStack is UNDEFINED.");
        console.log("Likely cause: Prisma Client generated artifacts are stale.");
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
