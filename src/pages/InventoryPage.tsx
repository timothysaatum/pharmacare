import { useState, useEffect, useCallback, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import {
    Search, Package, AlertTriangle, Clock, RefreshCw,
    ChevronLeft, ChevronRight, X, TrendingDown, Plus, BarChart3,
} from "lucide-react";
import { inventoryApi } from "@/api/inventory";
import { drugApi } from "@/api/drugs";
import { useAuthStore } from "@/stores/authStore";
import { useDebounce } from "@/hooks/useDebounce";
import { AddBatchForm } from "@/components/inventory/AddBatchForm";
import { parseApiError } from "@/api/client";
import { appEvents, useAppEvent } from "@/lib/events";
import type {
    BranchInventoryWithDetails,
    LowStockItem,
    ExpiringBatchItem,
    InventoryValuationResponse,
    Drug,
    DrugBatch,
} from "@/types";

type ActiveView = "stock" | "low_stock" | "expiring" | "valuation";

export default function InventoryPage() {
    const { activeBranchId } = useAuthStore();
    const [activeView, setActiveView] = useState<ActiveView>("stock");

    // ── Stock view ────────────────────────────────────────────
    const [inventory, setInventory] = useState<BranchInventoryWithDetails[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchInput, setSearchInput] = useState("");
    const debouncedSearch = useDebounce(searchInput, 300);
    const [lowStockOnly, setLowStockOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 25;

    // ── Reports ───────────────────────────────────────────────
    const [lowStockItems, setLowStockItems] = useState<LowStockItem[]>([]);
    const [lowStockCounts, setLowStockCounts] = useState({ out: 0, low: 0 });
    const [expiringItems, setExpiringItems] = useState<ExpiringBatchItem[]>([]);
    const [expiringCount, setExpiringCount] = useState(0);

    // ── Valuation view ────────────────────────────────────────
    const [valuation, setValuation] = useState<InventoryValuationResponse | null>(null);
    const [valuationLoading, setValuationLoading] = useState(false);
    const [valuationError, setValuationError] = useState<string | null>(null);
    // Lazy-load: only fetch when the tab is first opened; stale-invalidate on batch add.
    const valuationFetchedRef = useRef(false);
    // Client-side pagination for valuation (the endpoint returns all items at once)
    const [valuationPage, setValuationPage] = useState(1);
    const VALUATION_PAGE_SIZE = 25;

    // ── Add batch modal ───────────────────────────────────────
    const [addBatchDrug, setAddBatchDrug] = useState<Drug | null>(null);
    const [addBatchError, setAddBatchError] = useState<string | null>(null);
    // FIX: track loading per drug_id so only the clicked row shows a spinner;
    // every other row's "Add" button stays enabled.
    const [addBatchLoadingId, setAddBatchLoadingId] = useState<string | null>(null);

    // AbortController ref for inventory fetch cancellation on unmount / stale
    const abortRef = useRef<AbortController | null>(null);

    // ── Fetch inventory ───────────────────────────────────────
    // FIX: drugMap completely removed.
    // drug_reorder_level is now joined by the backend in BranchInventoryWithDetails,
    // eliminating the N+1 drugApi.getById() calls that triggered on every page
    // change.  Previously those calls were inside a useCallback whose deps did
    // NOT include drugMap, meaning the stale closure would always see an empty
    // Map and re-fetch every drug regardless of what was already cached.
    const fetchInventory = useCallback(async () => {
        if (!activeBranchId) return;

        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setIsLoading(true);
        setError(null);

        try {
            const result = await inventoryApi.getBranchInventory(
                activeBranchId,
                {
                    page,
                    page_size: PAGE_SIZE,
                    search: debouncedSearch || undefined,
                    low_stock_only: lowStockOnly || undefined,
                },
                controller.signal
            );

            if (!controller.signal.aborted) {
                setInventory(result.items);
                setTotalPages(result.total_pages);
                setTotal(result.total);
            }
        } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") return;
            if (!controller.signal.aborted) setError(parseApiError(err));
        } finally {
            if (!controller.signal.aborted) setIsLoading(false);
        }
    }, [activeBranchId, page, debouncedSearch, lowStockOnly]);

    const fetchLowStock = useCallback(async () => {
        if (!activeBranchId) return;
        try {
            const result = await inventoryApi.getLowStock(activeBranchId);
            setLowStockItems(result.items);
            setLowStockCounts({ out: result.out_of_stock_count, low: result.low_stock_count });
        } catch {
            // Non-critical — don't block the main view
        }
    }, [activeBranchId]);

    const fetchExpiring = useCallback(async () => {
        if (!activeBranchId) return;
        try {
            const result = await inventoryApi.getExpiring(activeBranchId, 90);
            setExpiringItems(result.items);
            setExpiringCount(result.total_items);
        } catch {
            // Non-critical
        }
    }, [activeBranchId]);

    const fetchValuation = useCallback(async () => {
        if (!activeBranchId) return;
        setValuationLoading(true);
        setValuationError(null);
        try {
            const result = await inventoryApi.getValuation(activeBranchId);
            setValuation(result);
            valuationFetchedRef.current = true;
            setValuationPage(1); // reset to first page on fresh fetch
        } catch (err) {
            setValuationError(parseApiError(err));
        } finally {
            setValuationLoading(false);
        }
    }, [activeBranchId]);

    useEffect(() => {
        fetchInventory();
        return () => abortRef.current?.abort();
    }, [fetchInventory]);

    useEffect(() => {
        fetchLowStock();
        fetchExpiring();
    }, [fetchLowStock, fetchExpiring]);

    // Lazy-load valuation only on first tab open; re-fetch when explicitly refreshed
    useEffect(() => {
        if (activeView === "valuation" && !valuationFetchedRef.current) {
            fetchValuation();
        }
    }, [activeView, fetchValuation]);

    // FIX: fetchExpiring now subscribed to inventory:changed so batches with
    // near-expiry dates appear in the "Expiring Soon" tab immediately after
    // stock is added — no manual refresh needed.
    useAppEvent("inventory:changed", fetchInventory);
    useAppEvent("inventory:changed", fetchLowStock);
    useAppEvent("inventory:changed", fetchExpiring);

    // Reset to page 1 when search or filter changes
    const prevFilters = useRef({ debouncedSearch, lowStockOnly });
    useEffect(() => {
        const prev = prevFilters.current;
        if (prev.debouncedSearch !== debouncedSearch || prev.lowStockOnly !== lowStockOnly) {
            setPage(1);
            prevFilters.current = { debouncedSearch, lowStockOnly };
        }
    }, [debouncedSearch, lowStockOnly]);

    // ── Add stock for an inventory row ────────────────────────
    const handleAddStockForItem = async (item: BranchInventoryWithDetails) => {
        setAddBatchError(null);
        setAddBatchLoadingId(item.drug_id);
        try {
            const drug = await drugApi.getById(item.drug_id);
            setAddBatchDrug(drug);
        } catch (err) {
            setAddBatchError(`Could not load drug details: ${parseApiError(err)}`);
        } finally {
            setAddBatchLoadingId(null);
        }
    };

    const handleBatchAdded = (_batch: DrugBatch) => {
        setAddBatchDrug(null);
        // Stale-invalidate valuation so the next tab open re-fetches fresh data
        valuationFetchedRef.current = false;
        appEvents.emit("inventory:changed");
    };

    // FIX: now uses item.drug_reorder_level (joined from the backend) instead
    // of a drugMap lookup that fell back to a hardcoded 10.
    const stockStatusBadge = (item: BranchInventoryWithDetails) => {
        const avail = item.available_quantity ?? (item.quantity - item.reserved_quantity);
        if (avail === 0)
            return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">Out of stock</span>;
        if (avail <= item.drug_reorder_level)
            return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">Low</span>;
        return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-600">In stock</span>;
    };

    const VIEWS: { id: ActiveView; label: string; icon: React.ElementType; badge?: number }[] = [
        { id: "stock", label: "All Stock", icon: Package },
        { id: "low_stock", label: "Low Stock", icon: TrendingDown, badge: lowStockCounts.out + lowStockCounts.low },
        { id: "expiring", label: "Expiring Soon", icon: Clock, badge: expiringCount },
        { id: "valuation", label: "Valuation", icon: BarChart3 },
    ];

    return (
        <div className="flex flex-col h-full bg-surface">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-200 bg-white">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-bold text-ink">Inventory</h1>
                        <p className="text-sm text-ink-muted mt-0.5">Stock levels and batch tracking for this branch</p>
                    </div>
                    <button
                        onClick={() => {
                            fetchInventory();
                            fetchLowStock();
                            fetchExpiring();
                            if (activeView === "valuation") fetchValuation();
                        }}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors"
                        title="Refresh">
                        <RefreshCw className={`w-4 h-4 ${isLoading || valuationLoading ? "animate-spin" : ""}`} />
                    </button>
                </div>

                {/* Alert summary */}
                {(lowStockCounts.out > 0 || lowStockCounts.low > 0 || expiringCount > 0) && (
                    <div className="flex gap-2 mt-4 flex-wrap">
                        {lowStockCounts.out > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-100">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                <span className="text-xs font-semibold text-red-700">{lowStockCounts.out} out of stock</span>
                            </div>
                        )}
                        {lowStockCounts.low > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100">
                                <TrendingDown className="w-4 h-4 text-amber-500" />
                                <span className="text-xs font-semibold text-amber-700">{lowStockCounts.low} low stock</span>
                            </div>
                        )}
                        {expiringCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 border border-orange-100">
                                <Clock className="w-4 h-4 text-orange-500" />
                                <span className="text-xs font-semibold text-orange-700">{expiringCount} expiring within 90 days</span>
                            </div>
                        )}
                    </div>
                )}

                {/* View tabs */}
                <div className="flex gap-1 mt-4 border-b border-slate-100 -mb-5">
                    {VIEWS.map((v) => {
                        const Icon = v.icon;
                        const active = activeView === v.id;
                        return (
                            <button key={v.id} onClick={() => setActiveView(v.id)}
                                className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${active ? "border-brand-600 text-brand-600" : "border-transparent text-ink-muted hover:text-ink"}`}>
                                <Icon className="w-4 h-4" />
                                {v.label}
                                {v.badge && v.badge > 0 ? (
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${active ? "bg-brand-100 text-brand-700" : "bg-slate-100 text-ink-muted"}`}>
                                        {v.badge}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ── ALL STOCK ── */}
            {activeView === "stock" && (
                <>
                    <div className="px-6 py-3 border-b border-slate-100 bg-white flex gap-3 items-center">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-2.5 w-4 h-4 text-ink-muted" />
                            <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
                                placeholder="Search drug name or SKU…"
                                className="w-full pl-9 pr-9 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500" />
                            {searchInput && (
                                <button onClick={() => setSearchInput("")} className="absolute right-2.5 top-2.5 text-ink-muted hover:text-ink">
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-ink-secondary cursor-pointer">
                            <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300 text-brand-600" />
                            Low stock only
                        </label>
                    </div>

                    {addBatchError && (
                        <div className="mx-6 mt-3 rounded-xl bg-red-50 border border-red-100 p-3 flex gap-2 items-center">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600">{addBatchError}</p>
                            <button onClick={() => setAddBatchError(null)} className="ml-auto text-ink-muted hover:text-ink">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mx-6 mt-3 rounded-xl bg-red-50 border border-red-100 p-3 flex gap-2 items-center">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                            <p className="text-sm text-red-600">{error}</p>
                            <button onClick={() => setError(null)} className="ml-auto text-ink-muted hover:text-ink">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                    <div className="flex-1 overflow-auto">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                            </div>
                        ) : inventory.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-muted">
                                <Package className="w-10 h-10 opacity-30" />
                                <p className="text-sm">No inventory items found</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="text-left px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Drug</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Available</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Reserved</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Total</th>
                                        <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Location</th>
                                        <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Status</th>
                                        <th className="text-right px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Value</th>
                                        <th className="px-6 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {inventory.map((item) => {
                                        const available = item.available_quantity ?? (item.quantity - item.reserved_quantity);
                                        const value = available * Number(item.drug_unit_price);
                                        const isThisRowLoading = addBatchLoadingId === item.drug_id;
                                        return (
                                            <tr key={item.id} className="hover:bg-slate-50/70 transition-colors group">
                                                <td className="px-6 py-3">
                                                    <div className="font-medium text-ink">{item.drug_name}</div>
                                                    {item.drug_sku && (
                                                        <div className="text-xs font-mono text-ink-muted bg-slate-100 px-1 rounded mt-0.5 inline-block">
                                                            {item.drug_sku}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`font-bold ${available === 0 ? "text-red-600" : available <= item.drug_reorder_level ? "text-amber-600" : "text-ink"}`}>
                                                        {available.toLocaleString()}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center text-ink-secondary">{item.reserved_quantity}</td>
                                                <td className="px-4 py-3 text-center text-ink-secondary">{item.quantity.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-ink-muted text-xs">{item.location ?? "—"}</td>
                                                <td className="px-4 py-3 text-center">{stockStatusBadge(item)}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className="font-medium text-ink">₵{value.toFixed(2)}</span>
                                                </td>
                                                <td className="px-6 py-3">
                                                    {/* FIX: only this row's button is disabled while its drug details load */}
                                                    <button
                                                        onClick={() => handleAddStockForItem(item)}
                                                        disabled={isThisRowLoading}
                                                        className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-lg transition-all disabled:opacity-40">
                                                        {isThisRowLoading
                                                            ? <RefreshCw className="w-3 h-3 animate-spin" />
                                                            : <Plus className="w-3 h-3" />
                                                        }
                                                        Add
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {totalPages > 1 && (
                        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                            <p className="text-xs text-ink-muted">{total.toLocaleString()} items · page {page} of {totalPages}</p>
                            <div className="flex gap-1">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted disabled:opacity-40">
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted disabled:opacity-40">
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ── LOW STOCK ── */}
            {activeView === "low_stock" && (
                <div className="flex-1 overflow-auto">
                    {lowStockItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-muted">
                            <TrendingDown className="w-10 h-10 opacity-30" />
                            <p className="text-sm text-green-600 font-medium">All stock levels are healthy ✓</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Drug</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Current Stock</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Reorder Level</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Suggested Order</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {lowStockItems.map((item) => (
                                    <tr key={item.drug_id} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-6 py-3">
                                            <div className="font-medium text-ink">{item.drug_name}</div>
                                            {item.sku && <div className="text-xs font-mono text-ink-muted mt-0.5">{item.sku}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-bold text-lg ${item.quantity === 0 ? "text-red-600" : "text-amber-600"}`}>
                                                {item.quantity}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center text-ink-secondary">{item.reorder_level}</td>
                                        <td className="px-4 py-3 text-center text-ink-secondary">{item.recommended_order_quantity}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${item.status === "out_of_stock" ? "bg-red-50 text-red-600" : "bg-amber-50 text-amber-600"}`}>
                                                {item.status === "out_of_stock" ? "Out of stock" : "Low stock"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── EXPIRING SOON ── */}
            {activeView === "expiring" && (
                <div className="flex-1 overflow-auto">
                    {expiringItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-64 gap-3 text-ink-muted">
                            <Clock className="w-10 h-10 opacity-30" />
                            <p className="text-sm text-green-600 font-medium">No batches expiring within 90 days ✓</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                <tr>
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Drug</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Batch</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Qty Remaining</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Expiry Date</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Days Left</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Value at Risk</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                                {expiringItems.map((item) => (
                                    <tr key={item.batch_id}
                                        className={`hover:bg-slate-50/70 transition-colors ${item.days_until_expiry <= 30 ? "bg-red-50/30" : ""}`}>
                                        <td className="px-6 py-3 font-medium text-ink">{item.drug_name}</td>
                                        <td className="px-4 py-3">
                                            <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">{item.batch_number}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center font-semibold text-ink">{item.remaining_quantity}</td>
                                        <td className="px-4 py-3 text-center text-ink-secondary">
                                            {new Date(item.expiry_date).toLocaleDateString("en-GH", {
                                                day: "numeric", month: "short", year: "numeric",
                                            })}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className={`font-bold text-sm ${item.days_until_expiry <= 30 ? "text-red-600"
                                                : item.days_until_expiry <= 60 ? "text-amber-600"
                                                    : "text-green-600"
                                                }`}>
                                                {item.days_until_expiry}d
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-right font-medium text-ink">
                                            ₵{Number(item.selling_value ?? item.cost_value ?? 0).toFixed(2)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* ── VALUATION ── */}
            {activeView === "valuation" && (
                <div className="flex-1 overflow-auto">
                    {valuationLoading ? (
                        <div className="flex items-center justify-center h-64">
                            <RefreshCw className="w-6 h-6 text-brand-500 animate-spin" />
                        </div>
                    ) : valuationError ? (
                        <div className="mx-6 mt-4 rounded-xl bg-red-50 border border-red-100 p-4 flex gap-2 items-start">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-red-700">Could not load valuation report</p>
                                <p className="text-xs text-red-600 mt-0.5">{valuationError}</p>
                            </div>
                            <button onClick={fetchValuation}
                                className="ml-auto text-xs font-medium text-red-600 hover:text-red-700 underline underline-offset-2">
                                Retry
                            </button>
                        </div>
                    ) : valuation ? (() => {
                        const valTotalPages = Math.max(1, Math.ceil(valuation.items.length / VALUATION_PAGE_SIZE));
                        const valOffset = (valuationPage - 1) * VALUATION_PAGE_SIZE;
                        const valPageItems = valuation.items.slice(valOffset, valOffset + VALUATION_PAGE_SIZE);
                        return (
                            <>
                                {/* Summary cards */}
                                <div className="px-6 pt-5 pb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {[
                                        { label: "Total Cost Value", value: valuation.total_cost_value, color: "text-ink" },
                                        { label: "Total Selling Value", value: valuation.total_selling_value, color: "text-brand-600" },
                                        { label: "Potential Profit", value: valuation.total_potential_profit, color: "text-emerald-600" },
                                    ].map(({ label, value, color }) => (
                                        <div key={label} className="rounded-xl bg-white border border-slate-100 p-4">
                                            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">{label}</p>
                                            <p className={`text-xl font-bold mt-1 ${color}`}>
                                                ₵{Number(value).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                                            </p>
                                        </div>
                                    ))}
                                    <div className="rounded-xl bg-white border border-slate-100 p-4">
                                        <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Profit Margin</p>
                                        <p className="text-xl font-bold text-ink mt-1">
                                            {Number(valuation.profit_margin_percentage).toFixed(1)}%
                                        </p>
                                    </div>
                                </div>

                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                        <tr>
                                            <th className="text-left px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Drug</th>
                                            <th className="text-center px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Qty</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Cost / Unit</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Sell / Unit</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Total Cost</th>
                                            <th className="text-right px-4 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Total Sell</th>
                                            <th className="text-right px-6 py-3 text-xs font-semibold text-ink-muted uppercase tracking-wide">Profit</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 bg-white">
                                        {valPageItems.map((item) => (
                                            <tr key={item.drug_id} className="hover:bg-slate-50/70 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="font-medium text-ink">{item.drug_name}</div>
                                                    {item.sku && <div className="text-xs font-mono text-ink-muted mt-0.5">{item.sku}</div>}
                                                </td>
                                                <td className="px-4 py-3 text-center text-ink-secondary">{item.quantity.toLocaleString()}</td>
                                                <td className="px-4 py-3 text-right text-ink-secondary">₵{Number(item.cost_price).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-ink-secondary">₵{Number(item.selling_price).toFixed(2)}</td>
                                                <td className="px-4 py-3 text-right text-ink">₵{Number(item.total_cost_value).toLocaleString("en-GH", { minimumFractionDigits: 2 })}</td>
                                                <td className="px-4 py-3 text-right font-medium text-brand-600">₵{Number(item.total_selling_value).toLocaleString("en-GH", { minimumFractionDigits: 2 })}</td>
                                                <td className="px-6 py-3 text-right">
                                                    <span className={`font-semibold ${Number(item.potential_profit) >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                                        ₵{Number(item.potential_profit).toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
                                    <p className="text-xs text-ink-muted">
                                        {valuation.total_items} drugs · {valuation.total_quantity.toLocaleString()} total units ·
                                        as of {new Date(valuation.valuation_date).toLocaleString("en-GH")}
                                        {valTotalPages > 1 && ` · page ${valuationPage} of ${valTotalPages}`}
                                    </p>
                                    {valTotalPages > 1 && (
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setValuationPage((p) => Math.max(1, p - 1))}
                                                disabled={valuationPage === 1}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted disabled:opacity-40">
                                                <ChevronLeft className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setValuationPage((p) => Math.min(valTotalPages, p + 1))}
                                                disabled={valuationPage === valTotalPages}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted disabled:opacity-40">
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        );
                    })() : null}
                </div>
            )}

            {/* Add batch modal */}
            <AnimatePresence>
                {addBatchDrug && activeBranchId && (
                    <AddBatchForm
                        drug={addBatchDrug}
                        branchId={activeBranchId}
                        onSuccess={handleBatchAdded}
                        onCancel={() => setAddBatchDrug(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}