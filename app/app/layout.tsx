"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layouts/Sidebar"
import { MarketHeader } from "@/components/layouts/MarketHeader"
import { MobileNav } from "@/components/layouts/MobileNav"
import { ChainSelector } from "@/components/features/auth/ChainSelector"
import { AuthProtection } from "@/components/features/auth/AuthProtection"
import { SmartAccountPrompt } from "@/components/features/smart-account"


import { AiFab } from "@/components/features/ai/AiFab"
import { AiChatOverlay } from "@/components/features/ai/AiChatOverlay"

export default function AppLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [mobileOpen, setMobileOpen] = useState(false)
    const [aiChatOpen, setAiChatOpen] = useState(false)

    return (
        <div className="flex h-screen overflow-hidden bg-background">
            <ChainSelector />
            <AuthProtection />
            <SmartAccountPrompt />
            <Sidebar isMobileOpen={mobileOpen} setIsMobileOpen={setMobileOpen} />
            <div className="flex-1 flex flex-col w-full bg-grid-pattern relative overflow-auto pb-24 md:pb-0">
                <MarketHeader onMenuClick={() => setMobileOpen(true)} />
                <main className="flex-1 w-full">
                    {children}
                </main>
                <MobileNav onAiClick={() => setAiChatOpen(true)} />
            </div>

            {/* Super AI Interface */}
            <AiFab onClick={() => setAiChatOpen(true)} />
            <AiChatOverlay isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
        </div>
    )
}

