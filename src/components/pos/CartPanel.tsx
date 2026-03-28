/**
 * =============
 * Right panel of the POS. Shows cart items, contract selector,
 * customer input, totals, and the checkout button.
 */

import { useEffect, useRef } from "react";
import {
    Trash2, Plus, Minus, ShieldAlert, ChevronDown,
    User, FileText, AlertCircle, ShoppingCart,
} from "lucide-react";
// import type { CartItem, CartTotals, CartValidationError, PaymentMethod } from "./useCart";
import type { AvailableContract } from "@/api/contracts";
import { PaymentMethod } from "@/types";
import { CartItem, CartTotals, CartValidationError } from "@/hooks/useCart";

const CONTRACT_TYPE_COLORS: Record<string, string> = {
    standard: "bg-slate-100 text-slate-700",
    insurance: "bg-blue-50 text-blue-700",
    corporate: "bg-purple-50 text-purple-700",
    staff: "bg-green-50 text-green-700",
    senior_citizen: "bg-amber-50 text-amber-700",
    wholesale: "bg-orange-50 text-orange-700",
    promotional: "bg-pink-50 text-pink-700",
};

const PAYMENT_METHODS: Array<{ value: PaymentMethod; label: string }> = [
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "insurance", label: "Insurance" },
    { value: "credit", label: "Credit" },
    { value: "split", label: "Split" },
];

interface CartPanelProps {
    items: CartItem[];
    contract: AvailableContract | null;
    contracts: AvailableContract[];
    contractsLoading: boolean;
    customerName: string;
    customerId: string | null;
    paymentMethod: PaymentMethod;
    amountPaid: number;
    prescriptionId: string | null;
    insuranceClaimNumber: string;
    insurancePreAuthNumber: string;
    insuranceVerified: boolean;
    notes: string;
    totals: CartTotals;
    validationErrors: CartValidationError[];
    isSubmitting: boolean;

    onSetQuantity: (drugId: string, qty: number) => void;
    onRemoveItem: (drugId: string) => void;
    onSetPrescriptionVerified: (drugId: string, verified: boolean) => void;
    onSetContract: (contract: AvailableContract | null) => void;
    onSetCustomerName: (name: string) => void;
    onSetPaymentMethod: (method: PaymentMethod) => void;
    onSetAmountPaid: (amount: number) => void;
    onSetPrescriptionId: (id: string | null) => void;
    onSetInsuranceClaimNumber: (n: string) => void;
    onSetInsurancePreAuthNumber: (n: string) => void;
    onSetInsuranceVerified: (v: boolean) => void;
    onSetNotes: (n: string) => void;
    onCheckout: () => void;
    onClearCart: () => void;
}

const inputCls =
    "w-full h-9 px-3 rounded-xl border border-slate-200 text-sm text-ink bg-white " +
    "focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500";
const labelCls = "block text-xs font-semibold text-ink-muted uppercase tracking-wide mb-1";

export function CartPanel({
    items, contract, contracts, contractsLoading,
    customerName, paymentMethod, amountPaid,
    prescriptionId, insuranceClaimNumber, insurancePreAuthNumber,
    insuranceVerified, notes, totals, validationErrors,
    isSubmitting, onSetQuantity, onRemoveItem, onSetPrescriptionVerified,
    onSetContract, onSetCustomerName, onSetPaymentMethod, onSetAmountPaid,
    onSetPrescriptionId, onSetInsuranceClaimNumber, onSetInsurancePreAuthNumber,
    onSetInsuranceVerified, onSetNotes, onCheckout, onClearCart,
}: CartPanelProps) {
    // Auto-select default contract when contracts load
    const autoSelectedRef = useRef(false);
    useEffect(() => {
        if (!autoSelectedRef.current && contracts.length > 0 && !contract) {
            const def = contracts.find((c) => c.is_default) ?? contracts[0];
            onSetContract(def);
            autoSelectedRef.current = true;
        }
    }, [contracts, contract, onSetContract]);

    const hasRxItems = items.some((i) => i.requiresPrescription);
    const isInsurance = paymentMethod === "insurance" || contract?.type === "insurance";
    const fieldError = (field: string) =>
        validationErrors.find((e) => e.field === field)?.message;

    return (
        <div className="flex flex-col h-full">
            {/* ── Cart items ── */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 text-ink-muted">
                        <ShoppingCart className="w-8 h-8 opacity-25" />
                        <p className="text-xs">Cart is empty — add drugs from the left</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <div
                            key={item.drug.id}
                            className="rounded-xl border border-slate-100 bg-white p-3 space-y-2"
                        >
                            <div className="flex items-start gap-2">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-ink truncate">
                                        {item.drug.name}
                                    </p>
                                    <p className="text-xs text-ink-muted">
                                        ₵{item.drug.unit_price.toFixed(2)} each
                                        {item.drug.strength && ` · ${item.drug.strength}`}
                                    </p>
                                </div>
                                {/* Quantity stepper */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        onClick={() => onSetQuantity(item.drug.id, item.quantity - 1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted hover:text-ink hover:bg-slate-50 transition-colors"
                                    >
                                        <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={1000}
                                        value={item.quantity}
                                        onChange={(e) =>
                                            onSetQuantity(item.drug.id, parseInt(e.target.value) || 1)
                                        }
                                        className="w-12 h-7 text-center text-sm font-semibold border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500"
                                    />
                                    <button
                                        onClick={() => onSetQuantity(item.drug.id, item.quantity + 1)}
                                        className="w-7 h-7 flex items-center justify-center rounded-lg border border-slate-200 text-ink-muted hover:text-ink hover:bg-slate-50 transition-colors"
                                    >
                                        <Plus className="w-3 h-3" />
                                    </button>
                                </div>
                                {/* Line total */}
                                <div className="text-right flex-shrink-0 w-16">
                                    <p className="text-sm font-bold text-ink">
                                        ₵{(item.drug.unit_price * item.quantity).toFixed(2)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => onRemoveItem(item.drug.id)}
                                    className="w-7 h-7 flex items-center justify-center text-ink-muted hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>

                            {/* Prescription verification */}
                            {item.requiresPrescription && (
                                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs ${
                                    item.prescriptionVerified
                                        ? "bg-green-50 text-green-700"
                                        : "bg-purple-50 text-purple-700"
                                }`}>
                                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                                    <span className="flex-1">Prescription drug</span>
                                    <label className="flex items-center gap-1.5 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={item.prescriptionVerified}
                                            onChange={(e) =>
                                                onSetPrescriptionVerified(item.drug.id, e.target.checked)
                                            }
                                            className="w-3.5 h-3.5 rounded"
                                        />
                                        <span className="font-semibold">Verified</span>
                                    </label>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* ── Checkout form ── */}
            <div className="border-t border-slate-100 bg-slate-50/50 px-4 pt-3 pb-4 space-y-3 flex-shrink-0">

                {/* Contract selector */}
                <div>
                    <label className={labelCls}>Price Contract</label>
                    <div className="relative">
                        <select
                            value={contract?.id ?? ""}
                            onChange={(e) => {
                                const c = contracts.find((x) => x.id === e.target.value) ?? null;
                                onSetContract(c);
                            }}
                            disabled={contractsLoading}
                            className={`${inputCls} appearance-none pr-8 ${fieldError("contract") ? "border-red-300" : ""}`}
                        >
                            {contractsLoading ? (
                                <option>Loading contracts…</option>
                            ) : (
                                <>
                                    <option value="">— Select contract —</option>
                                    {contracts.map((c) => (
                                        <option key={c.id} value={c.id}>
                                            {c.display}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                        <ChevronDown className="absolute right-3 top-2.5 w-3.5 h-3.5 text-ink-muted pointer-events-none" />
                    </div>
                    {contract && (
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CONTRACT_TYPE_COLORS[contract.type] ?? "bg-slate-100 text-ink-muted"}`}>
                                {contract.type.toUpperCase()}
                            </span>
                            {contract.discount_percentage > 0 && (
                                <span className="text-xs text-green-600 font-semibold">
                                    {contract.discount_percentage}% off
                                </span>
                            )}
                            {contract.warning && (
                                <span className="text-xs text-amber-600 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    {contract.warning}
                                </span>
                            )}
                        </div>
                    )}
                    {fieldError("contract") && (
                        <p className="text-xs text-red-500 mt-1">{fieldError("contract")}</p>
                    )}
                </div>

                {/* Customer */}
                <div>
                    <label className={labelCls}>Customer</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-ink-muted" />
                        <input
                            value={customerName}
                            onChange={(e) => onSetCustomerName(e.target.value)}
                            placeholder="Walk-in customer name"
                            className={`${inputCls} pl-8 ${fieldError("customer") ? "border-red-300" : ""}`}
                        />
                    </div>
                    {fieldError("customer") && (
                        <p className="text-xs text-red-500 mt-1">{fieldError("customer")}</p>
                    )}
                </div>

                {/* Prescription section */}
                {hasRxItems && (
                    <div>
                        <label className={labelCls}>Prescription ID</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-2.5 w-3.5 h-3.5 text-ink-muted" />
                            <input
                                value={prescriptionId ?? ""}
                                onChange={(e) => onSetPrescriptionId(e.target.value || null)}
                                placeholder="Prescription reference number"
                                className={`${inputCls} pl-8 ${fieldError("prescription_id") ? "border-red-300" : ""}`}
                            />
                        </div>
                        {fieldError("prescription_id") && (
                            <p className="text-xs text-red-500 mt-1">{fieldError("prescription_id")}</p>
                        )}
                    </div>
                )}

                {/* Insurance section */}
                {isInsurance && (
                    <div className="space-y-2 p-3 rounded-xl bg-blue-50 border border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                            Insurance Details
                        </p>
                        <input
                            value={insuranceClaimNumber}
                            onChange={(e) => onSetInsuranceClaimNumber(e.target.value)}
                            placeholder="Claim number *"
                            className={`${inputCls} ${fieldError("insurance_claim") ? "border-red-300" : "border-blue-200"}`}
                        />
                        <input
                            value={insurancePreAuthNumber}
                            onChange={(e) => onSetInsurancePreAuthNumber(e.target.value)}
                            placeholder="Pre-auth number (optional)"
                            className={`${inputCls} border-blue-200`}
                        />
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={insuranceVerified}
                                onChange={(e) => onSetInsuranceVerified(e.target.checked)}
                                className="w-4 h-4 rounded"
                            />
                            <span className="text-sm font-semibold text-blue-700">
                                Insurance card verified ✓
                            </span>
                        </label>
                        {fieldError("insurance") && (
                            <p className="text-xs text-red-500">{fieldError("insurance")}</p>
                        )}
                    </div>
                )}

                {/* Payment method */}
                <div>
                    <label className={labelCls}>Payment Method</label>
                    <div className="flex gap-1 flex-wrap">
                        {PAYMENT_METHODS.map((m) => (
                            <button
                                key={m.value}
                                onClick={() => onSetPaymentMethod(m.value)}
                                type="button"
                                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                    paymentMethod === m.value
                                        ? "bg-brand-600 text-white"
                                        : "bg-white border border-slate-200 text-ink-secondary hover:text-ink"
                                }`}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Amount paid (cash/split) */}
                {(paymentMethod === "cash" || paymentMethod === "split") && (
                    <div>
                        <label className={labelCls}>Amount Tendered (GHS)</label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-sm text-ink-muted">₵</span>
                            <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={amountPaid || ""}
                                onChange={(e) =>
                                    onSetAmountPaid(parseFloat(e.target.value) || 0)
                                }
                                placeholder={totals.total.toFixed(2)}
                                className={`${inputCls} pl-7 ${fieldError("amount_paid") ? "border-red-300" : ""}`}
                            />
                        </div>
                        {fieldError("amount_paid") && (
                            <p className="text-xs text-red-500 mt-1">{fieldError("amount_paid")}</p>
                        )}
                    </div>
                )}

                {/* Notes */}
                <div>
                    <label className={labelCls}>Notes (optional)</label>
                    <input
                        value={notes}
                        onChange={(e) => onSetNotes(e.target.value)}
                        placeholder="Any notes about this sale…"
                        className={inputCls}
                    />
                </div>

                {/* Totals */}
                <div className="rounded-xl bg-white border border-slate-200 p-3 space-y-1.5">
                    <div className="flex justify-between text-xs text-ink-secondary">
                        <span>Subtotal ({totals.itemCount} items)</span>
                        <span>₵{totals.subtotal.toFixed(2)}</span>
                    </div>
                    {totals.discountAmount > 0 && (
                        <div className="flex justify-between text-xs text-green-600">
                            <span>Discount ({contract?.discount_percentage}%)</span>
                            <span>−₵{totals.discountAmount.toFixed(2)}</span>
                        </div>
                    )}
                    {totals.taxAmount > 0 && (
                        <div className="flex justify-between text-xs text-ink-secondary">
                            <span>Tax</span>
                            <span>₵{totals.taxAmount.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-base font-bold text-ink border-t border-slate-100 pt-1.5 mt-1.5">
                        <span>Total</span>
                        <span>₵{totals.total.toFixed(2)}</span>
                    </div>
                    {amountPaid > 0 && totals.change > 0 && (
                        <div className="flex justify-between text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-lg px-2 py-1.5">
                            <span>Change</span>
                            <span>₵{totals.change.toFixed(2)}</span>
                        </div>
                    )}
                </div>

                {/* Validation errors summary */}
                {validationErrors.length > 0 && items.length > 0 && (
                    <div className="rounded-xl bg-red-50 border border-red-100 p-2.5 space-y-1">
                        {validationErrors.map((e) => (
                            <p key={e.field} className="text-xs text-red-600 flex items-start gap-1.5">
                                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                {e.message}
                            </p>
                        ))}
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2">
                    {items.length > 0 && (
                        <button
                            onClick={onClearCart}
                            type="button"
                            className="px-3 py-2.5 text-sm font-medium text-ink-secondary border border-slate-200 bg-white hover:bg-slate-50 rounded-xl transition-colors"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        onClick={onCheckout}
                        disabled={isSubmitting || items.length === 0}
                        type="button"
                        className="flex-1 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                Processing…
                            </>
                        ) : (
                            <>
                                Complete Sale · ₵{totals.total.toFixed(2)}
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}