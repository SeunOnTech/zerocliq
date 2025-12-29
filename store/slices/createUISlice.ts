import { StateCreator } from 'zustand';
import { AppStore, UISlice } from '@/types/store';

export const createUISlice: StateCreator<AppStore, [], [], UISlice> = (set) => ({
    isChainSelectorOpen: false,
    openChainSelector: () => set({ isChainSelectorOpen: true }),
    closeChainSelector: () => set({ isChainSelectorOpen: false }),
});
