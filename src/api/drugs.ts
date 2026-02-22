import { get, post, patch, del } from "./client";
import type {
    Drug, DrugCreate, DrugUpdate, DrugWithInventory,
    DrugCategory, DrugCategoryCreate, DrugCategoryUpdate,
    DrugSearchFilters, BulkDrugUpdate, PaginatedResponse,
} from "@/types";

const BASE = "/drugs";

export const drugApi = {
    // ── Drug CRUD ───────────────────────────────────────────

    /** GET /drugs — paginated, filterable. Pass an AbortSignal to cancel on unmount. */
    list(
        params: DrugSearchFilters & { page?: number; page_size?: number; is_active?: boolean } = {},
        signal?: AbortSignal
    ): Promise<PaginatedResponse<Drug>> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
        });
        return get<PaginatedResponse<Drug>>(`${BASE}?${qs}`, { signal });
    },

    /** GET /drugs/{id} */
    getById(id: string, signal?: AbortSignal): Promise<Drug> {
        return get<Drug>(`${BASE}/${id}`, { signal });
    },

    /** GET /drugs/{id}/with-inventory?branch_id= */
    getWithInventory(id: string, branchId?: string, signal?: AbortSignal): Promise<DrugWithInventory> {
        const qs = branchId ? `?branch_id=${branchId}` : "";
        return get<DrugWithInventory>(`${BASE}/${id}/with-inventory${qs}`, { signal });
    },

    /** POST /drugs */
    create(data: DrugCreate): Promise<Drug> {
        return post<Drug>(BASE, data);
    },

    /** PATCH /drugs/{id} */
    update(id: string, data: DrugUpdate): Promise<Drug> {
        return patch<Drug>(`${BASE}/${id}`, data);
    },

    /** DELETE /drugs/{id}?hard_delete=false */
    remove(id: string, hardDelete = false): Promise<void> {
        return del<void>(`${BASE}/${id}?hard_delete=${hardDelete}`);
    },

    /** POST /drugs/bulk-update — up to 100 drugs */
    bulkUpdate(data: BulkDrugUpdate): Promise<{ updated_count: number }> {
        return post<{ updated_count: number }>(`${BASE}/bulk-update`, data);
    },

    // ── Categories ───────────────────────────────────────────

    /** GET /drugs/categories */
    listCategories(parentId?: string): Promise<DrugCategory[]> {
        const qs = parentId ? `?parent_id=${parentId}` : "";
        return get<DrugCategory[]>(`${BASE}/categories${qs}`);
    },

    /** POST /drugs/categories */
    createCategory(data: DrugCategoryCreate): Promise<DrugCategory> {
        return post<DrugCategory>(`${BASE}/categories`, data);
    },

    /** PATCH /drugs/categories/{id} */
    updateCategory(id: string, data: DrugCategoryUpdate): Promise<DrugCategory> {
        return patch<DrugCategory>(`${BASE}/categories/${id}`, data);
    },
};