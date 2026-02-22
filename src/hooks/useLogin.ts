import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
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

interface UseLoginOptions {
    onSuccess: () => void;
}

export function useLogin({ onSuccess }: UseLoginOptions) {
    const { login } = useAuthStore();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLocked, setIsLocked] = useState(false);

    const form = useForm<LoginValues>({
        resolver: zodResolver(loginSchema) as Resolver<LoginValues>,
        mode: "onTouched",
        defaultValues: { username: "", password: "" },
    });

    // Clear error when user types
    form.watch(() => {
        if (error) setError(null);
    });

    const submit = async (values: LoginValues) => {
        setIsSubmitting(true);
        setError(null);
        setIsLocked(false);

        try {
            await login(values.username, values.password);
            onSuccess();
        } catch (err) {
            const message = parseApiError(err);

            // Detect account lockout from API response
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