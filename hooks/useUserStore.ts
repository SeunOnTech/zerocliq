import { create } from 'zustand';

export interface User {
    id: string;
    walletAddress: string;
    username: string | null;
    avatarUrl: string | null;
    isVerified: boolean;
    totalOrders: number;
    totalVolume: number;
    completionRate: number;
    createdAt: string;
}

interface UserState {
    user: User | null;
    isLoading: boolean;
    isAuthenticated: boolean;

    setUser: (user: User) => void;
    clearUser: () => void;
    setIsLoading: (isLoading: boolean) => void;
    updateUser: (updates: Partial<User>) => void;
}

export const useUserStore = create<UserState>((set) => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,

    setUser: (user) => set({ user, isAuthenticated: true }),
    clearUser: () => set({ user: null, isAuthenticated: false }),
    setIsLoading: (isLoading) => set({ isLoading }),
    updateUser: (updates) =>
        set((state) => ({
            user: state.user ? { ...state.user, ...updates } : null,
        })),
}));
