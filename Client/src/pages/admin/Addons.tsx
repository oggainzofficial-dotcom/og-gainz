import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
	Filter,
	ImagePlus,
	Plus,
	RefreshCw,
	Search,
	Trash2,
	Pencil,
	Puzzle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Skeleton } from '@/components/ui/skeleton';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { adminAddonsService } from '@/services/adminAddonsService';
import { adminAddonCategoriesService } from '@/services/adminAddonCategoriesService';
import type { AddonCategory, AddonCategoryEntity } from '@/types/catalog';
import { formatCurrency } from '@/utils/formatCurrency';
import { ImageDropzone, validateImageFile } from '@/components/shared/ImageDropzone';
import { AdminFormLayout, ADMIN_FORM_GRID, FormField } from '@/components/admin';

type AdminAddon = Awaited<ReturnType<typeof adminAddonsService.list>>['data'][number];

type ActiveFilter = 'all' | 'active' | 'inactive';

const DEFAULT_LIMIT = 30;

const safeNumber = (value: string) => {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
};

const getSinglePrice = (addon: Partial<AdminAddon>) => {
	const single = (addon as unknown as { pricing?: { single?: unknown } }).pricing?.single;
	if (typeof single === 'number' && Number.isFinite(single)) return single;
	const price = (addon as unknown as { price?: unknown }).price;
	if (typeof price === 'number' && Number.isFinite(price)) return price;
	return 0;
};

const getWeeklyPrice = (addon: Partial<AdminAddon>) => {
	const weekly = (addon as unknown as { pricing?: { weekly?: unknown } }).pricing?.weekly;
	if (typeof weekly === 'number' && Number.isFinite(weekly)) return weekly;
	return undefined;
};

const getMonthlyPrice = (addon: Partial<AdminAddon>) => {
	const monthly = (addon as unknown as { pricing?: { monthly?: unknown } }).pricing?.monthly;
	if (typeof monthly === 'number' && Number.isFinite(monthly)) return monthly;
	return undefined;
};

const getWeeklyServings = (addon: Partial<AdminAddon>) => {
	const servings = (addon as unknown as { servings?: { weekly?: unknown } }).servings?.weekly;
	const n = typeof servings === 'number' && Number.isFinite(servings) ? servings : 5;
	return Math.max(1, n);
};

const getMonthlyServings = (addon: Partial<AdminAddon>) => {
	const servings = (addon as unknown as { servings?: { monthly?: unknown } }).servings?.monthly;
	const n = typeof servings === 'number' && Number.isFinite(servings) ? servings : 20;
	return Math.max(1, n);
};

const emptyDraft = (): Partial<AdminAddon> => ({
	name: '',
	categoryId: undefined,
	category: '',
	pricing: { single: 0 },
	servings: { weekly: 5, monthly: 20 },
	description: '',
	servingSizeText: '',
	displayOrder: undefined,
	proteinGrams: undefined,
	isActive: true,
});

export default function AdminAddons() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<AdminAddon[]>([]);

	const [page, setPage] = useState(1);
	const [limit] = useState(DEFAULT_LIMIT);

	const [query, setQuery] = useState('');
	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');
	const [categoryFilter, setCategoryFilter] = useState<AddonCategory | 'all'>('all');
	const debouncedQueryRef = useRef<number | null>(null);
	const [debouncedQuery, setDebouncedQuery] = useState('');

	const [categories, setCategories] = useState<AddonCategoryEntity[]>([]);
	const [categoriesLoading, setCategoriesLoading] = useState(false);

	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<Partial<AdminAddon>>(emptyDraft());
	const [creating, setCreating] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editItem, setEditItem] = useState<AdminAddon | null>(null);
	const [editDraft, setEditDraft] = useState<Partial<AdminAddon>>(emptyDraft());
	const [saving, setSaving] = useState(false);

	const [uploadFile, setUploadFile] = useState<File | null>(null);
	const [uploadFiles, setUploadFiles] = useState<File[]>([]);
	const [uploadAlt, setUploadAlt] = useState('');
	const [uploading, setUploading] = useState(false);
	const [uploadPct, setUploadPct] = useState<number | undefined>(undefined);
	const [imageActionBusy, setImageActionBusy] = useState(false);

	const [createUploadFiles, setCreateUploadFiles] = useState<File[]>([]);
	const [createUploadAlt, setCreateUploadAlt] = useState('');

	const hasNextPage = useRef(false);

	useEffect(() => {
		if (debouncedQueryRef.current) window.clearTimeout(debouncedQueryRef.current);
		debouncedQueryRef.current = window.setTimeout(() => {
			setDebouncedQuery(query);
			setPage(1);
		}, 350);
		return () => {
			if (debouncedQueryRef.current) window.clearTimeout(debouncedQueryRef.current);
		};
	}, [query]);

	const activeFilterValue = useMemo(() => {
		switch (activeFilter) {
			case 'active':
				return true;
			case 'inactive':
				return false;
			default:
				return undefined;
		}
	}, [activeFilter]);

	const fetchAddons = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await adminAddonsService.list({
				page,
				limit,
				q: debouncedQuery || undefined,
				category: categoryFilter === 'all' ? undefined : categoryFilter,
				isActive: activeFilterValue,
			});
			setItems(res.data);
			hasNextPage.current = res.meta.hasNextPage;
		} catch (e) {
			setError('Failed to load add-ons.');
		} finally {
			setLoading(false);
		}
	}, [page, limit, debouncedQuery, categoryFilter, activeFilterValue]);

	const fetchCategories = useCallback(async () => {
		setCategoriesLoading(true);
		try {
			const res = await adminAddonCategoriesService.list({ page: 1, limit: 200, isActive: true });
			setCategories(res.data);
		} catch {
			setCategories([]);
		}
		setCategoriesLoading(false);
	}, []);

	useEffect(() => {
		fetchAddons();
	}, [fetchAddons]);

	useEffect(() => {
		fetchCategories();
	}, [fetchCategories]);

	const categoryOptions = useMemo(() => {
		return [...categories].sort((a, b) => {
			const ao = typeof a.displayOrder === 'number' ? a.displayOrder : 9999;
			const bo = typeof b.displayOrder === 'number' ? b.displayOrder : 9999;
			if (ao !== bo) return ao - bo;
			return a.name.localeCompare(b.name);
		});
	}, [categories]);

	const ensureDraftCategory = useCallback((draft: Partial<AdminAddon>) => {
		if (draft.categoryId) return draft;
		const first = categoryOptions[0];
		if (!first) return draft;
		return { ...draft, categoryId: first.id, category: first.slug };
	}, [categoryOptions]);

	const openEdit = (addon: AdminAddon) => {
		setEditItem(addon);
		setEditDraft({
			name: addon.name,
			categoryId: addon.categoryId || addon.categoryRef?.id,
			category: addon.categoryRef?.slug || addon.category,
			pricing: {
				single: getSinglePrice(addon),
				...(getWeeklyPrice(addon) != null ? { weekly: getWeeklyPrice(addon) } : {}),
				...(getMonthlyPrice(addon) != null ? { monthly: getMonthlyPrice(addon) } : {}),
			},
			servings: {
				weekly: getWeeklyServings(addon),
				monthly: getMonthlyServings(addon),
			},
			description: addon.description || '',
			servingSizeText: addon.servingSizeText || '',
			displayOrder: addon.displayOrder,
			proteinGrams: addon.proteinGrams,
			isActive: addon.isActive,
		});
		setUploadFile(null);
		setUploadFiles([]);
		setUploadAlt(addon.image?.alt || '');
		setUploadPct(undefined);
		setEditOpen(true);
	};

	const resetCreate = () => {
		setCreateDraft(ensureDraftCategory(emptyDraft()));
		setUploadFile(null);
		setCreateUploadFiles([]);
		setCreateUploadAlt('');
		setUploadAlt('');
		setUploadPct(undefined);
	};

	const canSubmitDraft = (draft: Partial<AdminAddon>) => {
		const categoryId = (draft as unknown as { categoryId?: unknown }).categoryId;
		const hasCategoryId = typeof categoryId === 'string' && categoryId.trim().length > 0;
		const single = getSinglePrice(draft);
		const weekly = getWeeklyPrice(draft);
		const monthly = getMonthlyPrice(draft);
		const weeklyOk = weekly == null ? true : weekly >= 0;
		const monthlyOk = monthly == null ? true : monthly >= 0;
		const sw = getWeeklyServings(draft);
		const sm = getMonthlyServings(draft);
		return Boolean(draft.name && hasCategoryId && single >= 0 && weeklyOk && monthlyOk && sw > 0 && sm > 0);
	};

	const handleCreate = async () => {
		if (!canSubmitDraft(createDraft)) return;
		setCreating(true);
		try {
			const payload: Partial<AdminAddon> = {
				...createDraft,
				name: String(createDraft.name || '').trim(),
				pricing: {
					single: getSinglePrice(createDraft),
					...(getWeeklyPrice(createDraft) != null ? { weekly: getWeeklyPrice(createDraft) } : {}),
					...(getMonthlyPrice(createDraft) != null ? { monthly: getMonthlyPrice(createDraft) } : {}),
				},
				servings: {
					weekly: getWeeklyServings(createDraft),
					monthly: getMonthlyServings(createDraft),
				},
			};
			const res = await adminAddonsService.create(payload);
			if (createUploadFiles.length > 0) {
				await adminAddonsService.addImages(res.data.id, createUploadFiles, {
					alt: createUploadAlt.trim() || undefined,
				});
			}
			toast({ title: 'Add-on created', description: res.data.name });
			setCreateOpen(false);
			resetCreate();
			await fetchAddons();
		} catch (e) {
			toast({ title: 'Error', description: 'Failed to create add-on.', variant: 'destructive' });
		} finally {
			setCreating(false);
		}
	};

	const handleSave = async () => {
		if (!editItem) return;
		if (!canSubmitDraft(editDraft)) return;

		setSaving(true);
		try {
			const payload: Partial<AdminAddon> = {
				...editDraft,
				name: String(editDraft.name || '').trim(),
				pricing: {
					single: getSinglePrice(editDraft),
					...(getWeeklyPrice(editDraft) != null ? { weekly: getWeeklyPrice(editDraft) } : {}),
					...(getMonthlyPrice(editDraft) != null ? { monthly: getMonthlyPrice(editDraft) } : {}),
				},
				servings: {
					weekly: getWeeklyServings(editDraft),
					monthly: getMonthlyServings(editDraft),
				},
			};
			const res = await adminAddonsService.update(editItem.id, payload);
			setItems((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...res.data } : a)));
			setEditItem(res.data);
			toast({ title: 'Saved', description: res.data.name });
		} catch (e) {
			toast({ title: 'Error', description: 'Failed to save changes.', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const handleToggle = async (addon: AdminAddon, patch: Partial<AdminAddon>) => {
		setItems((prev) => prev.map((a) => (a.id === addon.id ? { ...a, ...patch } : a)));
		try {
			const res = await adminAddonsService.update(addon.id, patch);
			setItems((prev) => prev.map((a) => (a.id === addon.id ? { ...a, ...res.data } : a)));
		} catch (e) {
			setItems((prev) => prev.map((a) => (a.id === addon.id ? addon : a)));
			toast({ title: 'Error', description: 'Update failed.', variant: 'destructive' });
		}
	};

	const handleHardDelete = async (addon: AdminAddon) => {
		try {
			await adminAddonsService.hardDelete(addon.id);
			setItems((prev) => prev.filter((a) => a.id !== addon.id));
			toast({ title: 'Add-on deleted permanently', description: addon.name });
			await fetchAddons();
		} catch (e) {
			toast({ title: 'Error', description: 'Failed to delete add-on.', variant: 'destructive' });
		}
	};

	const handleUpload = async () => {
		if (!editItem || !uploadFile) return;
		setUploading(true);
		setUploadPct(0);
		try {
			const res = await adminAddonsService.uploadImage(editItem.id, uploadFile, {
				onProgress: (pct) => setUploadPct(pct),
				alt: uploadAlt.trim() || undefined,
			});
			setItems((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...res.data } : a)));
			setEditItem((prev) => (prev ? { ...prev, ...res.data } : prev));
			setUploadFile(null);
			toast({ title: 'Image updated', description: editItem.name });
		} catch (e) {
			toast({ title: 'Error', description: 'Image upload failed.', variant: 'destructive' });
		} finally {
			setUploading(false);
			setUploadPct(undefined);
		}
	};

	const handleUploadImages = async () => {
		if (!editItem || uploadFiles.length === 0) return;
		setUploading(true);
		setUploadPct(0);
		try {
			const res = await adminAddonsService.addImages(editItem.id, uploadFiles, {
				onProgress: (pct) => setUploadPct(pct),
				alt: uploadAlt.trim() || undefined,
			});
			setItems((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...res.data } : a)));
			setEditItem((prev) => (prev ? { ...prev, ...res.data } : prev));
			setUploadFiles([]);
			toast({ title: 'Images added', description: editItem.name });
		} catch {
			toast({ title: 'Error', description: 'Image upload failed.', variant: 'destructive' });
		} finally {
			setUploading(false);
			setUploadPct(undefined);
		}
	};

	const pickValidFiles = (files: FileList | null) => {
		const picked: File[] = [];
		if (!files) return picked;
		for (const file of Array.from(files)) {
			const msg = validateImageFile(file);
			if (msg) {
				toast({ title: 'Invalid image', description: msg, variant: 'destructive' });
				continue;
			}
			picked.push(file);
		}
		return picked;
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-end">
				<div className="flex items-center gap-2">
					<Button variant="outline" onClick={fetchAddons} disabled={loading}>
						<RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
						Refresh
					</Button>
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className="w-4 h-4 mr-2" />
						New Add-on
					</Button>
				</div>
			</div>

			{/* Filters */}
			<Card>
				<CardContent className="p-4">
					<div className="flex flex-col lg:flex-row gap-3">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
							<Input
								placeholder="Search by name…"
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								className="pl-9"
							/>
						</div>
						<Select value={categoryFilter} onValueChange={(v) => {
							setCategoryFilter(v as typeof categoryFilter);
							setPage(1);
						}}>
							<SelectTrigger className="w-full sm:w-52">
								<Filter className="w-4 h-4 mr-2" />
								<SelectValue placeholder="Category" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All categories</SelectItem>
								{categoryOptions.map((c) => (
									<SelectItem key={c.id} value={c.slug}>{c.name}</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select value={activeFilter} onValueChange={(v) => setActiveFilter(v as ActiveFilter)}>
							<SelectTrigger className="w-full sm:w-44">
								<Filter className="w-4 h-4 mr-2" />
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="inactive">Inactive</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</CardContent>
			</Card>

			{/* List */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-lg">Catalog</CardTitle>
				</CardHeader>
				<CardContent className="p-0">
					{loading ? (
						<div className="p-4 space-y-3">
							{Array.from({ length: 8 }).map((_, i) => (
								<Skeleton key={i} className="h-16 w-full" />
							))}
						</div>
					) : error ? (
						<div className="text-center py-12 text-muted-foreground">
							<p className="font-medium">{error}</p>
							<p className="text-sm">Try refreshing.</p>
						</div>
					) : items.length === 0 ? (
						<div className="text-center py-12 text-muted-foreground">
							<p className="font-medium">No add-ons found</p>
							<p className="text-sm">Create an add-on to get started.</p>
						</div>
					) : (
						<div className="divide-y divide-border">
							{items.map((addon, index) => (
								<motion.div
									key={addon.id}
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: Math.min(index * 0.02, 0.35) }}
									className="p-4 hover:bg-muted/30 transition-colors"
								>
									<div className="flex flex-col lg:flex-row lg:items-center gap-4">
										<div className="flex items-center gap-3 min-w-0 flex-1">
											<div className="w-14 h-10 rounded-lg overflow-hidden bg-muted shrink-0 border">
												{addon.image?.url ? (
													<img src={addon.image.url} alt={addon.name} className="w-full h-full object-cover" loading="lazy" />
												) : (
													<div className="w-full h-full flex items-center justify-center">
														<ImagePlus className="w-4 h-4 text-muted-foreground" />
													</div>
												)}
											</div>
											<div className="min-w-0">
												<div className="flex flex-wrap items-center gap-2">
													<p className="font-semibold truncate">{addon.name}</p>
													<Badge variant="secondary">{addon.categoryRef?.name || addon.category}</Badge>
													{!addon.isActive && <Badge variant="destructive">Inactive</Badge>}
												</div>
												<div className="text-xs text-muted-foreground">
													{typeof addon.proteinGrams === 'number' ? `${addon.proteinGrams}g protein` : '—'}
												</div>
											</div>
										</div>

											<div className="flex flex-wrap items-center gap-3">
												<div className="text-sm font-semibold">{formatCurrency(getSinglePrice(addon))}</div>
												{getWeeklyPrice(addon) != null ? (
													<div className="text-xs text-muted-foreground">Weekly: {formatCurrency(getWeeklyPrice(addon) as number)}</div>
												) : null}
												{getMonthlyPrice(addon) != null ? (
													<div className="text-xs text-muted-foreground">Monthly: {formatCurrency(getMonthlyPrice(addon) as number)}</div>
												) : null}
											</div>

										<div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
											<div className="flex items-center gap-2">
												<span className="text-xs text-muted-foreground">Active</span>
												<Switch
													checked={Boolean(addon.isActive)}
													onCheckedChange={(checked) => handleToggle(addon, { isActive: checked })}
												/>
											</div>
											<Button variant="outline" size="sm" onClick={() => openEdit(addon)}>
												<Pencil className="w-4 h-4 mr-2" />
												Edit
											</Button>
											<AlertDialog>
												<AlertDialogTrigger asChild>
													<Button variant="destructive" size="sm">
														<Trash2 className="w-4 h-4 mr-2" />
														Delete
													</Button>
												</AlertDialogTrigger>
												<AlertDialogContent>
													<AlertDialogHeader>
														<AlertDialogTitle>Delete add-on?</AlertDialogTitle>
														<AlertDialogDescription>
															This will permanently delete this add-on from the database.
														</AlertDialogDescription>
													</AlertDialogHeader>
													<AlertDialogFooter>
														<AlertDialogCancel>Cancel</AlertDialogCancel>
														<AlertDialogAction onClick={() => handleHardDelete(addon)}>Delete</AlertDialogAction>
													</AlertDialogFooter>
												</AlertDialogContent>
											</AlertDialog>
										</div>
									</div>
								</motion.div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Pagination */}
			<div className="flex items-center justify-between">
				<Button variant="outline" disabled={loading || page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
					Prev
				</Button>
				<div className="text-xs text-muted-foreground">Page {page}</div>
				<Button
					variant="outline"
					disabled={loading || !hasNextPage.current}
					onClick={() => setPage((p) => p + 1)}
				>
					Next
				</Button>
			</div>

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={(open) => {
				setCreateOpen(open);
				if (!open) resetCreate();
			}}>
				<DialogContent className="max-w-5xl p-0">
					<DialogHeader>
						<VisuallyHidden>
							<DialogTitle>New Add-on</DialogTitle>
						</VisuallyHidden>
						<VisuallyHidden>
							<DialogDescription>Creates an add-on in the catalog.</DialogDescription>
						</VisuallyHidden>
					</DialogHeader>
					<AdminFormLayout
						title="New Add-on"
						description="Creates an add-on in the catalog."
						stickyActions
						actions={
							<>
								<Button variant="outline" className="h-11 rounded-xl" onClick={() => setCreateOpen(false)} disabled={creating}>
									Cancel
								</Button>
								<Button className="h-11 rounded-xl" onClick={handleCreate} disabled={creating || !canSubmitDraft(createDraft)}>
									{creating ? 'Creating…' : 'Create Add-on'}
								</Button>
							</>
						}
					>
						<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
							<div className={ADMIN_FORM_GRID}>
								<FormField label="Name" required className="md:col-span-2">
									<Input
										value={String(createDraft.name || '')}
										onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))}
										placeholder="e.g. Extra Chicken"
									/>
								</FormField>
								<FormField label="Category" required applyInputStyles={false}>
									<Select
										value={String((createDraft as unknown as { categoryId?: string }).categoryId || '')}
										onValueChange={(v) => {
											const selected = categoryOptions.find((c) => c.id === v);
											setCreateDraft((d) => ({
												...d,
												categoryId: v,
												category: selected?.slug || (d.category as AddonCategory),
											}));
										}}
									>
										<SelectTrigger className="h-11 rounded-xl px-4">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{categoriesLoading ? (
												<SelectItem value="" disabled>Loading…</SelectItem>
											) : categoryOptions.length === 0 ? (
												<SelectItem value="" disabled>No categories found</SelectItem>
											) : (
												categoryOptions.map((c) => (
													<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
												))
											)}
										</SelectContent>
									</Select>
								</FormField>

								<FormField label="Single price (INR)" required>
									<Input
										type="number"
										value={String(getSinglePrice(createDraft))}
										onChange={(e) => {
											const single = safeNumber(e.target.value);
											setCreateDraft((d) => ({
												...d,
												pricing: { ...(d.pricing || { single: 0 }), single },
											}));
										}}
										min={0}
									/>
								</FormField>
								<FormField label="Weekly subscription price (optional)">
									<Input
										type="number"
										value={getWeeklyPrice(createDraft) == null ? '' : String(getWeeklyPrice(createDraft))}
										onChange={(e) => {
											const raw = e.target.value;
											setCreateDraft((d) => {
												const base = { ...(d.pricing || { single: getSinglePrice(d) }) } as { single: number; weekly?: number; monthly?: number };
												if (raw === '') {
													const { weekly: _weekly, ...rest } = base;
													return { ...d, pricing: rest };
												}
												return { ...d, pricing: { ...base, weekly: safeNumber(raw) } };
											});
										}}
										min={0}
									/>
								</FormField>
								<FormField label="Monthly price (optional)">
									<Input
										type="number"
										value={getMonthlyPrice(createDraft) == null ? '' : String(getMonthlyPrice(createDraft))}
										onChange={(e) => {
											const raw = e.target.value;
											setCreateDraft((d) => {
												const base = { ...(d.pricing || { single: getSinglePrice(d) }) };
												if (raw === '') {
													const { monthly: _monthly, ...rest } = base as { single: number; monthly?: number };
													return { ...d, pricing: rest };
												}
												return { ...d, pricing: { ...base, monthly: safeNumber(raw) } };
											});
										}}
										min={0}
									/>
								</FormField>
								<FormField label="Weekly servings">
									<Input
										type="number"
										value={String(getWeeklyServings(createDraft))}
										onChange={(e) => {
											const v = Math.max(1, safeNumber(e.target.value));
											setCreateDraft((d) => ({ ...d, servings: { weekly: v, monthly: getMonthlyServings(d) } }));
										}}
										min={1}
									/>
								</FormField>
								<FormField label="Monthly servings">
									<Input
										type="number"
										value={String(getMonthlyServings(createDraft))}
										onChange={(e) => {
											const v = Math.max(1, safeNumber(e.target.value));
											setCreateDraft((d) => ({ ...d, servings: { weekly: getWeeklyServings(d), monthly: v } }));
										}}
										min={1}
									/>
								</FormField>
								<FormField label="Protein grams (optional)">
									<Input
										type="number"
										value={createDraft.proteinGrams == null ? '' : String(createDraft.proteinGrams)}
										onChange={(e) => {
											const v = e.target.value;
											setCreateDraft((d) => ({ ...d, proteinGrams: v === '' ? undefined : Math.max(0, safeNumber(v)) }));
										}}
										min={0}
									/>
								</FormField>

								<FormField label="Serving size text (optional)" className="md:col-span-2">
									<Input
										value={String(createDraft.servingSizeText || '')}
										onChange={(e) => setCreateDraft((d) => ({ ...d, servingSizeText: e.target.value }))}
										placeholder="e.g. 150g (cooked)"
									/>
								</FormField>
								<FormField label="Description (optional)" className="md:col-span-2">
									<Textarea
										value={String(createDraft.description || '')}
										onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value }))}
										placeholder="Shown in admin and (optionally) product detail contexts"
										className="min-h-[120px]"
									/>
								</FormField>
								<FormField label="Display order (optional)">
									<Input
										type="number"
										value={createDraft.displayOrder == null ? '' : String(createDraft.displayOrder)}
										onChange={(e) => {
											const v = e.target.value;
											setCreateDraft((d) => ({ ...d, displayOrder: v === '' ? undefined : safeNumber(v) }));
										}}
										min={0}
									/>
								</FormField>

								<FormField label="Status" applyInputStyles={false} className="md:col-span-2">
									<div className="flex h-11 items-center justify-between rounded-xl border px-4">
										<span className="text-sm">Active</span>
										<Switch
											checked={Boolean(createDraft.isActive)}
											onCheckedChange={(checked) => setCreateDraft((d) => ({ ...d, isActive: checked }))}
										/>
									</div>
								</FormField>

								<FormField label="Images (optional, can add later)" hint="Uploads after create." applyInputStyles={false} className="md:col-span-2">
									<input
										type="file"
										multiple
										accept="image/jpeg,image/png,image/webp"
										disabled={creating}
										onChange={(e) => setCreateUploadFiles(pickValidFiles(e.target.files))}
										className="block w-full text-sm"
									/>
								</FormField>
								<FormField label="Alt text (optional)" className="md:col-span-2">
									<Input value={createUploadAlt} onChange={(e) => setCreateUploadAlt(e.target.value)} placeholder="Short description for accessibility" />
								</FormField>
							</div>
						</div>
					</AdminFormLayout>
				</DialogContent>
			</Dialog>

					{/* Edit Dialog */}
					<Dialog open={editOpen} onOpenChange={(open) => {
						setEditOpen(open);
						if (!open) {
							setEditItem(null);
							setUploadFile(null);
							setUploadAlt('');
							setUploadPct(undefined);
						}
					}}>
						<DialogContent className="max-w-5xl p-0">
							<DialogHeader>
								<VisuallyHidden>
									<DialogTitle>Edit Add-on</DialogTitle>
								</VisuallyHidden>
								<VisuallyHidden>
									<DialogDescription>Update details and upload a new image.</DialogDescription>
								</VisuallyHidden>
							</DialogHeader>
							<AdminFormLayout
								title="Edit Add-on"
								description="Update details and upload a new image."
								stickyActions
								actions={
									<>
										<Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditOpen(false)} disabled={saving || uploading}>
											Close
										</Button>
										<Button className="h-11 rounded-xl" onClick={handleSave} disabled={!editItem || saving || uploading || !canSubmitDraft(editDraft)}>
											{saving ? 'Saving…' : 'Save Changes'}
										</Button>
									</>
								}
							>
								<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
									{!editItem ? (
										<Skeleton className="h-32 w-full rounded-xl" />
									) : (
										<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
											<div className="space-y-6">
												<div className="rounded-xl border bg-white p-4 space-y-4">
													<h3 className="text-sm font-semibold text-oz-primary">Details</h3>
													<div className={ADMIN_FORM_GRID}>
														<FormField label="Name" required className="md:col-span-2">
															<Input value={String(editDraft.name || '')} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
														</FormField>
														<FormField label="Category" required applyInputStyles={false}>
															<Select
																value={String((editDraft as unknown as { categoryId?: string }).categoryId || '')}
																onValueChange={(v) => {
																	const selected = categoryOptions.find((c) => c.id === v);
																	setEditDraft((d) => ({
																		...d,
																		categoryId: v,
																		category: selected?.slug || (d.category as AddonCategory),
																	}));
																}}
															>
																<SelectTrigger className="h-11 rounded-xl px-4"><SelectValue /></SelectTrigger>
																<SelectContent>
																	{categoriesLoading ? (
																		<SelectItem value="" disabled>Loading…</SelectItem>
																	) : categoryOptions.length === 0 ? (
																		<SelectItem value="" disabled>No categories found</SelectItem>
																	) : (
																		categoryOptions.map((c) => (
																			<SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
																		))
																	)}
																</SelectContent>
															</Select>
														</FormField>
														<FormField label="Serving size text (optional)" className="md:col-span-2">
															<Input value={String(editDraft.servingSizeText || '')} onChange={(e) => setEditDraft((d) => ({ ...d, servingSizeText: e.target.value }))} placeholder="e.g. 150g (cooked)" />
														</FormField>
														<FormField label="Display order (optional)">
															<Input type="number" value={editDraft.displayOrder == null ? '' : String(editDraft.displayOrder)} onChange={(e) => { const v = e.target.value; setEditDraft((d) => ({ ...d, displayOrder: v === '' ? undefined : safeNumber(v) })); }} min={0} />
														</FormField>
														<FormField label="Description (optional)" className="md:col-span-2">
															<Textarea value={String(editDraft.description || '')} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} placeholder="Shown in admin and (optionally) product detail contexts" className="min-h-[120px]" />
														</FormField>
													</div>
												</div>

												<div className="rounded-xl border bg-white p-4 space-y-4">
													<h3 className="text-sm font-semibold text-oz-primary">Pricing & Nutrition</h3>
													<div className={ADMIN_FORM_GRID}>
														<FormField label="Single price (INR)">
															<Input type="number" value={String(getSinglePrice(editDraft))} onChange={(e) => { const single = safeNumber(e.target.value); setEditDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0 }), single }, })); }} min={0} />
														</FormField>
														<FormField label="Weekly subscription price (optional)">
															<Input type="number" value={getWeeklyPrice(editDraft) == null ? '' : String(getWeeklyPrice(editDraft))} onChange={(e) => { const raw = e.target.value; setEditDraft((d) => { const base = { ...(d.pricing || { single: getSinglePrice(d) }) } as { single: number; weekly?: number; monthly?: number }; if (raw === '') { const { weekly: _weekly, ...rest } = base; return { ...d, pricing: rest }; } return { ...d, pricing: { ...base, weekly: safeNumber(raw) } }; }); }} min={0} />
														</FormField>
														<FormField label="Monthly price (optional)">
															<Input type="number" value={getMonthlyPrice(editDraft) == null ? '' : String(getMonthlyPrice(editDraft))} onChange={(e) => { const raw = e.target.value; setEditDraft((d) => { const base = { ...(d.pricing || { single: getSinglePrice(d) }) }; if (raw === '') { const { monthly: _monthly, ...rest } = base as { single: number; monthly?: number }; return { ...d, pricing: rest }; } return { ...d, pricing: { ...base, monthly: safeNumber(raw) } }; }); }} min={0} />
														</FormField>
														<FormField label="Weekly servings">
															<Input type="number" value={String(getWeeklyServings(editDraft))} onChange={(e) => { const v = Math.max(1, safeNumber(e.target.value)); setEditDraft((d) => ({ ...d, servings: { weekly: v, monthly: getMonthlyServings(d) } })); }} min={1} />
														</FormField>
														<FormField label="Monthly servings">
															<Input type="number" value={String(getMonthlyServings(editDraft))} onChange={(e) => { const v = Math.max(1, safeNumber(e.target.value)); setEditDraft((d) => ({ ...d, servings: { weekly: getWeeklyServings(d), monthly: v } })); }} min={1} />
														</FormField>
														<FormField label="Protein grams (optional)">
															<Input type="number" value={editDraft.proteinGrams == null ? '' : String(editDraft.proteinGrams)} onChange={(e) => { const v = e.target.value; setEditDraft((d) => ({ ...d, proteinGrams: v === '' ? undefined : Math.max(0, safeNumber(v)) })); }} min={0} />
														</FormField>
													</div>
												</div>

												<div className="rounded-xl border bg-white p-4">
													<FormField label="Status" applyInputStyles={false}>
														<div className="flex h-11 items-center justify-between rounded-xl border px-4">
															<span className="text-sm">Active</span>
															<Switch checked={Boolean(editDraft.isActive)} onCheckedChange={(v) => setEditDraft((d) => ({ ...d, isActive: v }))} />
														</div>
													</FormField>
												</div>
											</div>

											<div className="rounded-xl border bg-white p-4 space-y-4">
												<h3 className="text-sm font-semibold text-oz-primary">Images</h3>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													{(editItem.images && editItem.images.length > 0 ? editItem.images : (editItem.image ? [editItem.image] : [])).map((img, idx) => (
														<div key={img.publicId || idx} className="rounded-xl overflow-hidden border bg-muted">
															<div className="relative">
																<img src={img.url} alt={img.alt || editItem.name} className="w-full aspect-[16/9] object-cover" loading="lazy" />
																{idx === 0 ? (
																	<div className="absolute top-2 left-2 rounded-full bg-black/60 text-white text-xs px-2 py-0.5">Primary</div>
																) : null}
															</div>
															<div className="flex gap-2 p-2">
																<Button
																	variant="outline"
																	className="h-9 rounded-lg"
																	disabled={imageActionBusy || uploading || saving || idx === 0}
																	onClick={async () => {
																		if (!editItem) return;
																		setImageActionBusy(true);
																		try {
																			const res = await adminAddonsService.makeImagePrimary(editItem.id, idx);
																			setItems((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...res.data } : a)));
																			setEditItem(res.data);
																		} catch {
																			toast({ title: 'Error', description: 'Failed to set primary image.', variant: 'destructive' });
																		} finally {
																			setImageActionBusy(false);
																		}
																	}}
																>
																	Make primary
																</Button>
																<Button
																	variant="destructive"
																	className="h-9 rounded-lg"
																	disabled={imageActionBusy || uploading || saving}
																	onClick={async () => {
																		if (!editItem) return;
																		setImageActionBusy(true);
																		try {
																			const res = await adminAddonsService.deleteImageAtIndex(editItem.id, idx);
																			setItems((prev) => prev.map((a) => (a.id === editItem.id ? { ...a, ...res.data } : a)));
																			setEditItem(res.data);
																		} catch {
																			toast({ title: 'Error', description: 'Failed to delete image.', variant: 'destructive' });
																		} finally {
																			setImageActionBusy(false);
																		}
																	}}
																>
																	Delete
																</Button>
															</div>
														</div>
													))}
												</div>

												<div className="rounded-xl border bg-muted/20 p-4 space-y-4">
													<FormField label="Upload images" applyInputStyles={false}>
														<ImageDropzone value={uploadFile} onChange={setUploadFile} disabled={uploading || saving} progressPct={uploadPct} />
													</FormField>
													<FormField label="Image alt text (optional)">
														<Input value={uploadAlt} onChange={(e) => setUploadAlt(e.target.value)} placeholder="Short description for accessibility" />
													</FormField>
													<div className="flex flex-wrap gap-2">
														<Button variant="outline" className="h-11 rounded-xl" disabled={!uploadFile || uploading || saving} onClick={handleUpload}>
															{uploading ? 'Uploading…' : 'Replace primary'}
														</Button>
													</div>
													<div className="space-y-2">
														<FormField label="Add multiple images" applyInputStyles={false}>
															<input
																type="file"
																multiple
																accept="image/jpeg,image/png,image/webp"
																disabled={uploading || saving}
																onChange={(e) => setUploadFiles(pickValidFiles(e.target.files))}
																className="block w-full text-sm"
															/>
														</FormField>
														<div className="text-xs text-muted-foreground">Appends to the end. Use “Make primary” to pick the cover.</div>
														<Button variant="outline" className="h-11 rounded-xl" disabled={uploadFiles.length === 0 || uploading || saving} onClick={handleUploadImages}>
															{uploading ? 'Uploading…' : `Upload ${uploadFiles.length || ''} image(s)`}
														</Button>
													</div>
												</div>
											</div>
										</div>
									)}
								</div>
							</AdminFormLayout>
						</DialogContent>
					</Dialog>
		</div>
	);
}
