import { StateCreator } from 'zustand';
import { AppStore, ChainSlice, ChainConfig } from '@/types/store';

export const createChainSlice: StateCreator<AppStore, [], [], ChainSlice> = (set) => ({
    availableChains: [],
    selectedChainId: null,
    isChainSupported: (chainId) => {
        // We will implement this to check against availableChains
        // Ideally checking if chainId exists in the fetched list
        return true;
    },
    setAvailableChains: (chains: ChainConfig[]) => set({ availableChains: chains }),
    setSelectedChain: (chainId: number | null) => set({ selectedChainId: chainId }),
});
