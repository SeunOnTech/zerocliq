/**
 * Activity Service
 * 
 * Server-side service for logging and querying user activities.
 * All user actions (swaps, transfers, deployments, etc.) are logged here.
 */

import { prisma } from '@/lib/prisma'
import { ActivityType, ActivityStatus, Prisma } from '@prisma/client'

// ============================================
// TYPES
// ============================================

export interface LogActivityInput {
    walletAddress: string
    chainId: number
    type: ActivityType
    status: ActivityStatus
    title: string
    description: string
    metadata?: Record<string, any>
    txHash?: string
}

export interface GetActivitiesOptions {
    limit?: number
    cursor?: string
    type?: ActivityType
    status?: ActivityStatus
}

export interface ActivityResult {
    id: string
    type: ActivityType
    status: ActivityStatus
    title: string
    description: string
    metadata: any
    txHash: string | null
    createdAt: Date
}

// ============================================
// CORE CRUD OPERATIONS
// ============================================

/**
 * Log a new activity
 */
export async function logActivity(input: LogActivityInput): Promise<ActivityResult> {
    const activity = await prisma.activity.create({
        data: {
            id: crypto.randomUUID(), // Explicit ID required by schema
            walletAddress: input.walletAddress,
            chainId: input.chainId,
            type: input.type,
            status: input.status,
            title: input.title,
            description: input.description,
            metadata: input.metadata ?? {},
            txHash: input.txHash,
        },
        select: {
            id: true,
            type: true,
            status: true,
            title: true,
            description: true,
            metadata: true,
            txHash: true,
            createdAt: true,
        }
    })

    console.log(`[ActivityService] ✓ Logged ${input.type} (${input.status}) for ${input.walletAddress.slice(0, 8)}...`)
    return activity
}

/**
 * Fetch activities for a user with pagination and filtering
 */
export async function getActivities(
    walletAddress: string,
    chainId: number,
    options: GetActivitiesOptions = {}
): Promise<{ activities: ActivityResult[]; nextCursor?: string }> {
    const { limit = 50, cursor, type, status } = options

    const where: Prisma.ActivityWhereInput = {
        walletAddress,
        chainId,
        ...(type && { type }),
        ...(status && { status })
    }

    const activities = await prisma.activity.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        ...(cursor && {
            cursor: { id: cursor },
            skip: 1,
        }),
        select: {
            id: true,
            type: true,
            status: true,
            title: true,
            description: true,
            metadata: true,
            txHash: true,
            createdAt: true,
        }
    })

    const hasMore = activities.length > limit
    const items = hasMore ? activities.slice(0, limit) : activities
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined

    return { activities: items, nextCursor }
}

/**
 * Get activity by transaction hash
 */
export async function getActivityByTxHash(txHash: string): Promise<ActivityResult | null> {
    return prisma.activity.findFirst({
        where: { txHash },
        select: {
            id: true,
            type: true,
            status: true,
            title: true,
            description: true,
            metadata: true,
            txHash: true,
            createdAt: true,
        }
    })
}

/**
 * Update activity status (e.g., PENDING → SUCCESS/FAILED)
 */
export async function updateActivityStatus(
    id: string,
    status: ActivityStatus,
    txHash?: string
): Promise<ActivityResult> {
    return prisma.activity.update({
        where: { id },
        data: {
            status,
            ...(txHash && { txHash })
        },
        select: {
            id: true,
            type: true,
            status: true,
            title: true,
            description: true,
            metadata: true,
            txHash: true,
            createdAt: true,
        }
    })
}

/**
 * Get activity statistics for a user
 */
export async function getActivityStats(
    walletAddress: string,
    chainId: number
): Promise<{ total: number; byType: Record<string, number>; byStatus: Record<string, number> }> {
    const [total, byTypeRaw, byStatusRaw] = await Promise.all([
        prisma.activity.count({ where: { walletAddress, chainId } }),
        prisma.activity.groupBy({
            by: ['type'],
            where: { walletAddress, chainId },
            _count: true
        }),
        prisma.activity.groupBy({
            by: ['status'],
            where: { walletAddress, chainId },
            _count: true
        })
    ])

    const byType: Record<string, number> = {}
    byTypeRaw.forEach(item => { byType[item.type] = item._count })

    const byStatus: Record<string, number> = {}
    byStatusRaw.forEach(item => { byStatus[item.status] = item._count })

    return { total, byType, byStatus }
}

// ============================================
// HELPER FUNCTIONS - Common Activity Types
// ============================================

/**
 * Log swap activity
 */
export async function logSwapActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        fromAmount: string
        fromToken: string
        toAmount: string
        toToken: string
        txHash?: string
        dexName?: string
        priceImpact?: string
        error?: string
    }
) {
    const description = data.status === 'SUCCESS'
        ? `Swapped ${data.fromAmount} ${data.fromToken} for ${data.toAmount} ${data.toToken}`
        : data.status === 'PENDING'
            ? `Swapping ${data.fromAmount} ${data.fromToken} for ${data.toToken}...`
            : `Failed to swap ${data.fromAmount} ${data.fromToken} → ${data.toToken}`

    return logActivity({
        walletAddress,
        chainId,
        type: 'SWAP',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Token Swap' : data.status === 'PENDING' ? 'Swap Processing' : 'Swap Failed',
        description,
        txHash: data.txHash,
        metadata: {
            fromAmount: data.fromAmount,
            fromToken: data.fromToken,
            toAmount: data.toAmount,
            toToken: data.toToken,
            dexName: data.dexName,
            priceImpact: data.priceImpact,
            error: data.error,
        }
    })
}

/**
 * Log smart account deployment activity
 */
export async function logSmartAccountDeployActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        smartAccountAddress: string
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'SMART_ACCOUNT_DEPLOY',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Smart Account Deployed' : data.status === 'PENDING' ? 'Deploying Smart Account' : 'Deployment Failed',
        description: data.status === 'SUCCESS'
            ? `Smart Account ${data.smartAccountAddress.slice(0, 6)}...${data.smartAccountAddress.slice(-4)} is now active`
            : data.status === 'PENDING'
                ? 'Deploying your Smart Account...'
                : `Failed to deploy Smart Account: ${data.error}`,
        txHash: data.txHash,
        metadata: {
            smartAccountAddress: data.smartAccountAddress,
            error: data.error,
        }
    })
}

/**
 * Log smart account funding activity
 */
export async function logSmartAccountFundActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        amount: string
        token: string
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'SMART_ACCOUNT_FUND',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Smart Account Funded' : data.status === 'PENDING' ? 'Funding in Progress' : 'Funding Failed',
        description: data.status === 'SUCCESS'
            ? `Deposited ${data.amount} ${data.token} to Smart Account`
            : data.status === 'PENDING'
                ? `Depositing ${data.amount} ${data.token}...`
                : `Failed to deposit ${data.amount} ${data.token}`,
        txHash: data.txHash,
        metadata: {
            amount: data.amount,
            token: data.token,
            error: data.error,
        }
    })
}

/**
 * Log card stack creation activity
 */
export async function logCardStackCreateActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        stackName: string
        budget: string
        token: string
        duration: number
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'CARD_STACK_CREATE',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Card Stack Created' : data.status === 'PENDING' ? 'Creating Card Stack' : 'Creation Failed',
        description: data.status === 'SUCCESS'
            ? `${data.stackName} is active with ${data.budget} ${data.token} budget`
            : data.status === 'PENDING'
                ? `Creating ${data.stackName}...`
                : `Failed to create ${data.stackName}`,
        txHash: data.txHash,
        metadata: {
            stackName: data.stackName,
            budget: data.budget,
            token: data.token,
            duration: data.duration,
            error: data.error,
        }
    })
}

/**
 * Log DCA execution activity
 */
export async function logDCAExecutionActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        stackName: string
        amount: string
        token: string
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'DCA_EXECUTION',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'DCA Executed' : data.status === 'PENDING' ? 'DCA Processing' : 'DCA Failed',
        description: data.status === 'SUCCESS'
            ? `Auto-bought ${data.amount} ${data.token} via ${data.stackName}`
            : data.status === 'PENDING'
                ? `Executing DCA for ${data.stackName}...`
                : `DCA execution failed for ${data.stackName}`,
        txHash: data.txHash,
        metadata: {
            stackName: data.stackName,
            amount: data.amount,
            token: data.token,
            error: data.error,
        }
    })
}

/**
 * Log token approval activity
 */
export async function logApprovalActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        token: string
        spender: string
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'APPROVAL',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Token Approved' : data.status === 'PENDING' ? 'Approving Token' : 'Approval Failed',
        description: data.status === 'SUCCESS'
            ? `Approved ${data.token} for trading`
            : data.status === 'PENDING'
                ? `Approving ${data.token}...`
                : `Failed to approve ${data.token}`,
        txHash: data.txHash,
        metadata: {
            token: data.token,
            spender: data.spender,
            error: data.error,
        }
    })
}

/**
 * Log limit order creation activity
 */
export async function logLimitOrderCreateActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        stackName: string
        targetToken: string
        targetPrice: string
        amount: string
        sourceToken: string
        condition: 'BELOW' | 'ABOVE'
        error?: string
    }
) {
    const conditionText = data.condition === 'BELOW' ? 'drops to' : 'rises to'
    return logActivity({
        walletAddress,
        chainId,
        type: 'LIMIT_ORDER_CREATE',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Limit Order Created' : data.status === 'PENDING' ? 'Creating Limit Order' : 'Limit Order Failed',
        description: data.status === 'SUCCESS'
            ? `Set to buy ${data.targetToken} when price ${conditionText} $${data.targetPrice}`
            : data.status === 'PENDING'
                ? `Creating limit order for ${data.targetToken}...`
                : `Failed to create limit order: ${data.error}`,
        metadata: {
            stackName: data.stackName,
            targetToken: data.targetToken,
            targetPrice: data.targetPrice,
            amount: data.amount,
            sourceToken: data.sourceToken,
            condition: data.condition,
            error: data.error,
        }
    })
}

/**
 * Log limit order execution activity
 */
export async function logLimitOrderExecuteActivity(
    walletAddress: string,
    chainId: number,
    data: {
        status: ActivityStatus
        targetToken: string
        amountIn: string
        amountOut: string
        sourceToken: string
        txHash?: string
        error?: string
    }
) {
    return logActivity({
        walletAddress,
        chainId,
        type: 'LIMIT_ORDER_EXECUTE',
        status: data.status,
        title: data.status === 'SUCCESS' ? 'Limit Order Executed' : data.status === 'PENDING' ? 'Executing Limit Order' : 'Limit Order Failed',
        description: data.status === 'SUCCESS'
            ? `Bought ${data.amountOut} ${data.targetToken} with ${data.amountIn} ${data.sourceToken}`
            : data.status === 'PENDING'
                ? `Executing limit order for ${data.targetToken}...`
                : `Limit order failed: ${data.error}`,
        txHash: data.txHash,
        metadata: {
            targetToken: data.targetToken,
            amountIn: data.amountIn,
            amountOut: data.amountOut,
            sourceToken: data.sourceToken,
            error: data.error,
        }
    })
}
