"use client"

import { Sidebar } from "./Sidebar"
import { BottomNav } from "./BottomNav"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background">
            <Sidebar />
            <main className="md:pl-64 pb-20 md:pb-0 min-h-screen transition-all duration-300 ease-in-out">
                <div className="container mx-auto p-4 md:p-8 pt-6 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {children}
                </div>
            </main>
            <BottomNav />
        </div>
    )
}
