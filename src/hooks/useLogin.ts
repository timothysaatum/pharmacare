import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";
import { parseApiError } from "@/api/client";

export const loginSchema = z.object({
    username: z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(100),
    password: z
        .string()
        .min(8, "Password must be at least 8 characters")
        .max(100),
});

export type LoginValues = z.infer<typeof loginSchema>;

export function useLogin() {
    const { login, setupState } = useAuthStore();
    const navigate = useNavigate();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema) as Resolver<LoginValues>,
        mode: "onTouched",
        defaultValues: { username: "", password: "" },
    });

    // Clear error when the user starts editing
    form.watch(() => {
        if (error) setError(null);
    });

    const submit = async (values: LoginValues) => {
        setIsSubmitting(true);
        setError(null);
        setIsLocked(false);

        try {
            await login(values.username, values.password);

            // Read setupState from the store *after* login resolves —
            // authStore.login() sets it synchronously before this line runs.
            const state = useAuthStore.getState().setupState;

            switch (state) {
                case "ready":
                    navigate("/drugs", { replace: true });
                    break;
                case "needs_branch":
                    navigate("/setup", { replace: true });
                    break;
                case "needs_onboard":
                    navigate("/onboarding", { replace: true });
                    break;
                default:
                    // Fallback: should not happen, but don't leave the user stranded
                    navigate("/drugs", { replace: true });
            }
        } catch (err) {
            const message = parseApiError(err);

            if (
                message.toLowerCase().includes("locked") ||
                message.toLowerCase().includes("too many")
            ) {
                setIsLocked(true);
            }

            setError(message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return {
        form,
        isSubmitting,
        error,
        isLocked,
        submit,
        clearError: () => setError(null),
    };
}