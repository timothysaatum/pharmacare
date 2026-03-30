/**
 * CreatePOModal.tsx
 * ─────────────────────────────────────────────────────────────
 * Modal for creating a new purchase order.
 *
 * - Supplier dropdown with inline "Add supplier" escape hatch
 * - Dynamic line-item table (add / remove rows, drug search)
 * - Shipping cost field
 * - Expected delivery date
 * - Inline field-level validation before submit
 * - Server errors rendered below the form
 */

import { useState, useCallback } from "react";
import {
    X, Plus, Trash2, Package, AlertCircle, ChevronDown, UserPlus,
} from "lucide-react";
import type { Supplier, SupplierCreate, PurchaseOrderCreate, PurchaseOrderItemCreate } from "@/types";
import { CreateSupplierModal } from "./CreateSupplierModal";

// We reuse the drug search hook that the POS panel uses
// import { useDrugSearch } from "@/hooks/useDrugSearch";

interface Props {
    branchId: string;
    suppliers: Supplier[];
    suppliersError?: string | null;
    onRetrySuppliers?: () => void;
    onSubmit: (data: PurchaseOrderCreate) => Promise<boolean>;
    onClose: () => void;
    submitting: boolean;
    submitError: string | null;
    /** Called when user creates a new supplier from within this modal */
    onCreateSupplier: (data: SupplierCreate) => Promise<Supplier | null>;
    /** Called after a supplier is successfully created — lets parent append it to its list */
    onSupplierCreated: (supplier: Supplier) => void;
    createSupplierSubmitting: boolean;
    createSupplierError: string | null;
}

interface LineItem {
    _key: string;         // local-only stable key
    drug_id: string;
    drug_name: string;    // display only
    quantity_ordered: number;
    unit_cost: number;
}

const inputCls =
    "w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-ink bg-white " +
    "focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors";

const labelCls = "block text-xs font-semibold text-ink-muted uppercase tracking-widest mb-1.5";

let _keyCounter = 0;
const newKey = () => `item-${++_keyCounter}`;

export function CreatePOModal({
    branchId,
    suppliersError,
    onRetrySuppliers,
    suppliers,
    onSubmit,
    onClose,
    submitting,
    submitError,
    onCreateSupplier,
    onSupplierCreated,
    createSupplierSubmitting,
    createSupplierError,
}: Props) {
    const [supplierId, setSupplierId] = useState("");
    const [expectedDate, setExpectedDate] = useState("");
    const [shippingCost, setShippingCost] = useState<number>(0);
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<LineItem[]>([
        { _key: newKey(), drug_id: "", drug_name: "", quantity_ordered: 1, unit_cost: 0 },
    ]);
    const [errors, setErrors] = useState<Record<string, string>>({});

    // ── Supplier creation sub-modal ───────────────────────────
    const [showCreateSupplier, setShowCreateSupplier] = useState(false);

    // ── Line item helpers ─────────────────────────────────────

    const addRow = () =>
        setItems((prev) => [
            ...prev,
            { _key: newKey(), drug_id: "", drug_name: "", quantity_ordered: 1, unit_cost: 0 },
        ]);

    const removeRow = (key: string) =>
        setItems((prev) => prev.filter((r) => r._key !== key));

    const updateRow = (key: string, patch: Partial<LineItem>) =>
        setItems((prev) =>
            prev.map((r) => (r._key === key ? { ...r, ...patch } : r)),
        );

    // ── Validation ────────────────────────────────────────────

    const validate = (): boolean => {
        const errs: Record<string, string> = {};

        if (!supplierId) errs.supplier = "Select a supplier";
        if (items.some((i) => !i.drug_id))
            errs.items = "All items must have a drug selected";
        if (items.some((i) => i.quantity_ordered < 1))
            errs.items = "Quantity must be at least 1";
        if (items.some((i) => i.unit_cost <= 0))
            errs.items = "Unit cost must be greater than 0";

        // Duplicate drugs
        const drugIds = items.map((i) => i.drug_id).filter(Boolean);
        if (new Set(drugIds).size !== drugIds.length)
            errs.items = "Duplicate drugs detected — each drug can only appear once";

        setErrors(errs);
        return Object.keys(errs).length === 0;
    };

    // ── Submit ────────────────────────────────────────────────

    const handleSubmit = useCallback(async () => {
        if (!validate()) return;

        const payload: PurchaseOrderCreate = {
            branch_id: branchId,
            supplier_id: supplierId,
            items: items.map(
                (i): PurchaseOrderItemCreate => ({
                    drug_id: i.drug_id,
                    quantity_ordered: i.quantity_ordered,
                    unit_cost: i.unit_cost,
                }),
            ),
            shipping_cost: shippingCost,
            expected_delivery_date: expectedDate || undefined,
            notes: notes || undefined,
        };

        const ok = await onSubmit(payload);
        if (ok) onClose();
    }, [supplierId, items, shippingCost, expectedDate, notes, branchId, onSubmit, onClose]);

    // ── Totals ────────────────────────────────────────────────
    const subtotal = items.reduce(
        (s, i) => s + i.quantity_ordered * i.unit_cost,
        0,
    );
    const total = subtotal + shippingCost;

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
                        <div>
                            <h2 className="text-lg font-bold text-ink">New Purchase Order</h2>
                            <p className="text-xs text-ink-muted mt-0.5">Create a draft PO to send to your supplier</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                        {/* Server error */}
                        {submitError && (
                            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                                {submitError}
                            </div>
                        )}

                        {/* Row 1: Supplier + Expected date */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={labelCls} style={{ marginBottom: 0 }}>
                                        Supplier *
                                    </label>
                                    {/* ── Inline "Add supplier" link ── */}
                                    <button
                                        type="button"
                                        onClick={() => setShowCreateSupplier(true)}
                                        className="flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                                    >
                                        <UserPlus className="w-3 h-3" />
                                        New supplier
                                    </button>
                                </div>
                                <div className="relative">
                                    <select
                                        value={supplierId}
                                        onChange={(e) => setSupplierId(e.target.value)}
                                        className={`${inputCls} appearance-none pr-8 ${errors.supplier ? "border-red-300 bg-red-50/30" : ""}`}
                                    >
                                        <option value="">— Select supplier —</option>
                                        {suppliers.map((s) => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                                {errors.supplier && (
                                    <p className="text-xs text-red-500 mt-1">{errors.supplier}</p>
                                )}
                                {/* Empty state hint */}
                                {suppliersError ? (
                                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        Failed to load suppliers.{" "}
                                        {onRetrySuppliers && (
                                            <button type="button" onClick={onRetrySuppliers} className="underline font-semibold">
                                                Retry
                                            </button>
                                        )}
                                    </p>
                                ) : suppliers.length === 0 && (
                                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" />
                                        No suppliers yet — add one above
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className={labelCls}>Expected Delivery</label>
                                <input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                    min={new Date().toISOString().split("T")[0]}
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Line items table */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className={labelCls}>Items *</label>
                                <button
                                    onClick={addRow}
                                    type="button"
                                    className="flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Add row
                                </button>
                            </div>

                            {errors.items && (
                                <p className="text-xs text-red-500 mb-2 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5" />{errors.items}
                                </p>
                            )}

                            <div className="rounded-xl border border-slate-200 overflow-hidden">
                                {/* Table header */}
                                <div className="grid grid-cols-[1fr_100px_120px_36px] gap-2 px-3 py-2 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                    <span>Drug / SKU</span>
                                    <span>Qty</span>
                                    <span>Unit Cost (₵)</span>
                                    <span />
                                </div>

                                {/* Item rows */}
                                <div className="divide-y divide-slate-100">
                                    {items.map((row) => (
                                        <div
                                            key={row._key}
                                            className="grid grid-cols-[1fr_100px_120px_36px] gap-2 px-3 py-2 items-center"
                                        >
                                            {/* Drug ID input — in a real app this would be a
                                                drug-search combobox reusing DrugSearchPanel logic */}
                                            <input
                                                value={row.drug_id}
                                                onChange={(e) => updateRow(row._key, { drug_id: e.target.value })}
                                                placeholder="Drug ID or SKU"
                                                className="h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 w-full"
                                            />
                                            <input
                                                type="number"
                                                min={1}
                                                value={row.quantity_ordered}
                                                onChange={(e) =>
                                                    updateRow(row._key, {
                                                        quantity_ordered: Math.max(1, parseInt(e.target.value) || 1),
                                                    })
                                                }
                                                className="h-9 px-2.5 rounded-lg border border-slate-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                            />
                                            <input
                                                type="number"
                                                min={0.01}
                                                step={0.01}
                                                value={row.unit_cost || ""}
                                                onChange={(e) =>
                                                    updateRow(row._key, {
                                                        unit_cost: parseFloat(e.target.value) || 0,
                                                    })
                                                }
                                                placeholder="0.00"
                                                className="h-9 px-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                                            />
                                            <button
                                                onClick={() => removeRow(row._key)}
                                                disabled={items.length === 1}
                                                type="button"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Row 2: Shipping + Notes */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Shipping Cost (₵)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-sm text-slate-400 font-semibold">₵</span>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={shippingCost || ""}
                                        onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                        className={`${inputCls} pl-7`}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={labelCls}>Notes</label>
                                <input
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Optional notes…"
                                    className={inputCls}
                                />
                            </div>
                        </div>

                        {/* Totals */}
                        <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-1.5">
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Subtotal ({items.length} line{items.length !== 1 ? "s" : ""})</span>
                                <span className="font-medium">₵{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-slate-500">
                                <span>Shipping</span>
                                <span className="font-medium">₵{shippingCost.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-bold text-ink border-t border-slate-200 pt-2">
                                <span>Total</span>
                                <span>₵{total.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
                        <button
                            onClick={onClose}
                            type="button"
                            className="px-4 py-2.5 text-sm font-medium text-ink-secondary border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            type="button"
                            className="px-5 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                        >
                            {submitting ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                    </svg>
                                    Creating…
                                </>
                            ) : (
                                <>
                                    <Package className="w-4 h-4" />
                                    Create Draft PO
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* ── Create Supplier sub-modal (z-[60], renders above this modal) ── */}
            {showCreateSupplier && (
                <CreateSupplierModal
                    onSubmit={onCreateSupplier}
                    onCreated={(newSupplier) => {
                        onSupplierCreated(newSupplier);
                        // Auto-select the just-created supplier
                        setSupplierId(newSupplier.id);
                        setShowCreateSupplier(false);
                    }}
                    onClose={() => setShowCreateSupplier(false)}
                    submitting={createSupplierSubmitting}
                    submitError={createSupplierError}
                />
            )}
        </>
    );
}