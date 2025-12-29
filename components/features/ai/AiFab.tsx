"use client"

import { motion } from "framer-motion"
import { Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface AiFabProps {
    onClick: () => void
}

export function AiFab({ onClick }: AiFabProps) {
    return (
        <motion.button
            onClick={onClick}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className={cn(
                "hidden md:flex fixed z-50 items-center justify-center", // Hidden on mobile, Flex on Desktop
                "md:bottom-6 md:right-6",
                "w-14 h-14 rounded-full", // Slightly larger for better desktop visibility
                "bg-primary text-primary-foreground", // Use Brand Primary Color, no shadow
                "border-4 border-background hover:scale-110 transition-transform duration-300", // Stronger border and hover effect
            )}
        >
            {/* Pulsing Ring */}
            <div className="absolute inset-0 rounded-full bg-foreground opacity-20 animate-ping" />

            {/* Inner Glow */}
            <div className="absolute inset-0 rounded-full bg-foreground/10 blur-sm" />

            {/* Custom ZeroSlip Logo (Star) */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="relative z-10 w-5 h-5">
                <path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z" />
            </svg>

            {/* Label (Desktop Only - Optional Tooltip-like) */}
            <span className="absolute right-full mr-4 bg-card px-2 py-1 rounded-md text-[10px] font-bold border border-border hidden md:group-hover:block whitespace-nowrap">
                Ask ZeroSlip
            </span>
        </motion.button>
    )
}
