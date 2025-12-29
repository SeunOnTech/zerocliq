"use client"

import { create } from 'zustand'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertTriangle, Info, Bell, ArrowRightLeft, ChevronRight, AlertCircle, Wallet, Shield } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Toast types
export type ToastType = 'success' | 'warning' | 'info' | 'error' | 'system' | 'order'

export interface Toast {
    id: string
    type: ToastType
    title: string
    message: string
    duration?: number
    action?: {
        label: string
        href?: string
        onClick?: () => void
    }
}

interface ToastState {
    toasts: Toast[]
    addToast: (toast: Omit<Toast, 'id'>) => string
    removeToast: (id: string) => void
    clearAll: () => void
}

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],

    addToast: (toast) => {
        const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`
        const newToast = { ...toast, id, duration: toast.duration ?? 5000 }

        set((state) => ({
            toasts: [...state.toasts, newToast]
        }))

        // Auto-remove after duration
        if (newToast.duration > 0) {
            setTimeout(() => {
                get().removeToast(id)
            }, newToast.duration)
        }

        return id
    },

    removeToast: (id) => {
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id)
        }))
    },

    clearAll: () => {
        set({ toasts: [] })
    }
}))

// Toast helper functions with action support
export const toast = {
    success: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'success', title, message, ...options })
    },
    warning: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'warning', title, message, ...options })
    },
    error: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'error', title, message, ...options })
    },
    info: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'info', title, message, ...options })
    },
    order: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'order', title, message, ...options })
    },
    system: (title: string, message: string, options?: { duration?: number; action?: Toast['action'] }) => {
        return useToastStore.getState().addToast({ type: 'system', title, message, ...options })
    }
}

// Get styles based on toast type - NO GRADIENTS, solid colors only
const getToastStyle = (type: ToastType) => {
    switch (type) {
        case 'success':
            return {
                icon: <CheckCircle className="h-5 w-5" />,
                bg: 'bg-emerald-50 dark:bg-emerald-950/80',
                border: 'border-emerald-200 dark:border-emerald-800/60',
                iconBg: 'bg-emerald-100 dark:bg-emerald-900/50',
                iconColor: 'text-emerald-600 dark:text-emerald-400',
                titleColor: 'text-emerald-900 dark:text-emerald-100',
                messageColor: 'text-emerald-700 dark:text-emerald-300',
                actionColor: 'text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200',
                progressColor: 'bg-emerald-500'
            }
        case 'warning':
            return {
                icon: <AlertTriangle className="h-5 w-5" />,
                bg: 'bg-amber-50 dark:bg-amber-950/80',
                border: 'border-amber-200 dark:border-amber-800/60',
                iconBg: 'bg-amber-100 dark:bg-amber-900/50',
                iconColor: 'text-amber-600 dark:text-amber-400',
                titleColor: 'text-amber-900 dark:text-amber-100',
                messageColor: 'text-amber-700 dark:text-amber-300',
                actionColor: 'text-amber-700 dark:text-amber-300 hover:text-amber-800 dark:hover:text-amber-200',
                progressColor: 'bg-amber-500'
            }
        case 'error':
            return {
                icon: <AlertCircle className="h-5 w-5" />,
                bg: 'bg-red-50 dark:bg-red-950/80',
                border: 'border-red-200 dark:border-red-800/60',
                iconBg: 'bg-red-100 dark:bg-red-900/50',
                iconColor: 'text-red-600 dark:text-red-400',
                titleColor: 'text-red-900 dark:text-red-100',
                messageColor: 'text-red-700 dark:text-red-300',
                actionColor: 'text-red-700 dark:text-red-300 hover:text-red-800 dark:hover:text-red-200',
                progressColor: 'bg-red-500'
            }
        case 'info':
            return {
                icon: <Info className="h-5 w-5" />,
                bg: 'bg-blue-50 dark:bg-blue-950/80',
                border: 'border-blue-200 dark:border-blue-800/60',
                iconBg: 'bg-blue-100 dark:bg-blue-900/50',
                iconColor: 'text-blue-600 dark:text-blue-400',
                titleColor: 'text-blue-900 dark:text-blue-100',
                messageColor: 'text-blue-700 dark:text-blue-300',
                actionColor: 'text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200',
                progressColor: 'bg-blue-500'
            }
        case 'order':
            return {
                icon: <ArrowRightLeft className="h-5 w-5" />,
                bg: 'bg-violet-50 dark:bg-violet-950/80',
                border: 'border-violet-200 dark:border-violet-800/60',
                iconBg: 'bg-violet-100 dark:bg-violet-900/50',
                iconColor: 'text-violet-600 dark:text-violet-400',
                titleColor: 'text-violet-900 dark:text-violet-100',
                messageColor: 'text-violet-700 dark:text-violet-300',
                actionColor: 'text-violet-700 dark:text-violet-300 hover:text-violet-800 dark:hover:text-violet-200',
                progressColor: 'bg-violet-500'
            }
        case 'system':
        default:
            return {
                icon: <Bell className="h-5 w-5" />,
                bg: 'bg-gray-50 dark:bg-gray-900/80',
                border: 'border-gray-200 dark:border-gray-700/60',
                iconBg: 'bg-gray-100 dark:bg-gray-800/50',
                iconColor: 'text-gray-600 dark:text-gray-400',
                titleColor: 'text-gray-900 dark:text-gray-100',
                messageColor: 'text-gray-600 dark:text-gray-400',
                actionColor: 'text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200',
                progressColor: 'bg-gray-500'
            }
    }
}

// Individual Toast Component
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
    const router = useRouter()
    const style = getToastStyle(toast.type)

    const handleAction = () => {
        if (toast.action?.onClick) {
            toast.action.onClick()
        }
        if (toast.action?.href) {
            router.push(toast.action.href)
        }
        onRemove()
    }

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: -20, scale: 0.95, x: 20 }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{ opacity: 0, x: 80, scale: 0.95 }}
            transition={{
                type: "spring",
                stiffness: 400,
                damping: 28,
                mass: 0.8
            }}
            className={`
                relative w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border
                ${style.bg} ${style.border}
                backdrop-blur-md
                shadow-lg shadow-black/5 dark:shadow-black/20
            `}
        >
            {/* Progress bar - thin line at bottom */}
            <motion.div
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: (toast.duration ?? 5000) / 1000, ease: "linear" }}
                className={`absolute bottom-0 left-0 right-0 h-[3px] origin-left ${style.progressColor}`}
            />

            <div className="relative flex items-start gap-3.5 p-4">
                {/* Icon with animated entry */}
                <motion.div
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 20 }}
                    className={`
                        flex-shrink-0 h-10 w-10 rounded-xl
                        flex items-center justify-center
                        ${style.iconBg} ${style.iconColor}
                    `}
                >
                    {style.icon}
                </motion.div>

                {/* Content */}
                <div className="flex-1 min-w-0 pt-0.5">
                    <motion.p
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.12 }}
                        className={`font-semibold text-sm leading-tight ${style.titleColor}`}
                    >
                        {toast.title}
                    </motion.p>
                    <motion.p
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.18 }}
                        className={`text-[13px] mt-0.5 leading-snug ${style.messageColor}`}
                    >
                        {toast.message}
                    </motion.p>

                    {/* Action Button */}
                    {toast.action && (
                        <motion.button
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.25 }}
                            onClick={handleAction}
                            className={`
                                mt-2.5
                                flex items-center gap-1
                                text-xs font-semibold
                                transition-all duration-200
                                ${style.actionColor}
                            `}
                        >
                            <span>{toast.action.label}</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </motion.button>
                    )}
                </div>

                {/* Close button */}
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(0,0,0,0.05)' }}
                    whileTap={{ scale: 0.9 }}
                    transition={{ delay: 0.2 }}
                    onClick={(e) => {
                        e.stopPropagation()
                        onRemove()
                    }}
                    className={`
                        flex-shrink-0 p-1.5 rounded-lg
                        transition-colors duration-200
                        ${style.messageColor}
                        opacity-60 hover:opacity-100
                    `}
                >
                    <X className="h-4 w-4" />
                </motion.button>
            </div>
        </motion.div>
    )
}

// Toast Container Component - positioned top-right
export function ToastContainer() {
    const { toasts, removeToast } = useToastStore()

    return (
        <div className="fixed top-4 right-4 z-[100] flex flex-col gap-3 pointer-events-none">
            <AnimatePresence mode="popLayout">
                {toasts.map((t) => (
                    <div key={t.id} className="pointer-events-auto">
                        <ToastItem toast={t} onRemove={() => removeToast(t.id)} />
                    </div>
                ))}
            </AnimatePresence>
        </div>
    )
}
