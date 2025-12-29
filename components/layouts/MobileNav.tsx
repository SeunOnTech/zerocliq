"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { ArrowRightLeft, LineChart, LayoutDashboard, History, Home, Sparkles } from "lucide-react"

const NAV_ITEMS = [
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

interface MobileNavProps {
    onAiClick: () => void
}

export function MobileNav({ onAiClick }: MobileNavProps) {
    const pathname = usePathname()

    // Split items to insert AI button in middle
    const firstHalf = NAV_ITEMS.slice(0, 2)
    const secondHalf = NAV_ITEMS.slice(2, 4)

    return (
        <div className="fixed bottom-6 left-4 right-4 z-50 md:hidden pb-safe">
            <nav className="bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl flex justify-between items-center px-2 py-2 relative overflow-visible">
                {/* Background Glass Effect */}
                <div className="absolute inset-0 bg-background/50 -z-10 rounded-2xl" />

                {/* First Half */}
                {firstHalf.map((item) => <NavItem key={item.href} item={item} isActive={pathname === item.href} />)}

                {/* Central AI Button - "Part of the nav" but distinctive */}
                <div className="relative -top-6">
                    <motion.button
                        onClick={onAiClick}
                        whileTap={{ scale: 0.9 }}
                        className="w-16 h-16 rounded-full bg-primary border-[4px] border-background flex items-center justify-center shadow-xl relative z-20 group"
                    >
                        {/* AI Sparkles Icon */}
                        <Sparkles className="w-7 h-7 text-white" />
                    </motion.button>
                    {/* Cutout/Curve effect simulation using pseudo-elements implies complex css, 
                         for now we use simple floating overlap which is standard "creative" fab-in-nav */}
                </div>

                {/* Second Half */}
                {secondHalf.map((item) => <NavItem key={item.href} item={item} isActive={pathname === item.href} />)}
            </nav>
        </div>
    )
}

function NavItem({ item, isActive }: { item: any, isActive: boolean }) {
    const Icon = item.icon
    return (
        <Link
            href={item.href}
            className={cn(
                "flex flex-col items-center gap-1 relative z-10 w-16 transition-colors duration-300 group",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
        >
            {/* Animated Active Pill */}
            {isActive && (
                <motion.div
                    layoutId="activeTabMobile"
                    className="absolute -top-3 w-8 h-1 bg-primary rounded-full shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
            )}

            <div className={cn(
                "p-2 rounded-xl transition-all duration-300",
                isActive ? "scale-110 -translate-y-1" : "group-active:scale-95"
            )}>
                <Icon className={cn("w-6 h-6 stroke-[2]", isActive && "fill-primary/20")} />
            </div>

            <span className={cn(
                "text-[10px] font-bold tracking-tight transition-all duration-300",
                isActive ? "scale-110" : "scale-100 opacity-80"
            )}>
                {item.label}
            </span>
        </Link>
    )
}
