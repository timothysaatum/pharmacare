/**
 * purchases.ts
 * ─────────────────────────────────────────────────────────────
 * API client for Purchase Orders and Suppliers.
 *
 * Conventions (mirrors the rest of the codebase):
 *  - Every function calls the shared `apiClient` (same base-URL / auth headers)
 *  - Errors surface as `ApiError` — callers use `parseApiError()` to extract
 *    a human-readable string
 *  - Paginated list endpoints accept a `params` object that maps 1-to-1 with
 *    the FastAPI query parameters
 */

import { apiClient } from "@/api/client";
import type { PaginatedResponse } from "@/types";
import type {
    PurchaseOrder,
    PurchaseOrderWithDetails,
    PurchaseOrderCreate,
    PurchaseOrderApprove,
    PurchaseOrderReject,
    PurchaseOrderCancel,
    PurchaseOrderItemCreate,
    PurchaseOrderItemWithDetails,
    PurchaseOrderStatus,
    ReceivePurchaseOrder,
    ReceivePurchaseOrderResponse,
    Supplier,
    SupplierCreate,
    SupplierUpdate,
} from "@/types";

// ─── Supplier API ────────────────────────────────────────────────────────────

export interface ListSuppliersParams {
    page?: number;
    page_size?: number;
    active_only?: boolean;
    search?: string;
}

export const suppliersApi = {
    /** Create a new supplier */
    create: (data: SupplierCreate): Promise<Supplier> =>
        apiClient.post("/suppliers/", data),

    /** Fetch a single supplier */
    get: (id: string): Promise<Supplier> =>
        apiClient.get(`/suppliers/${id}`),

    /** Partial update of a supplier */
    update: (id: string, data: SupplierUpdate): Promise<Supplier> =>
        apiClient.patch(`/suppliers/${id}`, data),

    /** Paginated list with optional search / active filter */
    list: (params: ListSuppliersParams = {}): Promise<PaginatedResponse<Supplier>> =>
        apiClient.get("/suppliers/", { params }),
};

// ─── Purchase Order API ──────────────────────────────────────────────────────

export interface ListPurchaseOrdersParams {
    page?: number;
    page_size?: number;
    branch_id?: string;
    status?: PurchaseOrderStatus;
    supplier_id?: string;
}

export const purchaseOrdersApi = {
    // ── CRUD ──────────────────────────────────────────────────────────────────

    /** Create a new PO in draft status */
    create: (data: PurchaseOrderCreate): Promise<PurchaseOrder> =>
        apiClient.post("/purchase-orders/", data),

    /** Full PO with supplier name, branch name, item details */
    get: (id: string): Promise<PurchaseOrderWithDetails> =>
        apiClient.get(`/purchase-orders/${id}`),

    /** Paginated list (lightweight — no item detail) */
    list: (params: ListPurchaseOrdersParams = {}): Promise<PaginatedResponse<PurchaseOrder>> =>
        apiClient.get("/purchase-orders/", { params }),

    // ── Workflow transitions ──────────────────────────────────────────────────

    /** draft → pending */
    submit: (id: string): Promise<PurchaseOrder> =>
        apiClient.post(`/purchase-orders/${id}/submit`),

    /** pending → approved */
    approve: (id: string, data: PurchaseOrderApprove = {}): Promise<PurchaseOrder> =>
        apiClient.post(`/purchase-orders/${id}/approve`, data),

    /** pending → cancelled (rejected) */
    reject: (id: string, data: PurchaseOrderReject): Promise<PurchaseOrder> =>
        apiClient.post(`/purchase-orders/${id}/reject`, data),

    /** draft | pending → cancelled */
    cancel: (id: string, data: PurchaseOrderCancel): Promise<PurchaseOrder> =>
        apiClient.post(`/purchase-orders/${id}/cancel`, data),

    /** approved | ordered → ordered | received */
    receiveGoods: (
        id: string,
        data: ReceivePurchaseOrder,
    ): Promise<ReceivePurchaseOrderResponse> =>
        apiClient.post(`/purchase-orders/${id}/receive`, data),

    // ── Item management ───────────────────────────────────────────────────────

    /** Add items to a draft PO */
    addItems: (
        id: string,
        items: PurchaseOrderItemCreate[],
    ): Promise<PurchaseOrderWithDetails> =>
        apiClient.post(`/purchase-orders/${id}/items`, items),

    /** Update quantity / unit cost of a single draft PO item */
    updateItem: (
        poId: string,
        itemId: string,
        quantity_ordered: number,
        unit_cost: number,
    ): Promise<PurchaseOrderWithDetails> =>
        apiClient.patch(`/purchase-orders/${poId}/items/${itemId}`, null, {
            params: { quantity_ordered, unit_cost },
        }),

    /** All items with drug details */
    listItems: (id: string): Promise<PurchaseOrderItemWithDetails[]> =>
        apiClient.get(`/purchase-orders/${id}/items`),
};