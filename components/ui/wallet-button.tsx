"use client";

import { Button } from "@/components/ui/button"
import { useAppStore } from "@/store/useAppStore"
import { Wallet } from "lucide-react"

export function WalletButton() {
    const openChainSelector = useAppStore(state => state.openChainSelector)

    return (
        <Button
            onClick={() => openChainSelector()}
            className="font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 shadow-[0_0_10px_rgba(234,88,12,0.3)] rounded-lg h-10 px-6"
        >
            <Wallet className="mr-2 h-4 w-4" />
            Connect Wallet
        </Button>
    )
}
