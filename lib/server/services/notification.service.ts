/**
 * Notification Service
 * 
 * Server-side service for creating, fetching, and managing notifications.
 * Provides helper functions for common notification types.
 */

import { prisma } from '@/lib/prisma'
import { NotificationType, Prisma } from '@prisma/client'

// ============================================
// TYPES
// ============================================

export interface CreateNotificationInput {
    walletAddress: string
    chainId: number
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, any>
}

export interface GetNotificationsOptions {
    limit?: number
    cursor?: string
    unreadOnly?: boolean
}

export interface NotificationResult {
    id: string
    type: NotificationType
    title: string
    message: string
    metadata: any
    read: boolean
    createdAt: Date
}

// ============================================
// CORE CRUD OPERATIONS
// ============================================

/**
 * Create a new notification
 */
export async function createNotification(input: CreateNotificationInput): Promise<NotificationResult> {
    const notification = await prisma.notification.create({
        data: {
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            type: input.type,
            title: input.title,
            message: input.message,
            metadata: input.metadata ?? {},
        },
        select: {
            id: true,
            type: true,
            title: true,
            message: true,
            metadata: true,
            read: true,
            createdAt: true,
        }
    })

    console.log(`[NotificationService] ✓ Created ${input.type} for ${input.walletAddress.slice(0, 8)}...`)
    return notification
}

/**
 * Fetch notifications for a user with pagination
 */
export async function getNotifications(
    walletAddress: string,
    chainId: number,
    options: GetNotificationsOptions = {}
): Promise<{ notifications: NotificationResult[]; nextCursor?: string }> {
    const { limit = 50, cursor, unreadOnly = false } = options

    const where: Prisma.NotificationWhereInput = {
        walletAddress,
        chainId,
        ...(unreadOnly && { read: false })
    }

    const notifications = await prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1, // Fetch one extra to check for more
        ...(cursor && {
            cursor: { id: cursor },
            skip: 1, // Skip the cursor
        }),
        select: {
            id: true,
            type: true,
            title: true,
            message: true,
            metadata: true,
            read: true,
            createdAt: true,
        }
    })

    const hasMore = notifications.length > limit
    const items = hasMore ? notifications.slice(0, limit) : notifications
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { notifications: items, nextCursor }
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(walletAddress: string, chainId: number): Promise<number> {
    return prisma.notification.count({
        where: { walletAddress, chainId, read: false }
    })
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(id: string): Promise<void> {
    await prisma.notification.update({
        where: { id },
        data: { read: true }
    })
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(walletAddress: string, chainId: number): Promise<number> {
    const result = await prisma.notification.updateMany({
        where: { walletAddress, chainId, read: false },
        data: { read: true }
    })
    return result.count
}

/**
 * Delete old notifications (cleanup job)
 */
export async function deleteOldNotifications(daysOld: number = 30): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - daysOld)

    const result = await prisma.notification.deleteMany({
        where: {
            createdAt: { lt: cutoff },
            read: true // Only delete read notifications
        }
    })

    console.log(`[NotificationService] Cleaned up ${result.count} old notifications`)
    return result.count
}

// ============================================
// HELPER FUNCTIONS - Common Notification Types
// ============================================

/**
 * Send swap success notification
 */
export async function notifySwapSuccess(
    walletAddress: string,
    chainId: number,
    data: {
        fromAmount: string
        fromToken: string
        toAmount: string
        toToken: string
        txHash: string
        dexName?: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'SWAP_SUCCESS',
        title: 'Swap Completed',
        message: `Swapped ${data.fromAmount} ${data.fromToken} → ${data.toAmount} ${data.toToken}`,
        metadata: {
            txHash: data.txHash,
            fromAmount: data.fromAmount,
            fromToken: data.fromToken,
            toAmount: data.toAmount,
            toToken: data.toToken,
            dexName: data.dexName,
        }
    })
}

/**
 * Send swap failed notification
 */
export async function notifySwapFailed(
    walletAddress: string,
    chainId: number,
    data: {
        fromAmount: string
        fromToken: string
        toToken: string
        error: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'SWAP_FAILED',
        title: 'Swap Failed',
        message: `Failed to swap ${data.fromAmount} ${data.fromToken} → ${data.toToken}`,
        metadata: {
            fromAmount: data.fromAmount,
            fromToken: data.fromToken,
            toToken: data.toToken,
            error: data.error,
        }
    })
}

/**
 * Send smart account deployed notification
 */
export async function notifySmartAccountDeployed(
    walletAddress: string,
    chainId: number,
    data: {
        smartAccountAddress: string
        txHash?: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'SMART_ACCOUNT_DEPLOYED',
        title: 'Smart Account Deployed',
        message: 'Your Smart Account is now active and ready for gasless transactions.',
        metadata: {
            smartAccountAddress: data.smartAccountAddress,
            txHash: data.txHash,
        }
    })
}

/**
 * Send smart account funded notification
 */
export async function notifySmartAccountFunded(
    walletAddress: string,
    chainId: number,
    data: {
        amount: string
        token: string
        txHash: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'SMART_ACCOUNT_FUNDED',
        title: 'Smart Account Funded',
        message: `Received ${data.amount} ${data.token} in your Smart Account`,
        metadata: {
            amount: data.amount,
            token: data.token,
            txHash: data.txHash,
        }
    })
}

/**
 * Send card stack created notification
 */
export async function notifyCardStackCreated(
    walletAddress: string,
    chainId: number,
    data: {
        stackName: string
        budget: string
        token: string
        duration: number
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'CARD_STACK_CREATED',
        title: 'Card Stack Created',
        message: `${data.stackName} is now active with ${data.budget} ${data.token}`,
        metadata: {
            stackName: data.stackName,
            budget: data.budget,
            token: data.token,
            duration: data.duration,
        }
    })
}

/**
 * Send DCA executed notification
 */
export async function notifyDCAExecuted(
    walletAddress: string,
    chainId: number,
    data: {
        stackName: string
        amount: string
        token: string
        txHash: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'DCA_EXECUTED',
        title: 'DCA Executed',
        message: `Auto-bought ${data.amount} ${data.token} via ${data.stackName}`,
        metadata: {
            stackName: data.stackName,
            amount: data.amount,
            token: data.token,
            txHash: data.txHash,
        }
    })
}

/**
 * Send permission expiring notification
 */
export async function notifyPermissionExpiring(
    walletAddress: string,
    chainId: number,
    data: {
        stackName: string
        expiresInDays: number
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'PERMISSION_EXPIRING',
        title: 'Permission Expiring Soon',
        message: `${data.stackName} permission expires in ${data.expiresInDays} days`,
        metadata: {
            stackName: data.stackName,
            expiresInDays: data.expiresInDays,
        }
    })
}

/**
 * Send system alert notification
 */
export async function notifySystem(
    walletAddress: string,
    chainId: number,
    data: {
        title: string
        message: string
        type?: 'alert' | 'info'
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: data.type === 'info' ? 'SYSTEM_INFO' : 'SYSTEM_ALERT',
        title: data.title,
        message: data.message,
        metadata: {}
    })
}

/**
 * Send limit order created notification
 */
export async function notifyLimitOrderCreated(
    walletAddress: string,
    chainId: number,
    data: {
        targetToken: string
        targetPrice: string
        amount: string
        sourceToken: string
        condition: 'BELOW' | 'ABOVE'
    }
) {
    const conditionText = data.condition === 'BELOW' ? 'drops to' : 'rises to'
    return createNotification({
        walletAddress,
        chainId,
        type: 'LIMIT_ORDER_CREATED',
        title: 'Limit Order Set',
        message: `Bot will buy ${data.targetToken} when price ${conditionText} $${data.targetPrice}`,
        metadata: {
            targetToken: data.targetToken,
            targetPrice: data.targetPrice,
            amount: data.amount,
            sourceToken: data.sourceToken,
            condition: data.condition,
        }
    })
}

/**
 * Send limit order executed notification
 */
export async function notifyLimitOrderExecuted(
    walletAddress: string,
    chainId: number,
    data: {
        targetToken: string
        amountIn: string
        amountOut: string
        sourceToken: string
        txHash: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'LIMIT_ORDER_EXECUTED',
        title: 'Limit Order Filled!',
        message: `Bought ${data.amountOut} ${data.targetToken} with ${data.amountIn} ${data.sourceToken}`,
        metadata: {
            targetToken: data.targetToken,
            amountIn: data.amountIn,
            amountOut: data.amountOut,
            sourceToken: data.sourceToken,
            txHash: data.txHash,
        }
    })
}

/**
 * Send subscription payment notification
 */
/**
 * Send subscription payment notification
 */
export async function notifySubscriptionPaid(
    walletAddress: string,
    chainId: number,
    data: {
        label: string
        amount: string
        token: string
        recipient: string
        txHash: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'DCA_EXECUTED', // Reuse type for now, could add SUBSCRIPTION_PAID later
        title: 'Payment Sent! 💸',
        message: `Paid ${data.amount} ${data.token} to ${data.label}`,
        metadata: {
            label: data.label,
            amount: data.amount,
            token: data.token,
            recipient: data.recipient,
            txHash: data.txHash,
        }
    })
}

/**
 * Send trailing stop executed notification
 */
export async function notifyTrailingStopExecuted(
    walletAddress: string,
    chainId: number,
    data: {
        stackName: string
        amountIn: string
        amountOut: string
        tokenIn: string
        tokenOut: string
        txHash: string
    }
) {
    return createNotification({
        walletAddress,
        chainId,
        type: 'TRAILING_STOP_EXECUTED' as any,
        title: 'Trailing Stop Triggered! 🛡️',
        message: `Protected position: Sold ${data.amountIn} ${data.tokenIn} → ${data.amountOut} ${data.tokenOut}`,
        metadata: {
            stackName: data.stackName,
            amountIn: data.amountIn,
            amountOut: data.amountOut,
            tokenIn: data.tokenIn,
            tokenOut: data.tokenOut,
            txHash: data.txHash,
        }
    })
}
