import { get } from "./client";
import type { BranchListItem, Branch } from "@/types";

export const branchApi = {
    /**
     * GET /branches/my-branches
     * Returns List[BranchListItem] — branches the current user is assigned to.
     * Used post-login to determine single vs multi-branch flow.
     */
    listMine(signal?: AbortSignal): Promise<BranchListItem[]> {
        return get<BranchListItem[]>("/branches/my-branches", { signal });
    },

    /**
     * GET /branches/{id}
     * Returns the full Branch response including operating_hours and sync fields.
     */
    getById(id: string, signal?: AbortSignal): Promise<Branch> {
        return get<Branch>(`/branches/${id}`, { signal });
    },
};