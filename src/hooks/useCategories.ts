import { useState, useEffect, useRef } from "react";
import { drugApi } from "@/api/drugs";
import type { DrugCategory } from "@/types";

// Module-level cache so all component instances share the same fetch.
// Resets when the module is reloaded (dev HMR / page refresh), which is fine.
let cache: DrugCategory[] | null = null;
let inflight: Promise<DrugCategory[]> | null = null;

/**
 * Fetches drug categories once per app session.
 * Any number of components can call this hook; only one network
 * request is ever made and all share the result.
 */
export function useCategories() {
    const [categories, setCategories] = useState<DrugCategory[]>(cache ?? []);
    const [isLoading, setIsLoading] = useState(cache === null);
    const [error, setError] = useState<string | null>(null);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;

        if (cache !== null) {
            setCategories(cache);
            setIsLoading(false);
            return;
        }

        if (!inflight) {
            inflight = drugApi.listCategories();
        }

        inflight
            .then((data) => {
                cache = data;
                inflight = null;
                if (mounted.current) {
                    setCategories(data);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                inflight = null;
                if (mounted.current) {
                    setError(err?.message ?? "Failed to load categories");
                    setIsLoading(false);
                }
            });

        return () => {
            mounted.current = false;
        };
    }, []);

    /** Call this to force-refresh the category list (e.g. after creating a new category) */
    function invalidate() {
        cache = null;
        inflight = null;
        setIsLoading(true);
        drugApi
            .listCategories()
            .then((data) => {
                cache = data;
                if (mounted.current) {
                    setCategories(data);
                    setIsLoading(false);
                }
            })
            .catch((err) => {
                if (mounted.current) {
                    setError(err?.message ?? "Failed to load categories");
                    setIsLoading(false);
                }
            });
    }

    return { categories, isLoading, error, invalidate };
}