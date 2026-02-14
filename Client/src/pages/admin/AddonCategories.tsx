import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Trash2, Pencil, Tags } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Textarea } from '@/components/ui/textarea';
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
import { adminAddonCategoriesService } from '@/services/adminAddonCategoriesService';
import type { AddonCategoryEntity } from '@/types/catalog';
import { AdminFormLayout, ADMIN_FORM_GRID, FormField } from '@/components/admin';

type ActiveFilter = 'all' | 'active' | 'inactive';

const DEFAULT_LIMIT = 50;

const safeNumber = (value: string) => {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
};

const emptyDraft = (): Partial<AddonCategoryEntity> => ({
	name: '',
	slug: '',
	description: '',
	displayOrder: 0,
	isActive: true,
});

export default function AdminAddonCategories() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<AddonCategoryEntity[]>([]);

	const [page, setPage] = useState(1);
	const [limit] = useState(DEFAULT_LIMIT);

	const [query, setQuery] = useState('');
	const debouncedQueryRef = useRef<number | null>(null);
	const [debouncedQuery, setDebouncedQuery] = useState('');

	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active');

	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<Partial<AddonCategoryEntity>>(emptyDraft());
	const [creating, setCreating] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editItem, setEditItem] = useState<AddonCategoryEntity | null>(null);
	const [editDraft, setEditDraft] = useState<Partial<AddonCategoryEntity>>(emptyDraft());
	const [saving, setSaving] = useState(false);

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

	const fetchCategories = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await adminAddonCategoriesService.list({
				page,
				limit,
				q: debouncedQuery || undefined,
				isActive: activeFilterValue,
			});
			setItems(res.data);
			hasNextPage.current = res.meta.hasNextPage;
		} catch {
			setError('Failed to load add-on categories.');
		} finally {
			setLoading(false);
		}
	}, [page, limit, debouncedQuery, activeFilterValue]);

	useEffect(() => {
		fetchCategories();
	}, [fetchCategories]);

	const openEdit = (item: AddonCategoryEntity) => {
		setEditItem(item);
		setEditDraft({
			name: item.name,
			slug: item.slug,
			description: item.description || '',
			displayOrder: item.displayOrder,
			isActive: item.isActive,
		});
		setEditOpen(true);
	};

	const resetCreate = () => {
		setCreateDraft(emptyDraft());
		setCreateOpen(true);
	};

	const submitCreate = async () => {
		if (!createDraft.name?.trim()) {
			toast({ title: 'Name is required', variant: 'destructive' });
			return;
		}
		setCreating(true);
		try {
			await adminAddonCategoriesService.create(createDraft);
			toast({ title: 'Add-on category created' });
			setCreateOpen(false);
			await fetchCategories();
		} catch {
			toast({ title: 'Failed to create add-on category', variant: 'destructive' });
		} finally {
			setCreating(false);
		}
	};

	const submitEdit = async () => {
		if (!editItem) return;
		if (!editDraft.name?.trim()) {
			toast({ title: 'Name is required', variant: 'destructive' });
			return;
		}
		setSaving(true);
		try {
			await adminAddonCategoriesService.update(editItem.id, editDraft);
			toast({ title: 'Add-on category updated' });
			setEditOpen(false);
			await fetchCategories();
		} catch {
			toast({ title: 'Failed to update add-on category', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const submitDelete = async (id: string) => {
		try {
			await adminAddonCategoriesService.hardDelete(id);
			setItems((prev) => prev.filter((c) => c.id !== id));
			toast({ title: 'Add-on category deleted permanently' });
			await fetchCategories();
		} catch {
			toast({ title: 'Failed to delete add-on category', variant: 'destructive' });
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
				<div className="flex gap-2">
					<Button variant="outline" onClick={fetchCategories} disabled={loading}>
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
				<CardContent className="grid gap-3 md:grid-cols-3">
					<div className="relative">
						<Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search name or slug..."
							className="pl-8"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
					</div>
					<div className="flex items-center justify-between rounded-md border p-3">
						<div className="text-sm">
							<div className="font-medium">Active only</div>
							<div className="text-muted-foreground">Show active categories</div>
						</div>
						<Switch
							checked={activeFilter === 'active'}
							onCheckedChange={(v) => setActiveFilter(v ? 'active' : 'all')}
						/>
					</div>
					<div className="flex items-center justify-between rounded-md border p-3">
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
							<Button
								variant="outline"
								size="sm"
								disabled={!hasNextPage.current || loading}
								onClick={() => setPage((p) => p + 1)}
							>
								Next
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Categories</CardTitle>
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
						<div className="text-sm text-muted-foreground">No categories found.</div>
					) : (
						<div className="space-y-2">
							{items.map((item) => (
								<div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
									<div className="min-w-0">
										<div className="font-medium truncate">{item.name}</div>
										<div className="text-xs text-muted-foreground truncate">{item.slug}</div>
										{item.description ? <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</div> : null}
									</div>
									<div className="flex items-center gap-2">
										<Button variant="outline" size="sm" onClick={() => openEdit(item)}>
											<Pencil className="mr-2 h-4 w-4" /> Edit
										</Button>
										<AlertDialog>
											<AlertDialogTrigger asChild>
												<Button variant="destructive" size="sm">
													<Trash2 className="mr-2 h-4 w-4" /> Delete
												</Button>
											</AlertDialogTrigger>
											<AlertDialogContent>
												<AlertDialogHeader>
													<AlertDialogTitle>Delete category?</AlertDialogTitle>
													<AlertDialogDescription>
														This will permanently delete this category from the database.
													</AlertDialogDescription>
												</AlertDialogHeader>
												<AlertDialogFooter>
													<AlertDialogCancel>Cancel</AlertDialogCancel>
													<AlertDialogAction onClick={() => submitDelete(item.id)}>Delete</AlertDialogAction>
												</AlertDialogFooter>
											</AlertDialogContent>
										</AlertDialog>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Create Dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-5xl p-0">
					<DialogHeader>
						<VisuallyHidden>
							<DialogTitle>New Add-on Category</DialogTitle>
						</VisuallyHidden>
						<VisuallyHidden>
							<DialogDescription>Create a new category for add-ons.</DialogDescription>
						</VisuallyHidden>
					</DialogHeader>
					<AdminFormLayout
						title="New Add-on Category"
						description="Create a new category for add-ons."
						stickyActions
						actions={
							<>
								<Button variant="outline" className="h-11 rounded-xl" onClick={() => setCreateOpen(false)} disabled={creating}>
									Cancel
								</Button>
								<Button className="h-11 rounded-xl" onClick={submitCreate} disabled={creating || !createDraft.name?.trim()}>
									{creating ? 'Creating…' : 'Create'}
								</Button>
							</>
						}
					>
						<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
							<div className={ADMIN_FORM_GRID}>
								<FormField label="Name" required>
									<Input value={String(createDraft.name || '')} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} />
								</FormField>
								<FormField label="Slug (optional)">
									<Input value={String(createDraft.slug || '')} onChange={(e) => setCreateDraft((d) => ({ ...d, slug: e.target.value }))} placeholder="auto-generated if blank" />
								</FormField>
								<FormField label="Description (optional)" className="md:col-span-2">
									<Textarea value={String(createDraft.description || '')} onChange={(e) => setCreateDraft((d) => ({ ...d, description: e.target.value }))} className="min-h-[120px]" />
								</FormField>
								<FormField label="Display order">
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
								<FormField label="Status" applyInputStyles={false}>
									<div className="flex h-11 items-center justify-between rounded-xl border px-4">
										<span className="text-sm">Active</span>
										<Switch checked={Boolean(createDraft.isActive)} onCheckedChange={(checked) => setCreateDraft((d) => ({ ...d, isActive: checked }))} />
									</div>
								</FormField>
							</div>
						</div>
					</AdminFormLayout>
				</DialogContent>
			</Dialog>

			{/* Edit Dialog */}
			<Dialog open={editOpen} onOpenChange={(open) => {
				setEditOpen(open);
				if (!open) setEditItem(null);
			}}>
				<DialogContent className="max-w-5xl p-0">
					<DialogHeader>
						<VisuallyHidden>
							<DialogTitle>Edit Add-on Category</DialogTitle>
						</VisuallyHidden>
						<VisuallyHidden>
							<DialogDescription>Update category details.</DialogDescription>
						</VisuallyHidden>
					</DialogHeader>
					<AdminFormLayout
						title="Edit Add-on Category"
						description="Update category details."
						stickyActions
						actions={
							<>
								<Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditOpen(false)} disabled={saving}>
									Close
								</Button>
								<Button className="h-11 rounded-xl" onClick={submitEdit} disabled={!editItem || saving || !editDraft.name?.trim()}>
									{saving ? 'Saving…' : 'Save'}
								</Button>
							</>
						}
					>
						{!editItem ? (
							<div className="p-6">
								<Skeleton className="h-32 w-full rounded-xl" />
							</div>
						) : (
							<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
								<div className={ADMIN_FORM_GRID}>
									<FormField label="Name" required>
										<Input value={String(editDraft.name || '')} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
									</FormField>
									<FormField label="Slug">
										<Input value={String(editDraft.slug || '')} onChange={(e) => setEditDraft((d) => ({ ...d, slug: e.target.value }))} />
									</FormField>
									<FormField label="Description (optional)" className="md:col-span-2">
										<Textarea value={String(editDraft.description || '')} onChange={(e) => setEditDraft((d) => ({ ...d, description: e.target.value }))} className="min-h-[120px]" />
									</FormField>
									<FormField label="Display order">
										<Input
											type="number"
											value={editDraft.displayOrder == null ? '' : String(editDraft.displayOrder)}
											onChange={(e) => {
												const v = e.target.value;
												setEditDraft((d) => ({ ...d, displayOrder: v === '' ? undefined : safeNumber(v) }));
											}}
											min={0}
										/>
									</FormField>
									<FormField label="Status" applyInputStyles={false}>
										<div className="flex h-11 items-center justify-between rounded-xl border px-4">
											<span className="text-sm">Active</span>
											<Switch checked={Boolean(editDraft.isActive)} onCheckedChange={(checked) => setEditDraft((d) => ({ ...d, isActive: checked }))} />
										</div>
									</FormField>
								</div>
							</div>
						)}
					</AdminFormLayout>
				</DialogContent>
			</Dialog>
		</div>
	);
}
