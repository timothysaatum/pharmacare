import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { motion } from "framer-motion";
import { X, Package, AlertCircle, ChevronDown, ShieldAlert } from "lucide-react";
import { drugApi } from "@/api/drugs";
import { useAuthStore } from "@/stores/authStore";
import { useCategories } from "@/hooks/useCategories";
import { parseApiError } from "@/api/client";
import type { Drug, DrugCreate, DrugUpdate } from "@/types";

// ── Zod schema — mirrors DrugCreate/DrugUpdate exactly ────
const drugSchema = z.object({
    name: z.string().min(1, "Name is required").max(255),
    generic_name: z.string().max(255).optional().or(z.literal("")),
    brand_name: z.string().max(255).optional().or(z.literal("")),
    sku: z.string().max(100).optional().or(z.literal("")),
    barcode: z.string().max(100).optional().or(z.literal("")),
    category_id: z.string().optional().or(z.literal("")),
    drug_type: z.enum(["otc", "prescription", "controlled", "herbal", "supplement"]),
    dosage_form: z.string().max(100).optional().or(z.literal("")),
    strength: z.string().max(100).optional().or(z.literal("")),
    manufacturer: z.string().max(255).optional().or(z.literal("")),
    supplier: z.string().max(255).optional().or(z.literal("")),
    requires_prescription: z.boolean(),
    unit_price: z.coerce
        .number({ error: "Enter a valid price" })
        .min(0, "Price must be ≥ 0"),
    cost_price: z.coerce.number().min(0).optional(),
    tax_rate: z.coerce.number().min(0).max(100).default(0),
    reorder_level: z.coerce.number().int().min(0).default(10),
    reorder_quantity: z.coerce.number().int().min(1).default(50),
    unit_of_measure: z.string().max(50).default("unit"),
    description: z.string().optional().or(z.literal("")),
    usage_instructions: z.string().optional().or(z.literal("")),
    side_effects: z.string().optional().or(z.literal("")),
    storage_conditions: z.string().optional().or(z.literal("")),
    is_active: z.boolean().default(true),
});

type DrugFormValues = z.infer<typeof drugSchema>;

// Convert undefined/empty strings consistently before sending to API
function clean(v: string | undefined): string | undefined {
    return v === "" ? undefined : v;
}

interface DrugFormProps {
    drug?: Drug;       // undefined = create mode
    onSuccess: (drug: Drug) => void;
    onCancel: () => void;
}

const DRUG_TYPES = [
    { value: "otc", label: "Over the Counter (OTC)" },
    { value: "prescription", label: "Prescription" },
    { value: "controlled", label: "Controlled Substance" },
    { value: "herbal", label: "Herbal" },
    { value: "supplement", label: "Supplement" },
];

const UNITS = ["unit", "box", "bottle", "strip", "vial", "sachet", "tube", "pack", "ampoule"];

type Tab = "basic" | "pricing" | "details";

export function DrugForm({ drug, onSuccess, onCancel }: DrugFormProps) {
    const { user } = useAuthStore();
    const isEdit = !!drug;
    const canEdit = !!user?.role && ["admin", "manager", "super_admin"].includes(user.role);

    // Shared cache — will not re-fetch if DrugListPage already loaded categories
    const { categories } = useCategories();

    const [activeTab, setActiveTab] = useState<Tab>("basic");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { register, handleSubmit, watch, setValue, formState: { errors } } =
        useForm<DrugFormValues>({
            resolver: zodResolver(drugSchema) as Resolver<DrugFormValues>,
            defaultValues: {
                name: drug?.name ?? "",
                generic_name: drug?.generic_name ?? "",
                brand_name: drug?.brand_name ?? "",
                sku: drug?.sku ?? "",
                barcode: drug?.barcode ?? "",
                category_id: drug?.category_id ?? "",
                drug_type: drug?.drug_type ?? "otc",
                dosage_form: drug?.dosage_form ?? "",
                strength: drug?.strength ?? "",
                manufacturer: drug?.manufacturer ?? "",
                supplier: drug?.supplier ?? "",
                requires_prescription: drug?.requires_prescription ?? false,
                // unit_price/cost_price are number in index.ts — no parsing needed
                unit_price: drug?.unit_price ?? undefined,
                cost_price: drug?.cost_price ?? undefined,
                tax_rate: drug?.tax_rate ?? 0,
                reorder_level: drug?.reorder_level ?? 10,
                reorder_quantity: drug?.reorder_quantity ?? 50,
                unit_of_measure: drug?.unit_of_measure ?? "unit",
                description: drug?.description ?? "",
                usage_instructions: drug?.usage_instructions ?? "",
                side_effects: drug?.side_effects ?? "",
                storage_conditions: drug?.storage_conditions ?? "",
                is_active: drug?.is_active ?? true,
            },
        });

    const watchedType = watch("drug_type");
    const unitPrice = watch("unit_price");
    const costPrice = watch("cost_price");

    // Auto-set requires_prescription for Rx/controlled types
    useEffect(() => {
        if (watchedType === "prescription" || watchedType === "controlled") {
            setValue("requires_prescription", true);
        }
    }, [watchedType, setValue]);

    const onSubmit = async (values: DrugFormValues) => {
        if (!canEdit) return;

        // Null guard: organization_id must exist before submitting
        if (!user?.organization_id) {
            setError("Unable to determine your organisation. Please reload and try again.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        // Build a properly-typed payload — no `as any` cast
        const shared = {
            name: values.name,
            generic_name: clean(values.generic_name),
            brand_name: clean(values.brand_name),
            sku: clean(values.sku),
            barcode: clean(values.barcode),
            category_id: clean(values.category_id),
            drug_type: values.drug_type,
            dosage_form: clean(values.dosage_form),
            strength: clean(values.strength),
            manufacturer: clean(values.manufacturer),
            supplier: clean(values.supplier),
            requires_prescription: values.requires_prescription,
            unit_price: values.unit_price,
            cost_price: values.cost_price,
            tax_rate: values.tax_rate,
            reorder_level: values.reorder_level,
            reorder_quantity: values.reorder_quantity,
            unit_of_measure: values.unit_of_measure,
            description: clean(values.description),
            usage_instructions: clean(values.usage_instructions),
            side_effects: clean(values.side_effects),
            storage_conditions: clean(values.storage_conditions),
            is_active: values.is_active,
        };

        try {
            let result: Drug;
            if (isEdit) {
                const updatePayload: DrugUpdate = shared;
                result = await drugApi.update(drug.id, updatePayload);
            } else {
                const createPayload: DrugCreate = {
                    ...shared,
                    organization_id: user.organization_id,
                };
                result = await drugApi.create(createPayload);
            }
            onSuccess(result);
        } catch (err) {
            setError(parseApiError(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const tabs: { id: Tab; label: string }[] = [
        { id: "basic", label: "Basic Info" },
        { id: "pricing", label: "Pricing & Stock" },
        { id: "details", label: "Details" },
    ];

    const basicFields = ["name", "generic_name", "drug_type", "dosage_form", "strength", "sku", "barcode", "category_id"];
    const pricingFields = ["unit_price", "cost_price", "tax_rate", "reorder_level", "reorder_quantity", "unit_of_measure"];
    const tabErrors = {
        basic: basicFields.some((f) => errors[f as keyof typeof errors]),
        pricing: pricingFields.some((f) => errors[f as keyof typeof errors]),
        details: false,
    };

    const inputCls = "w-full h-10 px-3 rounded-xl border border-slate-200 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:opacity-60 disabled:bg-slate-50";
    const labelCls = "block text-sm font-medium text-ink mb-1.5";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.97, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 8 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center">
                            <Package className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                            <h2 className="font-display text-lg font-bold text-ink">
                                {isEdit ? "Edit Drug" : "Add New Drug"}
                            </h2>
                            <p className="text-xs text-ink-muted">
                                {isEdit ? `Editing ${drug.name}` : "Fill in the drug details below"}
                            </p>
                        </div>
                    </div>
                    <button onClick={onCancel}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-muted hover:text-ink hover:bg-slate-100 transition-colors">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Read-only warning for pharmacists */}
                {!canEdit && (
                    <div className="mx-6 mt-4 rounded-xl bg-amber-50 border border-amber-100 p-3 flex gap-2 items-center">
                        <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
                        <p className="text-sm text-amber-700">View only — your role cannot edit drugs</p>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex border-b border-slate-100 px-6">
                    {tabs.map((tab) => (
                        <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                            className={`relative py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab.id
                                    ? "text-brand-600 border-b-2 border-brand-600"
                                    : "text-ink-muted hover:text-ink"
                                }`}>
                            {tab.label}
                            {tabErrors[tab.id] && (
                                <span className="absolute top-2 right-1 w-2 h-2 rounded-full bg-red-500" />
                            )}
                        </button>
                    ))}
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-5">
                        {error && (
                            <div className="mb-4 rounded-xl bg-red-50 border border-red-100 p-3 flex gap-2">
                                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-red-600">{error}</p>
                            </div>
                        )}

                        {/* ── Basic Info ── */}
                        {activeTab === "basic" && (
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Drug Name <span className="text-red-500">*</span></label>
                                    <input {...register("name")} disabled={!canEdit} placeholder="e.g. Paracetamol 500mg" className={inputCls} />
                                    {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Generic Name</label>
                                        <input {...register("generic_name")} disabled={!canEdit} placeholder="e.g. Paracetamol" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Brand Name</label>
                                        <input {...register("brand_name")} disabled={!canEdit} placeholder="e.g. Panadol" className={inputCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Drug Type <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <select {...register("drug_type")} disabled={!canEdit}
                                                className={`${inputCls} appearance-none pr-8 bg-white`}>
                                                {DRUG_TYPES.map((t) => (
                                                    <option key={t.value} value={t.value}>{t.label}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-ink-muted pointer-events-none" />
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Category</label>
                                        <div className="relative">
                                            <select {...register("category_id")} disabled={!canEdit}
                                                className={`${inputCls} appearance-none pr-8 bg-white`}>
                                                <option value="">— No category —</option>
                                                {categories.map((c) => (
                                                    <option key={c.id} value={c.id}>{c.name}</option>
                                                ))}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-ink-muted pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Dosage Form</label>
                                        <input {...register("dosage_form")} disabled={!canEdit} placeholder="e.g. Tablet, Capsule" className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Strength</label>
                                        <input {...register("strength")} disabled={!canEdit} placeholder="e.g. 500mg" className={inputCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>SKU</label>
                                        <input {...register("sku")} disabled={!canEdit} placeholder="e.g. PAR-500" className={inputCls} />
                                        {errors.sku && <p className="mt-1 text-xs text-red-500">{errors.sku.message}</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Barcode</label>
                                        <input {...register("barcode")} disabled={!canEdit} placeholder="EAN / UPC" className={inputCls} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Manufacturer</label>
                                        <input {...register("manufacturer")} disabled={!canEdit} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Supplier</label>
                                        <input {...register("supplier")} disabled={!canEdit} className={inputCls} />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <input type="checkbox" id="requires_prescription" {...register("requires_prescription")}
                                        disabled={!canEdit || watchedType === "prescription" || watchedType === "controlled"}
                                        className="w-4 h-4 rounded text-brand-600 border-slate-300 focus:ring-brand-500" />
                                    <label htmlFor="requires_prescription" className="text-sm font-medium text-ink">
                                        Requires prescription
                                    </label>
                                    {(watchedType === "prescription" || watchedType === "controlled") && (
                                        <span className="ml-auto text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                            Auto-set
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <input type="checkbox" id="is_active" {...register("is_active")}
                                        disabled={!canEdit}
                                        className="w-4 h-4 rounded text-brand-600 border-slate-300 focus:ring-brand-500" />
                                    <label htmlFor="is_active" className="text-sm font-medium text-ink">
                                        Active (visible in POS and inventory)
                                    </label>
                                </div>
                            </div>
                        )}

                        {/* ── Pricing & Stock ── */}
                        {activeTab === "pricing" && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Selling Price (GHS) <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-sm text-ink-muted">₵</span>
                                            <input type="number" step="0.01" min="0" placeholder="0.00"
                                                {...register("unit_price")} disabled={!canEdit}
                                                className={`${inputCls} pl-7`} />
                                        </div>
                                        {errors.unit_price && <p className="mt-1 text-xs text-red-500">{errors.unit_price.message}</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Cost Price (GHS)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-sm text-ink-muted">₵</span>
                                            <input type="number" step="0.01" min="0" placeholder="0.00"
                                                {...register("cost_price")} disabled={!canEdit}
                                                className={`${inputCls} pl-7`} />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Tax Rate (%)</label>
                                        <input type="number" step="0.01" min="0" max="100" placeholder="0"
                                            {...register("tax_rate")} disabled={!canEdit} className={inputCls} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Unit of Measure</label>
                                        <div className="relative">
                                            <select {...register("unit_of_measure")} disabled={!canEdit}
                                                className={`${inputCls} appearance-none pr-8 bg-white`}>
                                                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                                            </select>
                                            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-ink-muted pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelCls}>Reorder Level</label>
                                        <input type="number" min="0" placeholder="10"
                                            {...register("reorder_level")} disabled={!canEdit} className={inputCls} />
                                        <p className="text-xs text-ink-muted mt-1">Alert when stock falls below this</p>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Reorder Quantity</label>
                                        <input type="number" min="1" placeholder="50"
                                            {...register("reorder_quantity")} disabled={!canEdit} className={inputCls} />
                                        <p className="text-xs text-ink-muted mt-1">Suggested order quantity</p>
                                    </div>
                                </div>

                                {/* Live margin preview — only show when both prices are valid numbers */}
                                {unitPrice && costPrice && costPrice > 0 && (
                                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                                        <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">
                                            Margin Preview
                                        </p>
                                        <p className="text-2xl font-bold text-emerald-700">
                                            {(((unitPrice - costPrice) / costPrice) * 100).toFixed(1)}%
                                        </p>
                                        <p className="text-xs text-emerald-600 mt-0.5">
                                            Profit: ₵{(unitPrice - costPrice).toFixed(2)} per unit
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Details ── */}
                        {activeTab === "details" && (
                            <div className="space-y-4">
                                {([
                                    { name: "description", label: "Description", placeholder: "Brief description of the drug…" },
                                    { name: "usage_instructions", label: "Usage Instructions", placeholder: "Dosage and usage instructions…" },
                                    { name: "side_effects", label: "Side Effects", placeholder: "Known side effects…" },
                                    { name: "storage_conditions", label: "Storage Conditions", placeholder: "e.g. Store below 25°C…" },
                                ] as const).map((field) => (
                                    <div key={field.name}>
                                        <label className={labelCls}>{field.label}</label>
                                        <textarea {...register(field.name)} disabled={!canEdit} rows={3}
                                            placeholder={field.placeholder}
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-ink resize-none focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 disabled:opacity-60 disabled:bg-slate-50" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
                        <div className="flex gap-2">
                            {tabs.map((tab) => (
                                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                                    className={`w-2 h-2 rounded-full transition-colors ${activeTab === tab.id ? "bg-brand-600" : "bg-slate-300"
                                        }`} />
                            ))}
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={onCancel}
                                className="px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink hover:bg-slate-100 rounded-xl transition-colors">
                                Cancel
                            </button>
                            {canEdit && (
                                <button type="submit" disabled={isSubmitting}
                                    className="px-5 py-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors disabled:opacity-60 flex items-center gap-2">
                                    {isSubmitting && (
                                        <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                        </svg>
                                    )}
                                    {isSubmitting ? "Saving…" : isEdit ? "Save Changes" : "Add Drug"}
                                </button>
                            )}
                        </div>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}