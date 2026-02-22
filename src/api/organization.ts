import { post, get, patch } from "./client";
import type {
    OnboardingRequest,
    OnboardingResponse,
    Organization,
    OrganizationStats,
    OrganizationUpdate,
    PaginatedResponse,
    BranchCreate,
} from "@/types";
import type { OnboardingValues } from "@/lib/validators";

/**
 * Maps form values → exact OnboardingRequest API payload.
 *
 * Key fixes:
 * - BranchAddress.country is `string` (not optional) in Pydantic,
 *   so we always provide it (default "Ghana").
 * - confirm_password is stripped before sending.
 * - Prefixed form fields (org_phone, admin_email, etc.) mapped back
 *   to the flat API field names.
 */
export function buildOnboardingPayload(values: OnboardingValues): OnboardingRequest {
    const clean = (v?: string) => (v === "" ? undefined : v);

    // Build branches array — must satisfy BranchCreate exactly
    let branches: BranchCreate[] | undefined;
    if (values.branches && values.branches.length > 0) {
        branches = values.branches.map((b) => ({
            name: b.name,
            phone: clean(b.branch_phone),
            email: clean(b.branch_email),
            address: {
                street: b.address?.street,
                city: b.address?.city,
                state: b.address?.state,
                zip_code: b.address?.zip_code,
                // country has a .default("Ghana") in Zod so it is always string
                country: b.address?.country ?? "Ghana",
            },
        }));
    }

    return {
        name: values.name,
        type: values.type,
        license_number: clean(values.license_number),
        tax_id: clean(values.tax_id),
        phone: clean(values.org_phone),
        email: clean(values.org_email),
        subscription_tier: values.subscription_tier,
        currency: values.currency,
        timezone: values.timezone,
        address: values.address
            ? {
                street: values.address.street,
                city: values.address.city,
                state: values.address.state,
                zip: values.address.zip_code,
                country: values.address.country ?? "Ghana",
            }
            : undefined,
        admin: {
            username: values.username,
            email: values.admin_email,
            full_name: values.full_name,
            password: values.password,
            // confirm_password intentionally omitted
            phone: clean(values.admin_phone),
            employee_id: clean(values.employee_id),
            role: "admin" as const,
        },
        branches,
    };
}

export const organizationApi = {
    onboard: (data: OnboardingRequest): Promise<OnboardingResponse> =>
        post<OnboardingResponse>("/organizations/onboard", data),

    getById: (id: string): Promise<Organization> =>
        get<Organization>(`/organizations/${id}`),

    update: (id: string, data: OrganizationUpdate): Promise<Organization> =>
        patch<Organization>(`/organizations/${id}`, data),

    getStats: (id: string): Promise<OrganizationStats> =>
        get<OrganizationStats>(`/organizations/${id}/stats`),

    list: (
        page = 1,
        pageSize = 50,
        filters?: { search?: string; is_active?: boolean; subscription_tier?: string }
    ): Promise<PaginatedResponse<Organization>> => {
        const params = new URLSearchParams({
            page: String(page),
            page_size: String(pageSize),
        });
        if (filters?.search) params.set("search", filters.search);
        if (filters?.is_active !== undefined)
            params.set("is_active", String(filters.is_active));
        if (filters?.subscription_tier)
            params.set("subscription_tier", filters.subscription_tier);
        return get<PaginatedResponse<Organization>>(
            `/organizations?${params.toString()}`
        );
    },

    activate: (id: string): Promise<Organization> =>
        post<Organization>(`/organizations/${id}/activate`),

    deactivate: (id: string, reason?: string): Promise<Organization> =>
        post<Organization>(`/organizations/${id}/deactivate`, { reason }),

    updateSubscription: (
        id: string,
        tier: "basic" | "professional" | "enterprise",
        extendMonths: number
    ): Promise<Organization> =>
        post<Organization>(`/organizations/${id}/subscription`, {
            subscription_tier: tier,
            extend_months: extendMonths,
        }),
};