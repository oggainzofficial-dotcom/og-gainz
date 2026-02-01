import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Trash2, Pencil, Image as ImageIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { adminBuildYourOwnItemsService } from '@/services/adminBuildYourOwnItemsService';
import { adminBuildYourOwnItemTypesService } from '@/services/adminBuildYourOwnItemTypesService';
import type { BuildYourOwnItemEntity, BuildYourOwnItemTypeEntity, BuildYourOwnQuantityUnit } from '@/types/buildYourOwn';

type ActiveFilter = 'all' | 'active' | 'inactive';

const DEFAULT_LIMIT = 50;
const UNITS: BuildYourOwnQuantityUnit[] = ['g', 'kg', 'ml', 'l', 'pcs'];

type Draft = Partial<BuildYourOwnItemEntity> & {
	_imageFile?: File | null;
};

const emptyDraft = (): Draft => ({
	name: '',
	itemTypeId: '',
	quantityValue: 0,
	quantityUnit: 'g',
	proteinGrams: undefined,
	calories: undefined,
	pricing: { single: 0, weekly: 0, monthly: 0 },
	servings: { weekly: 5, monthly: 20 },
	displayOrder: 0,
	isActive: true,
	_imageFile: null,
});

export default function AdminBuildYourOwnItems() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<BuildYourOwnItemEntity[]>([]);
	const [types, setTypes] = useState<BuildYourOwnItemTypeEntity[]>([]);

	const [page, setPage] = useState(1);
	const [limit] = useState(DEFAULT_LIMIT);

	const [query, setQuery] = useState('');
	const debouncedQueryRef = useRef<number | null>(null);
	const [debouncedQuery, setDebouncedQuery] = useState('');

	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');
	const [typeFilter, setTypeFilter] = useState<string>('all');

	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<Draft>(emptyDraft());
	const [creating, setCreating] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editItem, setEditItem] = useState<BuildYourOwnItemEntity | null>(null);
	const [editDraft, setEditDraft] = useState<Draft>(emptyDraft());
	const [saving, setSaving] = useState(false);
	const [uploadingImage, setUploadingImage] = useState(false);

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

	const fetchTypes = useCallback(async () => {
		try {
			const res = await adminBuildYourOwnItemTypesService.list({ page: 1, limit: 200 });
			setTypes(res.data);
		} catch {
			// ignore
		}
	}, []);

	const fetchItems = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await adminBuildYourOwnItemsService.list({
				page,
				limit,
				q: debouncedQuery || undefined,
				isActive: activeFilterValue,
				itemTypeId: typeFilter !== 'all' ? typeFilter : undefined,
			});
			setItems(res.data);
			hasNextPage.current = res.meta.hasNextPage;
		} catch {
			setError('Failed to load Build-your-own items.');
		} finally {
			setLoading(false);
		}
	}, [page, limit, debouncedQuery, activeFilterValue, typeFilter]);

	useEffect(() => {
		fetchTypes();
		fetchItems();
	}, [fetchTypes, fetchItems]);

	const openEdit = (item: BuildYourOwnItemEntity) => {
		setEditItem(item);
		setEditDraft({
			name: item.name,
			itemTypeId: item.itemTypeId,
			quantityValue: item.quantityValue,
			quantityUnit: item.quantityUnit,
			proteinGrams: item.proteinGrams,
			calories: item.calories,
			pricing: item.pricing,
			servings: item.servings,
			displayOrder: item.displayOrder ?? 0,
			isActive: item.isActive ?? true,
			_imageFile: null,
		});
		setEditOpen(true);
	};

	const resetCreate = () => {
		setCreateDraft(emptyDraft());
		setCreateOpen(true);
	};

	const validateDraft = (draft: Draft, requireImage: boolean) => {
		if (!draft.name?.trim()) return 'Name is required';
		if (!draft.itemTypeId?.trim()) return 'Item Type is required';
		if (!draft.quantityUnit) return 'Quantity unit is required';
		if (!UNITS.includes(draft.quantityUnit as BuildYourOwnQuantityUnit)) return 'Invalid quantity unit';
		if (draft.quantityValue == null || Number(draft.quantityValue) <= 0) return 'Quantity value must be > 0';
		if (!draft.pricing) return 'Pricing is required';
		if ((draft.pricing.single ?? 0) <= 0) return 'Single price must be > 0';
		if ((draft.pricing.weekly ?? 0) <= 0) return 'Weekly price must be > 0';
		if ((draft.pricing.monthly ?? 0) <= 0) return 'Monthly price must be > 0';
		if (!draft.servings) return 'Servings are required';
		if ((draft.servings.weekly ?? 0) <= 0) return 'Weekly servings must be > 0';
		if ((draft.servings.monthly ?? 0) <= 0) return 'Monthly servings must be > 0';
		if (requireImage && !draft._imageFile) return 'Image is required';
		return null;
	};

	const submitCreate = async () => {
		const errMsg = validateDraft(createDraft, true);
		if (errMsg) {
			toast({ title: errMsg, variant: 'destructive' });
			return;
		}

		setCreating(true);
		try {
			const form = new FormData();
			form.append('image', createDraft._imageFile as File);
			form.append('name', String(createDraft.name));
			form.append('itemTypeId', String(createDraft.itemTypeId));
			form.append('quantityValue', String(createDraft.quantityValue));
			form.append('quantityUnit', String(createDraft.quantityUnit));
			form.append('displayOrder', String(createDraft.displayOrder ?? 0));
			form.append('isActive', String(Boolean(createDraft.isActive)));

			if (createDraft.proteinGrams != null) form.append('proteinGrams', String(createDraft.proteinGrams));
			if (createDraft.calories != null) form.append('calories', String(createDraft.calories));

			form.append('pricing[single]', String(createDraft.pricing?.single ?? 0));
			form.append('pricing[weekly]', String(createDraft.pricing?.weekly ?? 0));
			form.append('pricing[monthly]', String(createDraft.pricing?.monthly ?? 0));
			form.append('servings[weekly]', String(createDraft.servings?.weekly ?? 5));
			form.append('servings[monthly]', String(createDraft.servings?.monthly ?? 20));

			await adminBuildYourOwnItemsService.createWithImage(form);
			toast({ title: 'Item created' });
			setCreateOpen(false);
			await fetchItems();
		} catch (e) {
			toast({ title: 'Failed to create item', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
		} finally {
			setCreating(false);
		}
	};

	const submitEdit = async () => {
		if (!editItem) return;
		const errMsg = validateDraft(editDraft, false);
		if (errMsg) {
			toast({ title: errMsg, variant: 'destructive' });
			return;
		}
		setSaving(true);
		try {
			await adminBuildYourOwnItemsService.update(editItem.id, {
				name: editDraft.name,
				itemTypeId: editDraft.itemTypeId,
				quantityValue: Number(editDraft.quantityValue),
				quantityUnit: editDraft.quantityUnit as BuildYourOwnQuantityUnit,
				proteinGrams: editDraft.proteinGrams != null ? Number(editDraft.proteinGrams) : undefined,
				calories: editDraft.calories != null ? Number(editDraft.calories) : undefined,
				pricing: {
					single: Number(editDraft.pricing?.single ?? 0),
					weekly: Number(editDraft.pricing?.weekly ?? 0),
					monthly: Number(editDraft.pricing?.monthly ?? 0),
				},
				servings: {
					weekly: Number(editDraft.servings?.weekly ?? 5),
					monthly: Number(editDraft.servings?.monthly ?? 20),
				},
				displayOrder: Number(editDraft.displayOrder ?? 0),
				isActive: Boolean(editDraft.isActive),
			});

			toast({ title: 'Item updated' });
			setEditOpen(false);
			await fetchItems();
		} catch (e) {
			toast({ title: 'Failed to update item', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const submitDelete = async (id: string) => {
		try {
			await adminBuildYourOwnItemsService.softDelete(id);
			toast({ title: 'Item deactivated' });
			await fetchItems();
		} catch {
			toast({ title: 'Failed to deactivate item', variant: 'destructive' });
		}
	};

	const replaceImage = async (file: File) => {
		if (!editItem) return;
		setUploadingImage(true);
		try {
			await adminBuildYourOwnItemsService.uploadImage(editItem.id, file);
			toast({ title: 'Image updated' });
			await fetchItems();
		} catch (e) {
			toast({ title: 'Failed to upload image', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
		} finally {
			setUploadingImage(false);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
				<div className="flex gap-2">
					<Button variant="outline" onClick={fetchItems} disabled={loading}>
						<RefreshCw className="mr-2 h-4 w-4" /> Refresh
					</Button>
					<Button onClick={resetCreate}>
						<Plus className="mr-2 h-4 w-4" /> New
					</Button>
				</div>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Filters</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-4">
					<div className="relative md:col-span-2">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input placeholder="Search name..." className="pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
					</div>
					<div>
						<Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
							<SelectTrigger>
								<SelectValue placeholder="Filter by type" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All types</SelectItem>
								{types
									.filter((t) => (t.isActive ?? true))
									.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
									.map((t) => (
										<SelectItem key={t.id} value={t.id}>
											{t.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>
					</div>
					<div className="flex items-center justify-between rounded-md border p-3">
						<div className="text-sm">
							<div className="font-medium">Active only</div>
							<div className="text-muted-foreground">Show active items</div>
						</div>
						<Switch checked={activeFilter === 'active'} onCheckedChange={(v) => setActiveFilter(v ? 'active' : 'all')} />
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Items</CardTitle>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-2">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</div>
					) : error ? (
						<div className="text-sm text-red-600">{error}</div>
					) : items.length === 0 ? (
						<div className="text-sm text-muted-foreground">No items found.</div>
					) : (
						<div className="space-y-2">
							{items.map((m) => (
								<div key={m.id} className="flex items-center justify-between rounded-md border p-3 gap-3">
									<div className="flex items-center gap-3 min-w-0">
										<div className="h-12 w-12 rounded-md border bg-oz-neutral/10 overflow-hidden flex items-center justify-center flex-shrink-0">
											{m.image?.url ? (
												<img src={m.image.url} alt={m.name} className="h-full w-full object-cover" />
											) : (
												<ImageIcon className="h-5 w-5 text-muted-foreground" />
											)}
										</div>
										<div className="min-w-0">
											<div className="font-medium truncate">{m.name}</div>
											<div className="text-xs text-muted-foreground truncate">
												{m.itemTypeRef?.name || '—'} • {m.quantityValue}{m.quantityUnit} • single ₹{m.pricing.single}
											</div>
										</div>
									</div>
									<div className="flex items-center gap-2">
										<div className="text-xs text-muted-foreground">{m.isActive ? 'Active' : 'Inactive'}</div>
										<Button variant="outline" size="sm" onClick={() => openEdit(m)}>
											<Pencil className="h-4 w-4" />
										</Button>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button variant="destructive" size="sm">
													<Trash2 className="h-4 w-4" />
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Deactivate item?</AlertDialogTitle>
													<AlertDialogDescription>
														It will be hidden from user selection.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction onClick={() => submitDelete(m.id)}>Deactivate</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
							))}
						</div>
					)}

					<div className="mt-4 flex items-center justify-between rounded-md border p-3">
						<div className="text-sm">
							<div className="font-medium">Page</div>
							<div className="text-muted-foreground">
								{page} {hasNextPage.current ? '(more available)' : ''}
							</div>
						</div>
						<div className="flex gap-2">
							<Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
								Prev
							</Button>
							<Button variant="outline" size="sm" disabled={!hasNextPage.current || loading} onClick={() => setPage((p) => p + 1)}>
								Next
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>New Build-your-own Item</DialogTitle>
						<DialogDescription>Creates an ingredient with single/weekly/monthly pricing (no trial).</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 md:grid-cols-2">
						<div className="grid gap-2 md:col-span-2">
							<Label>Name</Label>
							<Input value={createDraft.name || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} />
						</div>

						<div className="grid gap-2">
							<Label>Item Type</Label>
							<Select value={createDraft.itemTypeId || ''} onValueChange={(v) => setCreateDraft((d) => ({ ...d, itemTypeId: v }))}>
								<SelectTrigger>
									<SelectValue placeholder="Select type" />
								</SelectTrigger>
								<SelectContent>
									{types
										.filter((t) => (t.isActive ?? true))
										.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
										.map((t) => (
											<SelectItem key={t.id} value={t.id}>
												{t.name}
											</SelectItem>
										))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label>Display Order</Label>
							<Input type="number" value={String(createDraft.displayOrder ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
						</div>

						<div className="grid gap-2">
							<Label>Quantity Value</Label>
							<Input type="number" value={String(createDraft.quantityValue ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, quantityValue: Number(e.target.value) || 0 }))} />
						</div>
						<div className="grid gap-2">
							<Label>Quantity Unit</Label>
							<Select value={(createDraft.quantityUnit || 'g') as string} onValueChange={(v) => setCreateDraft((d) => ({ ...d, quantityUnit: v as BuildYourOwnQuantityUnit }))}>
								<SelectTrigger>
									<SelectValue placeholder="Select unit" />
								</SelectTrigger>
								<SelectContent>
									{UNITS.map((u) => (
										<SelectItem key={u} value={u}>
											{u}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid gap-2">
							<Label>Protein (g) (optional)</Label>
							<Input type="number" value={createDraft.proteinGrams == null ? '' : String(createDraft.proteinGrams)} onChange={(e) => setCreateDraft((d) => ({ ...d, proteinGrams: e.target.value === '' ? undefined : Number(e.target.value) }))} />
						</div>
						<div className="grid gap-2">
							<Label>Calories (optional)</Label>
							<Input type="number" value={createDraft.calories == null ? '' : String(createDraft.calories)} onChange={(e) => setCreateDraft((d) => ({ ...d, calories: e.target.value === '' ? undefined : Number(e.target.value) }))} />
						</div>

						<div className="grid gap-2">
							<Label>Single Price</Label>
							<Input type="number" value={String(createDraft.pricing?.single ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), single: Number(e.target.value) || 0 } }))} />
						</div>
						<div className="grid gap-2">
							<Label>Weekly Price</Label>
							<Input type="number" value={String(createDraft.pricing?.weekly ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), weekly: Number(e.target.value) || 0 } }))} />
						</div>
						<div className="grid gap-2">
							<Label>Monthly Price</Label>
							<Input type="number" value={String(createDraft.pricing?.monthly ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), monthly: Number(e.target.value) || 0 } }))} />
						</div>

						<div className="grid gap-2">
							<Label>Weekly servings count</Label>
							<Input type="number" value={String(createDraft.servings?.weekly ?? 5)} onChange={(e) => setCreateDraft((d) => ({ ...d, servings: { ...(d.servings || { weekly: 5, monthly: 20 }), weekly: Number(e.target.value) || 0 } }))} />
						</div>
						<div className="grid gap-2">
							<Label>Monthly servings count</Label>
							<Input type="number" value={String(createDraft.servings?.monthly ?? 20)} onChange={(e) => setCreateDraft((d) => ({ ...d, servings: { ...(d.servings || { weekly: 5, monthly: 20 }), monthly: Number(e.target.value) || 0 } }))} />
						</div>

						<div className="grid gap-2 md:col-span-2">
							<Label>Image (required)</Label>
							<Input type="file" accept="image/*" onChange={(e) => setCreateDraft((d) => ({ ...d, _imageFile: e.target.files?.[0] || null }))} />
							<p className="text-xs text-muted-foreground">One image per item (Cloudinary).</p>
						</div>

						<div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
							<div className="text-sm">
								<div className="font-medium">Active</div>
								<div className="text-muted-foreground">Controls user visibility</div>
							</div>
							<Switch checked={Boolean(createDraft.isActive)} onCheckedChange={(v) => setCreateDraft((d) => ({ ...d, isActive: v }))} />
						</div>
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
						<Button onClick={submitCreate} disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Edit Item</DialogTitle>
						<DialogDescription>Update fields and optionally replace the image.</DialogDescription>
					</DialogHeader>

					{editItem ? (
						<div className="grid gap-4 md:grid-cols-2">
							<div className="grid gap-2 md:col-span-2">
								<Label>Name</Label>
								<Input value={editDraft.name || ''} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
							</div>

							<div className="grid gap-2">
								<Label>Item Type</Label>
								<Select value={editDraft.itemTypeId || ''} onValueChange={(v) => setEditDraft((d) => ({ ...d, itemTypeId: v }))}>
									<SelectTrigger>
										<SelectValue placeholder="Select type" />
									</SelectTrigger>
									<SelectContent>
										{types
											.filter((t) => (t.isActive ?? true))
											.sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
											.map((t) => (
												<SelectItem key={t.id} value={t.id}>
													{t.name}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label>Display Order</Label>
								<Input type="number" value={String(editDraft.displayOrder ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
							</div>

							<div className="grid gap-2">
								<Label>Quantity Value</Label>
								<Input type="number" value={String(editDraft.quantityValue ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, quantityValue: Number(e.target.value) || 0 }))} />
							</div>
							<div className="grid gap-2">
								<Label>Quantity Unit</Label>
								<Select value={(editDraft.quantityUnit || 'g') as string} onValueChange={(v) => setEditDraft((d) => ({ ...d, quantityUnit: v as BuildYourOwnQuantityUnit }))}>
									<SelectTrigger>
										<SelectValue placeholder="Select unit" />
									</SelectTrigger>
									<SelectContent>
										{UNITS.map((u) => (
											<SelectItem key={u} value={u}>
												{u}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div className="grid gap-2">
								<Label>Protein (g) (optional)</Label>
								<Input type="number" value={editDraft.proteinGrams == null ? '' : String(editDraft.proteinGrams)} onChange={(e) => setEditDraft((d) => ({ ...d, proteinGrams: e.target.value === '' ? undefined : Number(e.target.value) }))} />
							</div>
							<div className="grid gap-2">
								<Label>Calories (optional)</Label>
								<Input type="number" value={editDraft.calories == null ? '' : String(editDraft.calories)} onChange={(e) => setEditDraft((d) => ({ ...d, calories: e.target.value === '' ? undefined : Number(e.target.value) }))} />
							</div>

							<div className="grid gap-2">
								<Label>Single Price</Label>
								<Input type="number" value={String(editDraft.pricing?.single ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), single: Number(e.target.value) || 0 } }))} />
							</div>
							<div className="grid gap-2">
								<Label>Weekly Price</Label>
								<Input type="number" value={String(editDraft.pricing?.weekly ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), weekly: Number(e.target.value) || 0 } }))} />
							</div>
							<div className="grid gap-2">
								<Label>Monthly Price</Label>
								<Input type="number" value={String(editDraft.pricing?.monthly ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, pricing: { ...(d.pricing || { single: 0, weekly: 0, monthly: 0 }), monthly: Number(e.target.value) || 0 } }))} />
							</div>

							<div className="grid gap-2">
								<Label>Weekly servings count</Label>
								<Input type="number" value={String(editDraft.servings?.weekly ?? 5)} onChange={(e) => setEditDraft((d) => ({ ...d, servings: { ...(d.servings || { weekly: 5, monthly: 20 }), weekly: Number(e.target.value) || 0 } }))} />
							</div>
							<div className="grid gap-2">
								<Label>Monthly servings count</Label>
								<Input type="number" value={String(editDraft.servings?.monthly ?? 20)} onChange={(e) => setEditDraft((d) => ({ ...d, servings: { ...(d.servings || { weekly: 5, monthly: 20 }), monthly: Number(e.target.value) || 0 } }))} />
							</div>

							<div className="grid gap-2 md:col-span-2">
								<Label>Replace image</Label>
								<Input type="file" accept="image/*" disabled={uploadingImage} onChange={(e) => {
									const file = e.target.files?.[0];
									if (file) replaceImage(file);
								}} />
								<p className="text-xs text-muted-foreground">Current image is shown in the list. Upload replaces it.</p>
							</div>

							<div className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
								<div className="text-sm">
									<div className="font-medium">Active</div>
									<div className="text-muted-foreground">Controls user visibility</div>
								</div>
								<Switch checked={Boolean(editDraft.isActive)} onCheckedChange={(v) => setEditDraft((d) => ({ ...d, isActive: v }))} />
							</div>
						</div>
					) : null}

					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving || uploadingImage}>Cancel</Button>
						<Button onClick={submitEdit} disabled={saving || uploadingImage}>{saving ? 'Saving…' : 'Save'}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
