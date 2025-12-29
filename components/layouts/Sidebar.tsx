"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
    LayoutDashboard,
    ArrowRightLeft,
    History,
    Settings,
    ChevronLeft,
    ChevronRight,
    Wallet,
    Menu,
    X,
    LineChart,
    Home
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTheme } from "next-themes"
import { ModeToggle } from "@/components/ui/mode-toggle"


const SIDEBAR_ITEMS = [
    {
        label: "Home",
        href: "/app",
        icon: Home
    },
    {
        label: "Swap",
        href: "/app/swap",
        icon: ArrowRightLeft
    },
    {
        label: "Card Stacks",
        href: "/app/card-stacks",
        icon: LineChart,
        isNew: true
    },
    {
        label: "Portfolio",
        href: "/app/portfolio",
        icon: LayoutDashboard
    },
    {
        label: "Activity",
        href: "/app/activity",
        icon: History
    }
]

interface SidebarProps {
    isMobileOpen: boolean
    setIsMobileOpen: (open: boolean) => void
}

export function Sidebar({ isMobileOpen, setIsMobileOpen }: SidebarProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const pathname = usePathname()
    const { theme } = useTheme()

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileOpen(false)
    }, [pathname, setIsMobileOpen])

    const sidebarVariants = {
        expanded: { width: 240 },
        collapsed: { width: 72 }
    }

    return (
        <>
            {/* Mobile Overlay */}
            <AnimatePresence>
                {isMobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsMobileOpen(false)}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] lg:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Sidebar Container */}
            <motion.aside
                initial="expanded"
                animate={isCollapsed ? "collapsed" : "expanded"}
                variants={sidebarVariants}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                    "fixed top-0 left-0 h-full z-[70] lg:z-40 bg-background border-r border-border flex flex-col",
                    "lg:sticky lg:top-0 lg:h-screen lg:translate-x-0", // Sticky on desktop
                    isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0", // Slide in on mobile
                    "transition-transform duration-300 ease-in-out lg:transition-none"
                )}
            >
                {/* Header / Logo Area */}
                <div className={cn(
                    "h-16 flex items-center border-b border-border shrink-0",
                    isCollapsed ? "justify-center" : "justify-between px-4"
                )}>
                    {!isCollapsed && (
                        <span className="font-bold text-xl tracking-tight">Zerocliq</span>
                    )}

                    <div className="flex items-center gap-1">
                        {/* Desktop Collapse Toggle */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className="hidden lg:flex h-8 w-8 cursor-pointer"
                        >
                            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                        </Button>

                        {/* Mobile Close Button - Always visible on mobile */}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsMobileOpen(false)}
                            className="lg:hidden h-10 w-10 cursor-pointer touch-manipulation"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </div>

                {/* Navigation Items */}
                <div className="flex-1 py-6 flex flex-col gap-2 px-2">
                    {SIDEBAR_ITEMS.map((item) => {
                        const isActive = pathname === item.href
                        const Icon = item.icon

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors group relative",
                                    isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                                    isCollapsed && "justify-center"
                                )}
                            >
                                <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-primary")} />

                                <AnimatePresence mode="wait">
                                    {!isCollapsed && (
                                        <motion.span
                                            initial={{ opacity: 0, width: 0 }}
                                            animate={{ opacity: 1, width: "auto" }}
                                            exit={{ opacity: 0, width: 0 }}
                                            className="whitespace-nowrap overflow-hidden font-medium"
                                        >
                                            {item.label}
                                        </motion.span>
                                    )}
                                    {/* Animated New Badge */}
                                    {!isCollapsed && item.isNew && (
                                        <motion.span
                                            initial={{ opacity: 0, scale: 0.5 }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                            }}
                                            className="ml-auto px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded bg-emerald-500/20 text-emerald-500 ring-1 ring-emerald-500/30"
                                        >
                                            <motion.span
                                                animate={{ opacity: [1, 0.6, 1] }}
                                                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                            >
                                                New
                                            </motion.span>
                                        </motion.span>
                                    )}
                                </AnimatePresence>

                                {/* Tooltip for collapsed state */}
                                {isCollapsed && (
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 border border-border">
                                        {item.label}
                                    </div>
                                )}
                            </Link>
                        )
                    })}
                </div>

                {/* Bottom Section (Utilities) */}
                <div className="p-3 border-t border-border mt-auto shrink-0">
                    <div className={cn(
                        "flex items-center gap-2 transition-all p-2 rounded-xl bg-secondary/30",
                        isCollapsed ? "flex-col justify-center bg-transparent p-0" : "flex-row"
                    )}>
                        <Link
                            href="/app/settings"
                            className={cn(
                                "flex items-center gap-3 flex-1 rounded-lg transition-colors hover:text-primary cursor-pointer touch-manipulation",
                                isCollapsed ? "justify-center w-full p-2 hover:bg-muted" : "px-2 py-2"
                            )}
                        >
                            <Settings className="h-5 w-5 shrink-0" />
                            {!isCollapsed && <span className="font-medium text-sm">Settings</span>}
                        </Link>

                        {/* Divider in Expanded */}
                        {!isCollapsed && <div className="h-6 w-[1px] bg-border/60" />}

                        {/* Theme Toggle Wrapper */}
                        <div className={cn(
                            "flex items-center justify-center cursor-pointer touch-manipulation",
                            isCollapsed && "w-full pt-2 border-t border-border/50"
                        )}>
                            <ModeToggle />
                        </div>
                    </div>
                </div>
            </motion.aside>
        </>
    )
}
