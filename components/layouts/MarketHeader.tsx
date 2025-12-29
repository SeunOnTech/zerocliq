"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePathname } from "next/navigation"
import { NotificationsPanel } from "@/components/ui/NotificationsPanel"
import { WalletProfile } from "@/components/features/auth/WalletProfile"
import { SmartAccountBanner } from "@/components/features/smart-account"

interface MarketHeaderProps {
    onMenuClick: () => void
}

export function MarketHeader({ onMenuClick }: MarketHeaderProps) {
    const pathname = usePathname()

    // Simple logic to get title from path
    const getTitle = () => {
        if (pathname === "/app") return "Home"
        if (pathname.includes("swap")) return "Swap"
        if (pathname.includes("portfolio")) return "Portfolio"
        if (pathname.includes("activity")) return "Activity"
        if (pathname.includes("card-stacks")) return "Card Stacks"
        if (pathname.includes("settings")) return "Settings"
        if (pathname.includes("notifications")) return "Notifications"
        return "ZeroCliq"
    }

    return (
        <header className="sticky top-0 z-30 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="border-b border-border/40">
                <div className="flex h-14 items-center justify-between px-4">
                    {/* Left Section */}
                    <div className="flex items-center gap-4">
                        {/* Mobile: Back Button if sub-page, else Menu Toggle */}
                        <div className="lg:hidden">
                            <Button variant="ghost" size="icon" onClick={onMenuClick}>
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle Menu</span>
                            </Button>
                        </div>

                        <div className="font-semibold text-lg tracking-tight whitespace-nowrap">
                            {getTitle()}
                        </div>
                    </div>

                    {/* Right Section - Wallet & Notifications */}
                    <div className="flex items-center gap-3">
                        <WalletProfile />
                        <NotificationsPanel inHeader={true} />
                    </div>
                </div>
            </div>
            <SmartAccountBanner />
        </header>
    )
}

