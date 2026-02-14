import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Search, Trash2, Pencil } from 'lucide-react';
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
import { adminBuildYourOwnItemTypesService } from '@/services/adminBuildYourOwnItemTypesService';
import type { BuildYourOwnItemTypeEntity } from '@/types/buildYourOwn';
import { AdminFormLayout, ADMIN_FORM_GRID, FormField } from '@/components/admin';

type ActiveFilter = 'all' | 'active' | 'inactive';

const DEFAULT_LIMIT = 50;

const emptyDraft = (): Partial<BuildYourOwnItemTypeEntity> => ({
	name: '',
	displayOrder: 0,
	isActive: true,
});

export default function AdminBuildYourOwnItemTypes() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<BuildYourOwnItemTypeEntity[]>([]);

	const [page, setPage] = useState(1);
	const [limit] = useState(DEFAULT_LIMIT);

	const [query, setQuery] = useState('');
	const debouncedQueryRef = useRef<number | null>(null);
	const [debouncedQuery, setDebouncedQuery] = useState('');

	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<Partial<BuildYourOwnItemTypeEntity>>(emptyDraft());
	const [creating, setCreating] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editItem, setEditItem] = useState<BuildYourOwnItemTypeEntity | null>(null);
	const [editDraft, setEditDraft] = useState<Partial<BuildYourOwnItemTypeEntity>>(emptyDraft());
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

	const fetchItemTypes = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await adminBuildYourOwnItemTypesService.list({
				page,
				limit,
				q: debouncedQuery || undefined,
				isActive: activeFilterValue,
			});
			setItems(res.data);
			hasNextPage.current = res.meta.hasNextPage;
		} catch {
			setError('Failed to load Build-your-own item types.');
		} finally {
			setLoading(false);
		}
	}, [page, limit, debouncedQuery, activeFilterValue]);

	useEffect(() => {
		fetchItemTypes();
	}, [fetchItemTypes]);

	const openEdit = (item: BuildYourOwnItemTypeEntity) => {
		setEditItem(item);
		setEditDraft({
			name: item.name,
			slug: item.slug,
			displayOrder: item.displayOrder,
			isActive: item.isActive ?? true,
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
			await adminBuildYourOwnItemTypesService.create(createDraft);
			toast({ title: 'Item type created' });
			setCreateOpen(false);
			await fetchItemTypes();
		} catch {
			toast({ title: 'Failed to create item type', variant: 'destructive' });
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
			await adminBuildYourOwnItemTypesService.update(editItem.id, editDraft);
			toast({ title: 'Item type updated' });
			setEditOpen(false);
			await fetchItemTypes();
		} catch {
			toast({ title: 'Failed to update item type', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const submitDelete = async (id: string) => {
		try {
			await adminBuildYourOwnItemTypesService.softDelete(id);
			toast({ title: 'Item type deactivated' });
			await fetchItemTypes();
		} catch {
			toast({ title: 'Failed to deactivate item type', variant: 'destructive' });
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-end">
				<div className="flex gap-2">
					<Button variant="outline" onClick={fetchItemTypes} disabled={loading}>
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
							<div className="text-muted-foreground">Show active item types</div>
						</div>
						<Switch checked={activeFilter === 'active'} onCheckedChange={(v) => setActiveFilter(v ? 'active' : 'all')} />
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
							<Button variant="outline" size="sm" disabled={!hasNextPage.current || loading} onClick={() => setPage((p) => p + 1)}>
								Next
							</Button>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Item Types</CardTitle>
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
						<div className="text-sm text-muted-foreground">No item types found.</div>
					) : (
						<div className="space-y-2">
							{items.map((m) => (
								<div key={m.id} className="flex items-center justify-between rounded-md border p-3">
									<div className="min-w-0">
										<div className="font-medium truncate">{m.name}</div>
										<div className="text-xs text-muted-foreground truncate">{m.slug} • order: {m.displayOrder}</div>
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
													<AlertDialogTitle>Deactivate item type?</AlertDialogTitle>
													<AlertDialogDescription>
														This hides the category on the user Build-your-own page.
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
				</CardContent>
			</Card>

			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-w-5xl p-0">
					<DialogHeader>
						<VisuallyHidden>
							<DialogTitle>New Item Type</DialogTitle>
						</VisuallyHidden>
						<VisuallyHidden>
							<DialogDescription>Create a new category for Build-your-own items.</DialogDescription>
						</VisuallyHidden>
					</DialogHeader>
					<AdminFormLayout
						title="New Item Type"
						description="Create a new category for Build-your-own items."
						stickyActions
						actions={
							<>
								<Button variant="outline" className="h-11 rounded-xl" onClick={() => setCreateOpen(false)} disabled={creating}>
									Cancel
								</Button>
								<Button className="h-11 rounded-xl" onClick={submitCreate} disabled={creating}>
									{creating ? 'Creating...' : 'Create'}
								</Button>
							</>
						}
					>
						<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
							<div className={ADMIN_FORM_GRID}>
								<FormField label="Name" required>
									<Input value={createDraft.name || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} />
								</FormField>
								<FormField label="Display order" hint="Lower numbers appear first.">
									<Input type="number" value={String(createDraft.displayOrder ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
								</FormField>
							</div>
						</div>
					</AdminFormLayout>
				</DialogContent>
			</Dialog>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent className="max-w-5xl p-0">
					<DialogHeader>
						<VisuallyHidden>
							<DialogTitle>Edit Item Type</DialogTitle>
						</VisuallyHidden>
						<VisuallyHidden>
							<DialogDescription>Update the category fields.</DialogDescription>
						</VisuallyHidden>
					</DialogHeader>
					<AdminFormLayout
						title="Edit Item Type"
						description="Update the category fields."
						stickyActions
						actions={
							<>
								<Button variant="outline" className="h-11 rounded-xl" onClick={() => setEditOpen(false)} disabled={saving}>
									Cancel
								</Button>
								<Button className="h-11 rounded-xl" onClick={submitEdit} disabled={saving}>
									{saving ? 'Saving...' : 'Save'}
								</Button>
							</>
						}
					>
						<div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
							<div className={ADMIN_FORM_GRID}>
								<FormField label="Name" required>
									<Input value={editDraft.name || ''} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
								</FormField>
								<FormField label="Display order" hint="Lower numbers appear first.">
									<Input type="number" value={String(editDraft.displayOrder ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
								</FormField>
								<FormField label="Slug" hint="Slug is auto-generated from the name.">
									<Input value={editDraft.slug || ''} disabled />
								</FormField>
								<FormField label="Status" applyInputStyles={false}>
									<div className="flex h-11 items-center justify-between rounded-xl border px-4">
										<div className="text-sm text-muted-foreground">Controls user visibility</div>
										<Switch checked={Boolean(editDraft.isActive)} onCheckedChange={(v) => setEditDraft((d) => ({ ...d, isActive: v }))} />
									</div>
								</FormField>
							</div>
						</div>
					</AdminFormLayout>
				</DialogContent>
			</Dialog>
		</div>
	);
}
