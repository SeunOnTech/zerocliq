import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '@/store/useAppStore';
import { ChainConfig } from '@/types/store';
import { useEffect } from 'react';

/**
 * useChainConfig - Fetches and caches chain configuration
 * 
 * This hook works alongside ChainSync:
 * - ChainSync handles the global fetch/persist logic
 * - This hook provides React Query integration for components that need it
 * 
 * Note: Most components should read directly from Zustand (useAppStore)
 * for instant access to cached chains.
 */
export function useChainConfig() {
    const setAvailableChains = useAppStore(state => state.setAvailableChains);

    const { data: chains, isLoading, error, refetch } = useQuery({
        queryKey: ['chains'],
        queryFn: async () => {
            // Use local API route instead of backend
            const response = await fetch('/api/chains');
            if (!response.ok) {
                throw new Error('Failed to fetch chains');
            }
            const data = await response.json();
            return data.chains as ChainConfig[];
        },
        staleTime: 0, // Always check for fresh data
        refetchOnMount: 'always', // Revalidate when component mounts
        refetchOnWindowFocus: true, // Revalidate when user returns to tab
        refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    });

    // Sync to store when data changes
    useEffect(() => {
        if (chains) {
            setAvailableChains(chains);
        }
    }, [chains, setAvailableChains]);

    return { chains, isLoading, error, refetch };
}

