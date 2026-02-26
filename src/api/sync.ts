/**
 * api/sync.ts
 * ===========
 * HTTP wrappers for the two sync endpoints.
 * The heavy logic lives in syncEngine.ts — this is just the network layer.
 */

import { post } from "@/api/client";
import type { PullRequest, PullResponse, PushRequest, PushResponse } from "@/lib/syncEngine";

export const syncApi = {
    /** Pull delta from server. */
    pull: (req: PullRequest): Promise<PullResponse> =>
        post<PullResponse>("/sync/pull", req),

    /** Push pending branch records to server. */
    push: (req: PushRequest): Promise<PushResponse> =>
        post<PushResponse>("/sync/push", req),

    /** Fetch server timestamp (used to calibrate clock on first sync). */
    status: (): Promise<{ server_time: string; organization_id: string }> =>
        post("/sync/status"),
};