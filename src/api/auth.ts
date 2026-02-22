import { post, get } from "./client";
import type { LoginRequest, TokenResponse, UserResponse } from "@/types";
import { authStorage } from "@/lib/storage";

export const authApi = {
    /**
     * POST /auth/login
     * Accepts: { username, password, device_info? }
     * Returns: { access_token, refresh_token, expires_in, user }
     */
    async login(data: LoginRequest): Promise<TokenResponse> {
        const result = await post<TokenResponse>("/auth/login", {
            username: data.username,
            password: data.password,
            device_info: navigator.userAgent.slice(0, 500),
        });
        // Persist tokens immediately after successful login
        await authStorage.setTokens(result.access_token, result.refresh_token);
        return result;
    },

    /**
     * POST /auth/logout
     * Requires Bearer token — handled by axios interceptor
     */
    async logout(): Promise<void> {
        try {
            await post("/auth/logout");
        } finally {
            // Always clear local tokens even if API call fails
            await authStorage.clearTokens();
        }
    },

    /**
     * POST /auth/refresh
     * Accepts: { refresh_token }
     * Returns: new TokenResponse
     */
    async refresh(refreshToken: string): Promise<TokenResponse> {
        const result = await post<TokenResponse>("/auth/refresh", {
            refresh_token: refreshToken,
        });
        await authStorage.setTokens(result.access_token, result.refresh_token);
        return result;
    },

    /**
     * GET /auth/me
     * Returns current user from valid access token
     */
    me(): Promise<UserResponse> {
        return get<UserResponse>("/auth/me");
    },

    /**
     * GET /auth/verify
     * Lightweight check that token is still valid
     */
    verify(): Promise<{ valid: boolean; username: string; role: string }> {
        return get("/auth/verify");
    },
};