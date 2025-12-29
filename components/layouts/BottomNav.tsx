"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, PlusCircle, Search, User } from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
    { name: "Home", href: "/app/dashboard", icon: LayoutDashboard },
    { name: "Browse", href: "/app/dashboard/browse", icon: Search },
    { name: "Create", href: "/app/create", icon: PlusCircle },
    { name: "Profile", href: "/app/profile", icon: User },
]

export function BottomNav() {
    const pathname = usePathname()

    return (
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 pb-safe">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1",
                                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Icon className={cn("h-6 w-6 transition-all", isActive && "scale-110")} />
                            <span className="text-[10px] font-medium">{item.name}</span>
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}
