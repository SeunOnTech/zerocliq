import { prisma } from "@/lib/prisma"
import { StackStatus, SubCardType } from "@prisma/client"

export interface CreateStackData {
    userId: string
    permissionsContext: string
    delegationManager: string
    tokenAddress: string
    tokenSymbol: string
    tokenDecimals: number
    totalBudget: string
    periodDuration: number
    expiresAt: string // ISO date string from frontend
    // DCA Config
    targetTokenAddress?: string
    targetTokenSymbol?: string
    targetTokenDecimals?: number
    amountPerExecution?: string
    subCards: {
        type: SubCardType
        name: string
        color: string
        allocationPercent: number
        config: any
    }[]
}

export const CardStackService = {
    /**
     * Create a new Card Stack with sub-cards
     */
    async createStack(data: CreateStackData) {
        // Validation: Ensure total allocation is <= 100%
        const totalAllocation = data.subCards.reduce((acc, card) => acc + card.allocationPercent, 0)
        if (totalAllocation > 100) {
            throw new Error("Total sub-card allocation cannot exceed 100%")
        }

        // Runtime Check for Stale Client (Common dev issue)
        // @ts-ignore
        if (!prisma.cardStack) {
            console.error("CRITICAL: prisma.cardStack is undefined. Server restart required.")
            throw new Error("SERVER_RESTART_REQUIRED: The database client is out of sync. Please STOP and RESTART 'pnpm dev'.")
        }

        // Parse expiry date from ISO string
        const expiryDate = data.expiresAt ? new Date(data.expiresAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        return prisma.cardStack.create({
            data: {
                userId: data.userId,
                permissionsContext: data.permissionsContext,
                delegationManager: data.delegationManager,
                tokenAddress: data.tokenAddress,
                tokenSymbol: data.tokenSymbol,
                tokenDecimals: data.tokenDecimals || 18,
                totalBudget: data.totalBudget,
                periodDuration: data.periodDuration,
                periodDuration: data.periodDuration,
                status: StackStatus.ACTIVE,
                expiresAt: expiryDate,
                // DCA Config
                targetTokenAddress: data.targetTokenAddress,
                targetTokenSymbol: data.targetTokenSymbol,
                targetTokenDecimals: data.targetTokenDecimals,
                amountPerExecution: data.amountPerExecution,
                subCards: {
                    create: data.subCards.map(card => ({
                        type: card.type,
                        name: card.name,
                        color: card.color,
                        allocationPercent: card.allocationPercent,
                        config: card.config,
                        status: StackStatus.ACTIVE
                    }))
                }
            },
            include: {
                subCards: true
            }
        })
    },

    /**
     * Get active stacks for a user
     */
    async getStacks(userId: string) {
        return prisma.cardStack.findMany({
            where: {
                userId,
                status: StackStatus.ACTIVE
            },
            include: {
                subCards: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        })
    },

    /**
     * Delete/Pause a stack
     */
    async updateStatus(stackId: string, status: StackStatus) {
        return prisma.cardStack.update({
            where: { id: stackId },
            data: { status }
        })
    }
}
