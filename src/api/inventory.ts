import { get, post, patch } from "./client";
import type {
    BranchInventoryWithDetails, DrugBatch, DrugBatchCreate,
    StockAdjustmentCreate, LowStockItem, ExpiringBatchItem, PaginatedResponse,
} from "@/types";

const BASE = "/inventory";

// Response shapes for report endpoints
export interface LowStockReport {
    items: LowStockItem[];
    total_items: number;
    out_of_stock_count: number;
    low_stock_count: number;
}

export interface ExpiringBatchReport {
    items: ExpiringBatchItem[];
    total_items: number;
}

export interface StockAdjustmentResponse {
    id: string;
    branch_id: string;
    drug_id: string;
    adjustment_type: string;
    quantity_change: number;
    reason: string | null;
    created_by: string;
    created_at: string;
}

export const inventoryApi = {
    // ── Branch Inventory ──────────────────────────────────────

    /** GET /inventory/branch/{branch_id} — paginated. Pass signal to cancel. */
    getBranchInventory(
        branchId: string,
        params: {
            page?: number;
            page_size?: number;
            drug_id?: string;
            include_zero_stock?: boolean;
            search?: string;
            low_stock_only?: boolean;
        } = {},
        signal?: AbortSignal
    ): Promise<PaginatedResponse<BranchInventoryWithDetails>> {
        const qs = new URLSearchParams();
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
        });
        return get<PaginatedResponse<BranchInventoryWithDetails>>(
            `${BASE}/branch/${branchId}?${qs}`,
            { signal }
        );
    },

    // ── Batches ───────────────────────────────────────────────

    /** GET /inventory/batches/{branch_id}/{drug_id} */
    getBatches(branchId: string, drugId: string): Promise<DrugBatch[]> {
        return get<DrugBatch[]>(`${BASE}/batches/${branchId}/${drugId}`);
    },

    /** POST /inventory/batches — add new stock batch */
    createBatch(data: DrugBatchCreate): Promise<DrugBatch> {
        return post<DrugBatch>(`${BASE}/batches`, data);
    },

    /** PATCH /inventory/batches/{batch_id} */
    updateBatch(batchId: string, data: Partial<DrugBatchCreate>): Promise<DrugBatch> {
        return patch<DrugBatch>(`${BASE}/batches/${batchId}`, data);
    },

    // ── Stock Adjustments ─────────────────────────────────────

    /** POST /inventory/adjustments */
    createAdjustment(data: StockAdjustmentCreate): Promise<StockAdjustmentResponse> {
        return post<StockAdjustmentResponse>(`${BASE}/adjustments`, data);
    },

    /** GET /inventory/adjustments/{branch_id} */
    getAdjustments(branchId: string, drugId?: string): Promise<StockAdjustmentResponse[]> {
        const qs = drugId ? `?drug_id=${drugId}` : "";
        return get<StockAdjustmentResponse[]>(`${BASE}/adjustments/${branchId}${qs}`);
    },

    // ── Reports ───────────────────────────────────────────────

    /** GET /inventory/low-stock/{branch_id} */
    getLowStock(branchId: string): Promise<LowStockReport> {
        return get<LowStockReport>(`${BASE}/low-stock/${branchId}`);
    },

    /** GET /inventory/expiring/{branch_id} */
    getExpiring(branchId: string, days = 90): Promise<ExpiringBatchReport> {
        return get<ExpiringBatchReport>(`${BASE}/expiring/${branchId}?days=${days}`);
    },

    /** GET /inventory/valuation/{branch_id} */
    getValuation(branchId: string): Promise<unknown> {
        return get(`${BASE}/valuation/${branchId}`);
    },
};