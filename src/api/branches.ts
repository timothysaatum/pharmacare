import { get } from "./client";
import type { BranchListItem, Branch } from "@/types";

export const branchApi = {
    /**
     * GET /branches/my-branches
     * Returns List[BranchListItem] — branches the current user is assigned to.
     * Used post-login to determine single vs multi-branch flow.
     */
    listMine(): Promise<BranchListItem[]> {
        return get<BranchListItem[]>("/branches/my-branches");
    },

    /**
     * GET /branches/{id}
     * Returns full BranchResponse with operating_hours, sync fields etc.
     */
    getById(id: string): Promise<Branch> {
        return get<Branch>(`/branches/${id}`);
    },
};