/**
 * Smart Card Service
 * ==================
 * Frontend service for Smart Card operations.
 * All requests go through Next.js API routes (not directly to backend).
 */

import type { Address } from 'viem'

// ============================================
// TYPES
// ============================================

export type SmartCardType = 'TRADING' | 'REBALANCING' | 'STAKING' | 'GOVERNANCE'

export interface SmartCardCapability {
    title: string
    description: string
    icon: string
}

export interface SmartCardTypeInfo {
    type: SmartCardType
    displayName: string
    shortDescription: string
    longDescription: string
    icon: string
    enabled: boolean
    capabilities: SmartCardCapability[]
}

export interface SmartCard {
    id: string
    type: SmartCardType
    name: string
    status: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'EXPIRED'
    chainId: number
    delegatorAddress: string
    delegateAddress: string
    createdAt: string
}

export interface CreateSmartCardResponse {
    success: boolean
    smartCardId: string
    type: SmartCardType
    name: string
    delegation: any // Delegation struct to sign
    chainId: number
    message: string
    error?: string
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get available Smart Card types
 */
export async function getSmartCardTypes(): Promise<SmartCardTypeInfo[]> {
    try {
        const response = await fetch('/api/smart-cards/types')
        const data = await response.json()

        if (!data.success) {
            console.error('[SmartCard] Failed to get types:', data.error)
            return []
        }

        return data.types || []
    } catch (error) {
        console.error('[SmartCard] Error fetching types:', error)
        return []
    }
}

/**
 * Get Agent Smart Account address for gasless delegation
 */
export async function getAgentSmartAccountAddress(chainId: number): Promise<string | null> {
    try {
        const response = await fetch(`/api/smart-cards/agent-address?chainId=${chainId}`)
        const data = await response.json()

        if (!data.success) {
            console.error('[SmartCard] Failed to get agent address:', data.error)
            return null
        }

        return data.agentSmartAccountAddress
    } catch (error) {
        console.error('[SmartCard] Error fetching agent address:', error)
        return null
    }
}

/**
 * Create a new Smart Card
 */
export async function createSmartCard(params: {
    userId: string
    chainId: number
    type: SmartCardType
    delegatorAddress: string
    delegateAddress: string
}): Promise<CreateSmartCardResponse> {
    try {
        const response = await fetch('/api/smart-cards/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
            return {
                success: false,
                smartCardId: '',
                type: params.type,
                name: '',
                delegation: null,
                chainId: params.chainId,
                message: '',
                error: data.error || 'Failed to create Smart Card',
            }
        }

        return data
    } catch (error: any) {
        console.error('[SmartCard] Error creating card:', error)
        return {
            success: false,
            smartCardId: '',
            type: params.type,
            name: '',
            delegation: null,
            chainId: params.chainId,
            message: '',
            error: error.message || 'Network error',
        }
    }
}

/**
 * Activate a Smart Card with signature
 */
export async function activateSmartCard(id: string, signature: string): Promise<{
    success: boolean
    smartCard?: SmartCard
    error?: string
}> {
    try {
        const response = await fetch(`/api/smart-cards/${id}/sign`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ signature }),
        })

        const data = await response.json()

        if (!response.ok || !data.success) {
            return {
                success: false,
                error: data.error || 'Failed to activate Smart Card',
            }
        }

        return {
            success: true,
            smartCard: data.smartCard,
        }
    } catch (error: any) {
        console.error('[SmartCard] Error activating card:', error)
        return {
            success: false,
            error: error.message || 'Network error',
        }
    }
}

/**
 * Get user's active Trade Card for a specific chain
 * Returns the card if found and ACTIVE, or null otherwise
 */
export async function getUserTradeCard(userId: string, chainId: number): Promise<{
    hasTradeCard: boolean
    tradeCardId: string | null
}> {
    try {
        const params = new URLSearchParams({
            userId,
            chainId: chainId.toString(),
            type: 'TRADING',
        })

        const response = await fetch(`/api/smart-cards/user?${params.toString()}`)
        const data = await response.json()

        if (!data.success || !data.smartCards?.length) {
            return { hasTradeCard: false, tradeCardId: null }
        }

        // Find active Trade Card
        const activeCard = data.smartCards.find(
            (card: SmartCard) => card.type === 'TRADING' && card.status === 'ACTIVE'
        )

        if (activeCard) {
            return { hasTradeCard: true, tradeCardId: activeCard.id }
        }

        return { hasTradeCard: false, tradeCardId: null }
    } catch (error) {
        console.error('[SmartCard] Error fetching Trade Card:', error)
        return { hasTradeCard: false, tradeCardId: null }
    }
}
