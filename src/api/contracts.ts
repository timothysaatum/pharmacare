/**
 * api/contracts.ts
 * ================
 * HTTP wrappers for price contract endpoints used by the POS.
 * All URLs verified against price_contract_endpoints.py.
 */

import { get } from "./client";

// ── POS-specific contract shape ───────────────────────────────────────────────
// Matches the dict returned by GET /contracts/available/{branch_id}

export interface AvailableContract {
    id: string;
    code: string;
    name: string;
    type: "insurance" | "corporate" | "staff" | "senior_citizen" | "standard" | "wholesale" | "promotional";
    discount_percentage: number;
    is_default: boolean;
    requires_verification: boolean;
    requires_approval: boolean;
    /** Pre-formatted display string: "GLICO Insurance (10% + copay)" */
    display: string;
    /** Warning to show cashier: "Verify insurance card" or null */
    warning: string | null;
    // Insurance-specific
    copay_amount: number | null;
    copay_percentage: number | null;
    requires_preauthorization: boolean;
    insurance_provider_id: string | null;
    // Usage limits
    daily_usage_limit: number | null;
    per_customer_usage_limit: number | null;
    // Applicability
    applies_to_prescription_only: boolean;
    applies_to_otc: boolean;
    minimum_purchase_amount: number | null;
    maximum_purchase_amount: number | null;
}

// ── API ───────────────────────────────────────────────────────────────────────

export const contractsApi = {
    /**
     * GET /contracts/available/{branch_id}
     * Returns contracts available for POS selection — already filtered to:
     *   - Active status
     *   - Valid for today's date
     *   - Applicable to this branch
     *   - User's role is allowed to apply
     * This is the primary endpoint used at checkout.
     */
    getAvailableForPos: (
        branchId: string,
        signal?: AbortSignal
    ): Promise<AvailableContract[]> =>
        get<AvailableContract[]>(`/contracts/available/${branchId}`, { signal }),

    /**
     * GET /contracts/{id}
     * Full contract detail when more info is needed (e.g. eligibility check).
     */
    getById: (id: string, signal?: AbortSignal) =>
        get<AvailableContract>(`/contracts/${id}`, { signal }),
};