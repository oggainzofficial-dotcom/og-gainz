import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShieldBan, ShieldCheck } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
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
import { adminUsersService, type AdminUserListItem } from '@/services/adminUsersService';
import { formatCurrency } from '@/utils/formatCurrency';

const safeString = (v: unknown) => String(v || '').trim();

const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

export default function Users() {
	const navigate = useNavigate();
	const { toast } = useToast();

	const [items, setItems] = useState<AdminUserListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit] = useState(20);
	const [total, setTotal] = useState(0);
	const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'blocked'>('all');
	const [search, setSearch] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [actionUserId, setActionUserId] = useState<string | null>(null);

	useEffect(() => {
		const t = window.setTimeout(() => setSearch(searchInput), 250);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminUsersService
			.list({ page, limit, status: statusFilter, search, signal: controller.signal })
			.then((res) => {
				setItems(res.items || []);
				setTotal(res.meta?.total || 0);
			})
			.catch((e: unknown) => {
				const msg = safeString((e as { message?: unknown })?.message || e) || 'Failed to load users';
				if (msg.toLowerCase().includes('authentication required') || msg.toLowerCase().includes('unauthorized')) {
					navigate('/login', { replace: true, state: { from: '/admin/users' } });
					return;
				}
				setError(msg);
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [page, limit, statusFilter, search, navigate]);

	const totalPages = Math.max(1, Math.ceil(total / limit));
	const hasPrev = page > 1;
	const hasNext = page < totalPages;

	const filtered = useMemo(() => {
		const q = searchInput.trim().toLowerCase();
		if (!q) return items;
		return items.filter((u) => {
			const name = safeString(u.name).toLowerCase();
			const email = safeString(u.email).toLowerCase();
			const phone = safeString(u.phone).toLowerCase();
			const id = safeString(u.userId).toLowerCase();
			return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q);
		});
	}, [items, searchInput]);

	const onBlockToggle = async (userId: string, isBlocked: boolean) => {
		if (!userId) return;
		setActionUserId(userId);
		try {
			if (isBlocked) {
				await adminUsersService.unblock(userId);
				toast({ title: 'User unblocked' });
				setItems((prev) => prev.map((u) => (u.userId === userId ? { ...u, isBlocked: false } : u)));
			} else {
				await adminUsersService.block(userId);
				toast({ title: 'User blocked' });
				setItems((prev) => prev.map((u) => (u.userId === userId ? { ...u, isBlocked: true } : u)));
			}
		} catch (e: unknown) {
			toast({ title: 'Action failed', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setActionUserId(null);
		}
	};

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-end">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<div className="w-full sm:w-52">
						<Select
							value={statusFilter}
							onValueChange={(v) => {
								setPage(1);
								setStatusFilter(v as typeof statusFilter);
							}}
						>
							<SelectTrigger>
								<SelectValue placeholder="Filter status" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All users</SelectItem>
								<SelectItem value="active">Active</SelectItem>
								<SelectItem value="blocked">Blocked</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<div className="relative w-full sm:w-72">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							value={searchInput}
							onChange={(e) => {
								setPage(1);
								setSearchInput(e.target.value);
							}}
							placeholder="Search name/email/phone"
							className="pl-9"
						/>
					</div>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load users</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card className="border-oz-neutral/40">
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle className="text-lg">Customers</CardTitle>
					<div className="text-sm text-muted-foreground">Page {page} of {totalPages}</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-3">
							{Array.from({ length: 8 }).map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-4 w-56" />
									<Skeleton className="h-4 w-20" />
									<Skeleton className="h-4 w-20" />
								</div>
							))}
						</div>
					) : filtered.length === 0 ? (
						<div className="py-10 text-center">
							<div className="text-sm text-muted-foreground">No users found.</div>
						</div>
					) : (
						<>
							<div className="hidden md:block">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>User</TableHead>
											<TableHead>Contact</TableHead>
											<TableHead className="text-right">Wallet</TableHead>
											<TableHead className="text-right">Orders</TableHead>
											<TableHead className="text-right">Active Subs</TableHead>
											<TableHead>Status</TableHead>
											<TableHead className="text-right">Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{filtered.map((u) => {
											const userId = safeString(u.userId);
											const isBlocked = Boolean(u.isBlocked);
											return (
												<TableRow key={userId} className="transition-colors hover:bg-muted/30">
												<TableCell>
													<div className="flex flex-col">
														<div className="font-medium text-oz-primary">{u.name || '—'}</div>
														<div className="text-xs text-muted-foreground font-mono">{shortId(userId)}</div>
													</div>
												</TableCell>
												<TableCell>
													<div className="flex flex-col">
														<div className="text-sm">{u.email || '—'}</div>
														<div className="text-xs text-muted-foreground">{u.phone || '—'}</div>
													</div>
												</TableCell>
												<TableCell className="text-right">{formatCurrency(Number(u.walletBalance || 0))}</TableCell>
												<TableCell className="text-right">{Number(u.totalOrders || 0)}</TableCell>
												<TableCell className="text-right">{Number(u.activeSubscriptions || 0)}</TableCell>
												<TableCell>
													{isBlocked ? (
														<Badge variant="outline" className="bg-red-50 text-red-900 border-red-200">Blocked</Badge>
													) : (
														<Badge variant="outline" className="bg-green-50 text-green-900 border-green-200">Active</Badge>
													)}
												</TableCell>
												<TableCell className="text-right">
													<div className="flex items-center justify-end gap-2">
														<Button asChild size="sm" variant="outline">
															<Link to={`/admin/users/${encodeURIComponent(userId)}`}>View</Link>
														</Button>
														<AlertDialog>
															<AlertDialogTrigger asChild>
																<Button
																	size="sm"
																	variant={isBlocked ? 'secondary' : 'destructive'}
																	disabled={actionUserId === userId}
																>
																	{isBlocked ? (
																		<><ShieldCheck className="h-4 w-4 mr-1" />Unblock</>
																	) : (
																		<><ShieldBan className="h-4 w-4 mr-1" />Block</>
																	)}
																</Button>
															</AlertDialogTrigger>
															<AlertDialogContent>
																<AlertDialogHeader>
																	<AlertDialogTitle>{isBlocked ? 'Unblock user?' : 'Block user?'}</AlertDialogTitle>
																	<AlertDialogDescription>
																		{isBlocked
																			? 'This will restore access for ordering and subscriptions.'
																			: 'This is a soft-block. The user will be prevented from creating new orders/subscriptions.'}
																	</AlertDialogDescription>
																</AlertDialogHeader>
																<AlertDialogFooter>
																	<AlertDialogCancel>Cancel</AlertDialogCancel>
																	<AlertDialogAction onClick={() => onBlockToggle(userId, isBlocked)}>
																		Confirm
																	</AlertDialogAction>
																</AlertDialogFooter>
															</AlertDialogContent>
														</AlertDialog>
													</div>
												</TableCell>
											</TableRow>
										);
									})}
									</TableBody>
								</Table>
							</div>

							{/* Mobile cards */}
							<div className="md:hidden space-y-3">
								{filtered.map((u) => {
									const userId = safeString(u.userId);
									const isBlocked = Boolean(u.isBlocked);
									return (
										<div key={userId} className="rounded-lg border p-4 bg-white">
											<div className="flex items-start justify-between gap-3">
												<div>
													<div className="font-semibold text-oz-primary">{u.name || '—'}</div>
													<div className="text-xs text-muted-foreground">{u.email || '—'}</div>
													<div className="text-xs text-muted-foreground">{u.phone || '—'}</div>
												</div>
												{isBlocked ? (
													<Badge variant="outline" className="bg-red-50 text-red-900 border-red-200">Blocked</Badge>
												) : (
													<Badge variant="outline" className="bg-green-50 text-green-900 border-green-200">Active</Badge>
												)}
											</div>
											<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
												<div className="rounded bg-muted/40 p-2">
													<div className="text-muted-foreground">Wallet</div>
													<div className="font-medium">{formatCurrency(Number(u.walletBalance || 0))}</div>
												</div>
												<div className="rounded bg-muted/40 p-2">
													<div className="text-muted-foreground">Orders</div>
													<div className="font-medium">{Number(u.totalOrders || 0)}</div>
												</div>
												<div className="rounded bg-muted/40 p-2">
													<div className="text-muted-foreground">Active Subs</div>
													<div className="font-medium">{Number(u.activeSubscriptions || 0)}</div>
												</div>
											</div>
											<div className="mt-4 flex gap-2">
												<Button asChild size="sm" variant="outline" className="flex-1">
													<Link to={`/admin/users/${encodeURIComponent(userId)}`}>View</Link>
												</Button>
												<AlertDialog>
													<AlertDialogTrigger asChild>
														<Button size="sm" variant={isBlocked ? 'secondary' : 'destructive'} className="flex-1" disabled={actionUserId === userId}>
															{isBlocked ? 'Unblock' : 'Block'}
														</Button>
													</AlertDialogTrigger>
													<AlertDialogContent>
														<AlertDialogHeader>
															<AlertDialogTitle>{isBlocked ? 'Unblock user?' : 'Block user?'}</AlertDialogTitle>
															<AlertDialogDescription>
																{isBlocked
																	? 'This will restore access for ordering and subscriptions.'
																	: 'This is a soft-block. The user will be prevented from creating new orders/subscriptions.'}
															</AlertDialogDescription>
														</AlertDialogHeader>
														<AlertDialogFooter>
															<AlertDialogCancel>Cancel</AlertDialogCancel>
															<AlertDialogAction onClick={() => onBlockToggle(userId, isBlocked)}>
																Confirm
															</AlertDialogAction>
														</AlertDialogFooter>
													</AlertDialogContent>
												</AlertDialog>
											</div>
										</div>
									);
								})}
							</div>
						</>
					)}

					<div className="mt-6 flex items-center justify-between">
						<Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
							Prev
						</Button>
						<div className="text-xs text-muted-foreground">Total: {total}</div>
						<Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>
							Next
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

