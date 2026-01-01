import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { logLimitOrderCreateActivity } from "@/lib/server/services/activity.service"
import { notifyLimitOrderCreated } from "@/lib/server/services/notification.service"

/**
 * POST /api/card-stacks/configure
 * 
 * Updates a CardStack's DCA configuration (target token, amount per execution).
 * This is called when user configures a strategy post-creation.
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json()

        // Support both stackId and cardStackId (frontend uses cardStackId)
        const stackId = body.stackId || body.cardStackId
        const {
            subCardId,
            type,
            name,
            color,
            allocationPercent,
            config
        } = body

        // Extract config fields - support both flat and nested formats
        const targetTokenAddress = config?.targetTokenAddress || body.targetTokenAddress
        const targetTokenSymbol = config?.targetTokenSymbol || body.targetTokenSymbol
        const targetTokenDecimals = config?.targetTokenDecimals || body.targetTokenDecimals
        const amountPerExecution = config?.amountPerExecution || body.amountPerExecution
        const dailyLimit = config?.dailyLimit || body.dailyLimit
        const targetPrice = config?.targetPrice
        const condition = config?.condition
        const action = config?.action

        console.log("[Configure API] Updating stack configuration:", {
            stackId,
            subCardId,
            type,
            targetTokenSymbol,
            amountPerExecution,
            dailyLimit,
            targetPrice,
            condition
        })

        if (!stackId) {
            return NextResponse.json({ success: false, error: "stackId or cardStackId is required" }, { status: 400 })
        }

        // Update the CardStack with target token info
        const updatedStack = await prisma.cardStack.update({
            where: { id: stackId },
            data: {
                targetTokenAddress: targetTokenAddress || undefined,
                targetTokenSymbol: targetTokenSymbol || undefined,
                targetTokenDecimals: targetTokenDecimals || undefined,
                amountPerExecution: amountPerExecution || undefined,
            },
        })

        // If subCardId is provided and NOT "new", update the subCard's config
        if (subCardId && subCardId !== 'new') {
            await prisma.subCard.update({
                where: { id: subCardId },
                data: {
                    config: {
                        targetTokenAddress,
                        targetTokenSymbol,
                        targetTokenDecimals,
                        amountPerExecution,
                        dailyLimit,
                        description: "Auto-buy at intervals",
                    },
                },
            })
            console.log("[Configure API] Updated SubCard config:", subCardId)
        } else {
            // If NO subCardId, likely adding a NEW strategy (Hybrid architecture)
            // Create a new SubCard - supports both DCA and Limit Orders
            const subCardType = type || 'DCA_BOT'
            const subCardName = name || (subCardType === 'LIMIT_ORDER' ? `Limit ${targetTokenSymbol}` : `DCA to ${targetTokenSymbol}`)
            const subCardColor = color || (subCardType === 'LIMIT_ORDER' ? '#F59E0B' : '#8B5CF6')

            const newSubCard = await prisma.subCard.create({
                data: {
                    stack: { connect: { id: stackId } },
                    name: subCardName,
                    type: subCardType,
                    allocationPercent: allocationPercent || 0,
                    color: subCardColor,
                    status: 'ACTIVE',
                    config: {
                        targetTokenAddress,
                        targetTokenSymbol,
                        targetTokenDecimals,
                        amountPerExecution,
                        dailyLimit,
                        // Limit Order specific fields
                        ...(subCardType === 'LIMIT_ORDER' ? {
                            targetPrice,
                            condition,
                            action: action || 'BUY'
                        } : {}),
                        description: subCardType === 'LIMIT_ORDER'
                            ? `Limit order: Buy ${targetTokenSymbol} at $${targetPrice}`
                            : "Auto-buy from Add Strategy",
                    }
                }
            })
            console.log("[Configure API] Created NEW SubCard:", newSubCard.id, "type:", subCardType)

            // Log activity and create notification for limit orders
            if (subCardType === 'LIMIT_ORDER' && targetTokenSymbol && targetPrice && condition) {
                try {
                    // Get the stack to find wallet address and chain info
                    const stackWithUser = await prisma.cardStack.findUnique({
                        where: { id: stackId },
                        include: { user: true }
                    })

                    if (stackWithUser) {
                        const walletAddress = stackWithUser.user.walletAddress
                        const chainId = stackWithUser.user.chainId

                        // Log activity
                        await logLimitOrderCreateActivity(walletAddress, chainId, {
                            status: 'SUCCESS',
                            stackName: subCardName,
                            targetToken: targetTokenSymbol,
                            targetPrice,
                            amount: dailyLimit || '0',
                            sourceToken: stackWithUser.tokenSymbol,
                            condition: condition as 'BELOW' | 'ABOVE'
                        })

                        // Create notification
                        await notifyLimitOrderCreated(walletAddress, chainId, {
                            targetToken: targetTokenSymbol,
                            targetPrice,
                            amount: dailyLimit || '0',
                            sourceToken: stackWithUser.tokenSymbol,
                            condition: condition as 'BELOW' | 'ABOVE'
                        })

                        console.log("[Configure API] ✓ Logged activity and notification for limit order")
                    }
                } catch (activityError) {
                    // Don't fail the request if activity logging fails
                    console.error("[Configure API] Failed to log activity/notification:", activityError)
                }
            }
        }

        console.log("[Configure API] Successfully updated stack:", updatedStack.id)

        return NextResponse.json({
            success: true,
            stack: updatedStack,
            message: type === 'LIMIT_ORDER'
                ? `Limit order created: Buy ${targetTokenSymbol} at $${targetPrice}`
                : `DCA configured: ${amountPerExecution} → ${targetTokenSymbol}`,
        })

    } catch (error: any) {
        console.error("[Configure API] Error:", error)
        return NextResponse.json(
            { success: false, error: error.message || "Failed to configure stack" },
            { status: 500 }
        )
    }
}
