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
import { adminIncludedItemsService } from '@/services/adminIncludedItemsService';
import type { IncludedItemEntity, IncludedItemUnit } from '@/types/catalog';

type ActiveFilter = 'all' | 'active' | 'inactive';

const DEFAULT_LIMIT = 100;

const UNITS: IncludedItemUnit[] = ['g', 'kg', 'ml', 'l', 'pieces', 'pcs'];

const emptyDraft = (): Partial<IncludedItemEntity> => ({
	name: '',
	slug: '',
	unitType: '',
	defaultUnit: 'g',
	displayOrder: 0,
	isActive: true,
});

export default function AdminIncludedItems() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [items, setItems] = useState<IncludedItemEntity[]>([]);

	const [page, setPage] = useState(1);
	const [limit] = useState(DEFAULT_LIMIT);

	const [query, setQuery] = useState('');
	const debouncedQueryRef = useRef<number | null>(null);
	const [debouncedQuery, setDebouncedQuery] = useState('');

	const [activeFilter, setActiveFilter] = useState<ActiveFilter>('all');

	const [createOpen, setCreateOpen] = useState(false);
	const [createDraft, setCreateDraft] = useState<Partial<IncludedItemEntity>>(emptyDraft());
	const [creating, setCreating] = useState(false);

	const [editOpen, setEditOpen] = useState(false);
	const [editItem, setEditItem] = useState<IncludedItemEntity | null>(null);
	const [editDraft, setEditDraft] = useState<Partial<IncludedItemEntity>>(emptyDraft());
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

	const fetchItems = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await adminIncludedItemsService.list({
				page,
				limit,
				q: debouncedQuery || undefined,
				isActive: activeFilterValue,
			});
			setItems(res.data);
			hasNextPage.current = res.meta.hasNextPage;
		} catch {
			setError('Failed to load included items.');
		} finally {
			setLoading(false);
		}
	}, [page, limit, debouncedQuery, activeFilterValue]);

	useEffect(() => {
		fetchItems();
	}, [fetchItems]);

	const openEdit = (item: IncludedItemEntity) => {
		setEditItem(item);
		setEditDraft({
			name: item.name,
			slug: item.slug,
			unitType: item.unitType || '',
			defaultUnit: item.defaultUnit,
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
			await adminIncludedItemsService.create(createDraft);
			toast({ title: 'Included item created' });
			setCreateOpen(false);
			await fetchItems();
		} catch {
			toast({ title: 'Failed to create included item', variant: 'destructive' });
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
			await adminIncludedItemsService.update(editItem.id, editDraft);
			toast({ title: 'Included item updated' });
			setEditOpen(false);
			await fetchItems();
		} catch {
			toast({ title: 'Failed to update included item', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	const submitDelete = async (id: string) => {
		try {
			await adminIncludedItemsService.softDelete(id);
			toast({ title: 'Included item deactivated' });
			await fetchItems();
		} catch {
			toast({ title: 'Failed to deactivate included item', variant: 'destructive' });
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
							<div className="text-muted-foreground">Show active items</div>
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
					<CardTitle>Included Items</CardTitle>
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
						<div className="text-sm text-muted-foreground">No included items found.</div>
					) : (
						<div className="space-y-2">
							{items.map((m) => (
								<div key={m.id} className="flex items-center justify-between rounded-md border p-3">
									<div className="min-w-0">
										<div className="font-medium truncate">{m.name}</div>
										<div className="text-xs text-muted-foreground truncate">
											{m.slug} • default: {m.defaultUnit}
											{m.unitType ? ` • ${m.unitType}` : ''}
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
													<AlertDialogTitle>Deactivate included item?</AlertDialogTitle>
													<AlertDialogDescription>
														It will be hidden from selection lists, but existing meals can still reference it.
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
						<DialogTitle>New Included Item</DialogTitle>
						<DialogDescription>Create a new included item used by meals.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label>Name</Label>
							<Input value={createDraft.name || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, name: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Display Order</Label>
							<Input
								type="number"
								value={String(createDraft.displayOrder ?? 0)}
								onChange={(e) => setCreateDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))}
							/>
							<p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
						</div>
						<div className="grid gap-2">
							<Label>Slug (optional)</Label>
							<Input value={createDraft.slug || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, slug: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Default Unit</Label>
							<Select
								value={(createDraft.defaultUnit || 'g') as string}
								onValueChange={(v) => setCreateDraft((d) => ({ ...d, defaultUnit: v as IncludedItemUnit }))}
							>
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
							<Label>Unit Type (optional)</Label>
							<Input value={createDraft.unitType || ''} onChange={(e) => setCreateDraft((d) => ({ ...d, unitType: e.target.value }))} />
						</div>
						<div className="flex items-center justify-between rounded-md border p-3">
							<div className="text-sm">
								<div className="font-medium">Active</div>
								<div className="text-muted-foreground">Controls visibility in selection lists</div>
							</div>
							<Switch checked={Boolean(createDraft.isActive)} onCheckedChange={(v) => setCreateDraft((d) => ({ ...d, isActive: v }))} />
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
						<DialogTitle>Edit Included Item</DialogTitle>
						<DialogDescription>Update the included item fields.</DialogDescription>
					</DialogHeader>
					<div className="grid gap-4">
						<div className="grid gap-2">
							<Label>Name</Label>
							<Input value={editDraft.name || ''} onChange={(e) => setEditDraft((d) => ({ ...d, name: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Display Order</Label>
							<Input
								type="number"
								value={String(editDraft.displayOrder ?? 0)}
								onChange={(e) => setEditDraft((d) => ({ ...d, displayOrder: Number(e.target.value) || 0 }))}
							/>
							<p className="text-xs text-muted-foreground">Lower numbers appear first.</p>
						</div>
						<div className="grid gap-2">
							<Label>Slug</Label>
							<Input value={editDraft.slug || ''} onChange={(e) => setEditDraft((d) => ({ ...d, slug: e.target.value }))} />
						</div>
						<div className="grid gap-2">
							<Label>Default Unit</Label>
							<Select
								value={(editDraft.defaultUnit || 'g') as string}
								onValueChange={(v) => setEditDraft((d) => ({ ...d, defaultUnit: v as IncludedItemUnit }))}
							>
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
							<Label>Unit Type (optional)</Label>
							<Input value={editDraft.unitType || ''} onChange={(e) => setEditDraft((d) => ({ ...d, unitType: e.target.value }))} />
						</div>
						<div className="flex items-center justify-between rounded-md border p-3">
							<div className="text-sm">
								<div className="font-medium">Active</div>
								<div className="text-muted-foreground">Controls visibility in selection lists</div>
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
