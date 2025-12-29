"use client"

import { createAppKit, useAppKitTheme } from '@reown/appkit/react'
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { monadTestnet, monadDevnet, monadMainnet } from '@/lib/chains'
import { linea, base, arbitrum, mainnet, sepolia } from '@reown/appkit/networks'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider, type Config } from 'wagmi'
import React, { type ReactNode, useEffect } from 'react'
import { useTheme } from 'next-themes'

const queryClient = new QueryClient()

const projectId = 'b56e18d47c72e290881ed7848d56b063' // ZeroClick Project ID

const metadata = {
    name: 'ZeroCliq',
    description: 'AI-Powered Execution Layer',
    url: 'https://zerocliq.io',
    icons: ['https://avatars.githubusercontent.com/u/179229932']
}

// 1. Get Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
    networks: [monadMainnet, monadTestnet, monadDevnet, linea, base, arbitrum, mainnet, sepolia],
    projectId,
    ssr: true
})

// 2. Create Modal
createAppKit({
    adapters: [wagmiAdapter],
    networks: [monadMainnet, monadTestnet, monadDevnet, linea, base, arbitrum, mainnet, sepolia],
    metadata,
    projectId,
    features: {
        analytics: true,
        email: false,
        socials: [],
    },
    // themeMode: 'dark', // Removed hardcoded theme
    themeVariables: {
        '--w3m-accent': '#a855f7',
        '--w3m-border-radius-master': '2px',
        '--w3m-z-index': 9999
    }
})

export function AppKitProvider({ children }: { children: ReactNode }) {
    const { resolvedTheme } = useTheme()
    const { setThemeMode } = useAppKitTheme()

    useEffect(() => {
        if (resolvedTheme) {
            setThemeMode(resolvedTheme as 'light' | 'dark')
        }
    }, [resolvedTheme, setThemeMode])

    return (
        <WagmiProvider config={wagmiAdapter.wagmiConfig as Config}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </WagmiProvider>
    )
}
