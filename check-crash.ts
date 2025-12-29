
import { prisma } from "./lib/prisma"

async function main() {
    try {
        console.log("Attempting to create stack with invalid type...")
        // Simulate what the frontend is sending: permissionsContext is an OBJECT (signature), not a string
        const signatureObject = { r: '0x...', s: '0x...', v: 27n }

        await prisma.cardStack.create({
            data: {
                userId: "user_test_id",
                permissionsContext: signatureObject as any, // @ts-ignore - This is what's happening at runtime
                delegationManager: "0x00",
                tokenAddress: "0x00",
                tokenSymbol: "TEST",
                totalBudget: "100",
                periodDuration: 86400,
                rawPermission: {},
                expiresAt: new Date()
            }
        })
    } catch (e) {
        console.error("Caught expected error:", e)
    }
}

main()
