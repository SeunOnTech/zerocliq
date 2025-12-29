/**
 * Notification Store
 * 
 * Zustand store for managing notifications with real-time updates,
 * polling, and toast integration.
 */

import { create } from 'zustand'
import { toast } from '@/components/ui/toast'

// Types matching Prisma schema
export type NotificationType =
    | 'TRANSFER_SUCCESS'
    | 'TRANSFER_FAILED'
    | 'SMART_ACCOUNT_FUNDED'
    | 'SMART_ACCOUNT_DEPLOYED'
    | 'SWAP_SUCCESS'
    | 'SWAP_FAILED'
    | 'SWAP_PENDING'
    | 'BRIDGE_SUCCESS'
    | 'BRIDGE_FAILED'
    | 'CARD_STACK_CREATED'
    | 'CARD_STACK_EXPIRED'
    | 'DCA_EXECUTED'
    | 'DCA_FAILED'
    | 'PERMISSION_EXPIRING'
    | 'PERMISSION_EXPIRED'
    | 'SYSTEM_ALERT'
    | 'SYSTEM_INFO'

export interface Notification {
    id: string
    type: NotificationType
    title: string
    message: string
    metadata: Record<string, any>
    read: boolean
    createdAt: string
}

interface NotificationState {
    notifications: Notification[]
    isLoading: boolean
    unreadCount: number
    lastFetchedAt: Date | null
    pollingInterval: NodeJS.Timeout | null
    currentWallet: string | null
    currentChainId: number | null

    // Computed
    getUnreadCount: () => number

    // Actions
    fetchNotifications: (walletAddress: string, chainId: number) => Promise<void>
    markAsRead: (id: string) => Promise<void>
    markAllAsRead: () => Promise<void>
    addNotification: (notification: Notification) => void
    startPolling: (walletAddress: string, chainId: number) => void
    stopPolling: () => void
    clearNotifications: () => void
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
    notifications: [],
    isLoading: false,
    unreadCount: 0,
    lastFetchedAt: null,
    pollingInterval: null,
    currentWallet: null,
    currentChainId: null,

    getUnreadCount: () => {
        return get().unreadCount
    },

    fetchNotifications: async (walletAddress: string, chainId: number) => {
        if (!walletAddress || !chainId) return

        set({ isLoading: true, currentWallet: walletAddress, currentChainId: chainId })

        try {
            const response = await fetch(
                `/api/notifications?walletAddress=${walletAddress}&chainId=${chainId}&limit=50`
            )

            if (!response.ok) throw new Error('Failed to fetch notifications')

            const data = await response.json()

            if (!data.success) throw new Error(data.error)

            const oldNotifications = get().notifications
            const newNotifications = data.notifications as Notification[]

            // Check for new notifications to show toast
            if (oldNotifications.length > 0 && get().lastFetchedAt) {
                const newOnes = newNotifications.filter(
                    (n) => !oldNotifications.some((old) => old.id === n.id) && !n.read
                )

                // Show toast for each new notification
                newOnes.forEach((notification) => {
                    showNotificationToast(notification)
                })
            }

            set({
                notifications: newNotifications,
                unreadCount: data.unreadCount || 0,
                isLoading: false,
                lastFetchedAt: new Date()
            })
        } catch (error) {
            console.error('[NotificationStore] Error fetching notifications:', error)
            set({ isLoading: false })
        }
    },

    markAsRead: async (id: string) => {
        try {
            const response = await fetch(`/api/notifications/${id}`, {
                method: 'PATCH',
            })

            if (!response.ok) throw new Error('Failed to mark as read')

            set((state) => ({
                notifications: state.notifications.map((n) =>
                    n.id === id ? { ...n, read: true } : n
                ),
                unreadCount: Math.max(0, state.unreadCount - 1),
            }))
        } catch (error) {
            console.error('[NotificationStore] Error marking notification as read:', error)
        }
    },

    markAllAsRead: async () => {
        const { currentWallet, currentChainId } = get()
        if (!currentWallet || !currentChainId) return

        try {
            const response = await fetch('/api/notifications/mark-all', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    walletAddress: currentWallet,
                    chainId: currentChainId,
                }),
            })

            if (!response.ok) throw new Error('Failed to mark all as read')

            set((state) => ({
                notifications: state.notifications.map((n) => ({ ...n, read: true })),
                unreadCount: 0,
            }))
        } catch (error) {
            console.error('[NotificationStore] Error marking all notifications as read:', error)
        }
    },

    addNotification: (notification: Notification) => {
        set((state) => ({
            notifications: [notification, ...state.notifications],
            unreadCount: state.unreadCount + (notification.read ? 0 : 1),
        }))

        // Show toast immediately
        showNotificationToast(notification)
    },

    startPolling: (walletAddress: string, chainId: number) => {
        const { pollingInterval, fetchNotifications } = get()

        // Clear existing interval
        if (pollingInterval) {
            clearInterval(pollingInterval)
        }

        // Initial fetch
        fetchNotifications(walletAddress, chainId)

        // Start polling every 30 seconds
        const interval = setInterval(() => {
            fetchNotifications(walletAddress, chainId)
        }, 30000)

        set({ pollingInterval: interval })
    },

    stopPolling: () => {
        const { pollingInterval } = get()
        if (pollingInterval) {
            clearInterval(pollingInterval)
            set({ pollingInterval: null })
        }
    },

    clearNotifications: () => {
        set({
            notifications: [],
            unreadCount: 0,
            lastFetchedAt: null,
            currentWallet: null,
            currentChainId: null,
        })
    },
}))

// ============================================
// HELPER: Toast based on notification type
// ============================================

function showNotificationToast(notification: Notification) {
    const { type, title, message } = notification

    switch (type) {
        case 'SWAP_SUCCESS':
        case 'TRANSFER_SUCCESS':
        case 'BRIDGE_SUCCESS':
        case 'SMART_ACCOUNT_DEPLOYED':
        case 'SMART_ACCOUNT_FUNDED':
        case 'CARD_STACK_CREATED':
        case 'DCA_EXECUTED':
            toast.success(title, message)
            break

        case 'SWAP_FAILED':
        case 'TRANSFER_FAILED':
        case 'BRIDGE_FAILED':
        case 'DCA_FAILED':
            toast.error(title, message)
            break

        case 'SWAP_PENDING':
            toast.info(title, message)
            break

        case 'PERMISSION_EXPIRING':
        case 'PERMISSION_EXPIRED':
        case 'CARD_STACK_EXPIRED':
            toast.warning(title, message)
            break

        case 'SYSTEM_ALERT':
            toast.warning(title, message)
            break

        case 'SYSTEM_INFO':
        default:
            toast.info(title, message)
            break
    }
}

// ============================================
// HELPER: Create notification via API
// ============================================

export async function createNotification(data: {
    walletAddress: string
    chainId: number
    type: NotificationType
    title: string
    message: string
    metadata?: Record<string, any>
}): Promise<Notification | null> {
    try {
        const response = await fetch('/api/notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        })

        if (!response.ok) throw new Error('Failed to create notification')

        const result = await response.json()

        if (result.success && result.notification) {
            // Add to store if user is viewing notifications
            const store = useNotificationStore.getState()
            if (store.currentWallet === data.walletAddress && store.currentChainId === data.chainId) {
                store.addNotification(result.notification)
            }
            return result.notification
        }

        return null
    } catch (error) {
        console.error('[createNotification] Error:', error)
        return null
    }
}
