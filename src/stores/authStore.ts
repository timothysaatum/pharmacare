import { create } from "zustand";
import type { UserResponse as User } from "@/types";
import { authStorage } from "@/lib/storage";
import { authApi } from "@/api/auth";

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    activeBranchId: string | null;

    initialize: () => Promise<void>;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    setUser: (user: User) => void;
    setActiveBranch: (branchId: string) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    activeBranchId: null,

    initialize: async () => {
        set({ isLoading: true });
        try {
            const [token, user, branchId] = await Promise.all([
                authStorage.getAccessToken(),
                authStorage.getUser<User>(),
                authStorage.getActiveBranch(),
            ]);

            if (token && user) {
                set({ user, isAuthenticated: true, activeBranchId: branchId });
            }
        } catch {
            // Attempt to clear tokens, but swallow errors if the store
            // plugin isn't ready yet (e.g. on first launch)
            try {
                await authStorage.clearTokens();
            } catch {
                // Store not available, nothing to clear
            }
        } finally {
            set({ isLoading: false });
        }
    },

    login: async (username, password) => {
        // authApi.login also persists tokens via authStorage.setTokens
        const data = await authApi.login({ username, password });
        await authStorage.setUser(data.user);

        // Auto-select branch if user has exactly one assigned
        let branchId: string | null = null;
        if ((data.user.assigned_branches?.length ?? 0) === 1) {
            branchId = String(data.user.assigned_branches![0]);
            await authStorage.setActiveBranch(branchId);
        }

        set({
            user: data.user,
            isAuthenticated: true,
            activeBranchId: branchId,
        });
    },

    logout: async () => {
        try {
            await authApi.logout();
        } catch {
            // Always clear state even if API fails
        }
        await authStorage.clearTokens();
        set({ user: null, isAuthenticated: false, activeBranchId: null });
    },

    setUser: (user) => {
        authStorage.setUser(user);
        set({ user });
    },

    setActiveBranch: (branchId) => {
        authStorage.setActiveBranch(branchId);
        set({ activeBranchId: branchId });
    },
}));