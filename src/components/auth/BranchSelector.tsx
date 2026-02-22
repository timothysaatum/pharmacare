import { useState } from "react";
import { motion } from "framer-motion";
import { MapPin, ChevronRight, Building2, CheckCircle2 } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui";
import type { UserResponse, BranchListItem } from "@/types";

interface BranchSelectorProps {
    user: UserResponse;
    branches: BranchListItem[];
    onSelect: (branchId: string) => void;
}

export function BranchSelector({ user, branches, onSelect }: BranchSelectorProps) {
    const { setActiveBranch } = useAuthStore();
    const [selected, setSelected] = useState<string | null>(null);
    const [confirming, setConfirming] = useState(false);

    // Filter to only branches the user is assigned to
    const assignedBranches = branches.filter((b) =>
        user.assigned_branches?.map(String).includes(String(b.id))
    );

    const handleConfirm = async () => {
        if (!selected) return;
        setConfirming(true);
        setActiveBranch(selected);
        onSelect(selected);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-5"
        >
            <div>
                <h2 className="font-display text-2xl font-bold text-ink tracking-tight">
                    Select a branch
                </h2>
                <p className="text-sm text-ink-secondary mt-1">
                    Welcome back, <span className="font-semibold text-ink">{user.full_name}</span>.
                    Choose which branch to work in today.
                </p>
            </div>

            <div className="space-y-2">
                {assignedBranches.length === 0 ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-4 text-sm text-amber-700">
                        You have no branches assigned to your account. Contact your administrator.
                    </div>
                ) : (
                    assignedBranches.map((branch) => {
                        const isSelected = selected === String(branch.id);
                        return (
                            <button
                                key={branch.id}
                                type="button"
                                onClick={() => setSelected(String(branch.id))}
                                className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-150 text-left ${isSelected
                                    ? "border-brand-500 bg-brand-50"
                                    : "border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/30"
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isSelected ? "bg-brand-600" : "bg-slate-100"
                                            }`}
                                    >
                                        <MapPin
                                            className={`w-5 h-5 ${isSelected ? "text-white" : "text-ink-muted"}`}
                                        />
                                    </div>
                                    <div>
                                        <p
                                            className={`text-sm font-semibold ${isSelected ? "text-brand-700" : "text-ink"
                                                }`}
                                        >
                                            {branch.name}
                                        </p>
                                        {branch.phone && (
                                            <p className="text-xs text-ink-muted mt-0.5">
                                                {branch.phone}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {isSelected ? (
                                    <CheckCircle2 className="w-5 h-5 text-brand-600 flex-shrink-0" />
                                ) : (
                                    <ChevronRight className="w-4 h-4 text-ink-muted flex-shrink-0" />
                                )}
                            </button>
                        );
                    })
                )}
            </div>

            <Button
                size="lg"
                className="w-full"
                disabled={!selected || confirming}
                loading={confirming}
                onClick={handleConfirm}
            >
                <Building2 className="w-4 h-4" />
                {confirming ? "Opening branch…" : "Enter branch"}
            </Button>
        </motion.div>
    );
}