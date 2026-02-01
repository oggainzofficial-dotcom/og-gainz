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
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
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
				<DialogContent>
					<DialogHeader>
						<DialogTitle>New Item Type</DialogTitle>
						<DialogDescription>Create a new category for Build-your-own items.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label>Name</Label>
							<Input value={createDraft.name || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Display Order</Label>
							<Input type="number" value={String(createDraft.displayOrder ?? 0)} onChange={(e) => setCreateDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
							<p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
						<Button onClick={submitCreate} disabled={creating}>{creating ? 'Creating...' : 'Create'}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={editOpen} onOpenChange={setEditOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Item Type</DialogTitle>
						<DialogDescription>Update the category fields.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label>Name</Label>
							<Input value={editDraft.name || ''} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Display Order</Label>
							<Input type="number" value={String(editDraft.displayOrder ?? 0)} onChange={(e) => setEditDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))} />
							<p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
						</div>
						<div className="grid gap-2">
							<Label>Slug</Label>
							<Input value={editDraft.slug || ''} disabled />
							<p className="text-xs text-muted-foreground">Slug is auto-generated from the name.</p>
						</div>
						<div className="flex items-center justify-between rounded-md border p-3">
							<div className="text-sm">
								<div className="font-medium">Active</div>
								<div className="text-muted-foreground">Controls user visibility</div>
							</div>
							<Switch checked={Boolean(editDraft.isActive)} onCheckedChange={(v) => setEditDraft((d) => ({ ...d, isActive: v }))} />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
						<Button onClick={submitEdit} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
