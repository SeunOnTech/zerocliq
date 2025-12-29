"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { WalletButton } from "@/components/ui/wallet-button";
import { useAppStore } from "@/store/useAppStore";
import { useUserStore } from "@/hooks/useUserStore";
import { UserProfileMenu } from "@/components/ui/UserProfileMenu";
import { ChainSelector } from "@/components/features/auth/ChainSelector";
import { AuthProtection } from "@/components/features/auth/AuthProtection";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import { WalletProfile } from "@/components/features/auth/WalletProfile";

export function Navbar() {
    const { scrollY } = useScroll();
    const [visible, setVisible] = useState(true);
    const { isConnected } = useAccount(); // Direct wagmi hook
    // const { user } = useUserStore(); // User store less critical for wallet auth now, WalletProfile handles basic display

    useMotionValueEvent(scrollY, "change", (current) => {
        if (typeof current === "number") {
            const previous = scrollY.getPrevious() || 0;
            const direction = current - previous;

            if (scrollY.get() < 50) {
                setVisible(true);
            } else {
                if (direction < 0) {
                    setVisible(true);
                } else {
                    setVisible(false);
                }
            }
        }
    });

    return (
        <div className="fixed top-6 inset-x-0 max-w-2xl mx-auto z-50 px-4">
            <ChainSelector />
            <AuthProtection />
            <motion.nav
                initial={{
                    opacity: 1,
                    y: -100,
                }}
                animate={{
                    y: visible ? 0 : -100,
                    opacity: visible ? 1 : 0,
                }}
                transition={{
                    duration: 0.2,
                }}
                className={cn(
                    "flex relative justify-between items-center space-x-4 border border-border/40 rounded-full bg-background/60 backdrop-blur-md shadow-sm px-6 py-3"
                )}
            >
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:rotate-12 overflow-hidden">
                        <img src="/icon.png" alt="ZeroCliq" className="w-full h-full object-cover" />
                    </div>
                    <span className="font-bold tracking-tight hidden sm:block">
                        ZeroCliq
                    </span>
                </Link>

                <div className="flex items-center gap-4">
                    <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                        {["Features", "Docs"].map((item) => (
                            <Link
                                key={item}
                                href={`#${item.toLowerCase()}`}
                                className="hover:text-foreground transition-colors"
                            >
                                {item}
                            </Link>
                        ))}
                    </div>

                    <div className="h-4 w-[1px] bg-border hidden md:block" />

                    <div className="flex items-center gap-2">
                        <ModeToggle />
                        {/* Unified Wallet Profile handles Connect/Connecting/Connected states */}
                        <WalletProfile />
                    </div>
                </div>
            </motion.nav>
        </div>
    );
}
