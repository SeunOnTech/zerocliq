"use client"

import { Home, PlusCircle, User } from "lucide-react"

interface MobileBottomNavProps {
    activeView: 'market' | 'create' | 'profile';
    onChangeView: (view: 'market' | 'create' | 'profile') => void;
}

export function MobileBottomNav({ activeView, onChangeView }: MobileBottomNavProps) {
    return (
        <div className="fixed bottom-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-lg border-t border-border/50 md:hidden z-50 px-6 flex items-center justify-between">
            <button
                onClick={() => onChangeView('market')}
                className={`flex flex-col items-center gap-1 ${activeView === 'market' ? 'text-primary' : 'text-muted-foreground'}`}
            >
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-medium">Market</span>
            </button>

            <button
                onClick={() => onChangeView('create')}
                className={`flex flex-col items-center gap-1 ${activeView === 'create' ? 'text-primary' : 'text-muted-foreground'}`}
            >
                <PlusCircle className="w-6 h-6" />
                <span className="text-[10px] font-medium">Create</span>
            </button>

            <button
                onClick={() => onChangeView('profile')}
                className={`flex flex-col items-center gap-1 ${activeView === 'profile' ? 'text-primary' : 'text-muted-foreground'}`}
            >
                <User className="w-6 h-6" />
                <span className="text-[10px] font-medium">Profile</span>
            </button>
        </div>
    )
}
