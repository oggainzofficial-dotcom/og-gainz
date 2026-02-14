import { useEffect, useMemo, useState } from 'react';
import { Download, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from '@/components/ui/sheet';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

import { useToast } from '@/hooks/use-toast';
import { adminUsersService, type AdminUserListItem, type AdminUserWallet } from '@/services/adminUsersService';
import { adminWalletService, type AdminWalletSummary, type AdminWalletTransaction } from '@/services/adminWalletService';
import { formatCurrency } from '@/utils/formatCurrency';
import { AdminFormLayout, ADMIN_FORM_GRID, FormField } from '@/components/admin';

const safeString = (v: unknown) => String(v || '').trim();
const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id);

const formatWhen = (raw?: string) => {
	if (!raw) return '—';
	const dt = new Date(raw);
	if (Number.isNaN(dt.getTime())) return '—';
	return dt.toLocaleString('en-IN', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

type SortKey = 'walletBalance' | 'name' | 'createdAt' | 'orders' | 'activeSubscriptions';

const downloadCsv = (filename: string, rows: Array<Record<string, string | number | null | undefined>>) => {
	const headers = Object.keys(rows[0] || {});
	const escape = (v: unknown) => {
		const s = String(v ?? '');
		if (/[\n\r",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
		return s;
	};
	const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	try {
		a.href = url;
		a.download = filename;
		a.click();
	} finally {
		URL.revokeObjectURL(url);
	}
};

const txnUserInfo = (txn: AdminWalletTransaction) => {
	const u = txn.userId;
	if (typeof u === 'string') return { id: u, email: '', name: '' };
	return {
		id: safeString((u as { _id?: unknown })._id),
		email: safeString((u as { email?: unknown }).email),
		name: safeString((u as { name?: unknown }).name),
	};
};

const txnLabel = (txn: AdminWalletTransaction) => {
	const type = safeString(txn.type);
	const reason = safeString(txn.reason);
	return reason ? `${type} • ${reason}` : (type || '—');
};

export default function Wallet() {
	const { toast } = useToast();

	const [summary, setSummary] = useState<AdminWalletSummary | null>(null);
	const [summaryLoading, setSummaryLoading] = useState(true);
	const [summaryError, setSummaryError] = useState<string | null>(null);

	const [items, setItems] = useState<AdminUserListItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [page, setPage] = useState(1);
	const [limit] = useState(20);
	const [total, setTotal] = useState(0);
	const [walletOnly, setWalletOnly] = useState(false);
	const [search, setSearch] = useState('');
	const [searchInput, setSearchInput] = useState('');
	const [sortKey, setSortKey] = useState<SortKey>('walletBalance');
	const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

	const [userSheetOpen, setUserSheetOpen] = useState(false);
	const [activeUser, setActiveUser] = useState<AdminUserListItem | null>(null);
	const [activeWallet, setActiveWallet] = useState<AdminUserWallet | null>(null);
	const [walletLoading, setWalletLoading] = useState(false);
	const [walletError, setWalletError] = useState<string | null>(null);

	const [creditDialogOpen, setCreditDialogOpen] = useState(false);
	const [creditUserId, setCreditUserId] = useState<string>('');
	const [creditAmount, setCreditAmount] = useState<string>('');
	const [creditNote, setCreditNote] = useState<string>('');
	const [creditSaving, setCreditSaving] = useState(false);

	const [txnItems, setTxnItems] = useState<AdminWalletTransaction[]>([]);
	const [txnLoading, setTxnLoading] = useState(true);
	const [txnError, setTxnError] = useState<string | null>(null);
	const [txnCursor, setTxnCursor] = useState<string | null>(null);
	const [txnHasMore, setTxnHasMore] = useState(false);

	useEffect(() => {
		const t = window.setTimeout(() => setSearch(searchInput), 250);
		return () => window.clearTimeout(t);
	}, [searchInput]);

	const refreshSummary = async (signal?: AbortSignal) => {
		setSummaryLoading(true);
		setSummaryError(null);
		try {
			const res = await adminWalletService.getSummary({ signal });
			setSummary(res);
		} catch (e: unknown) {
			setSummaryError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load summary');
		} finally {
			setSummaryLoading(false);
		}
	};

	useEffect(() => {
		const controller = new AbortController();
		void refreshSummary(controller.signal);
		return () => controller.abort();
	}, []);

	const refreshTransactions = async (opts?: { append?: boolean; cursor?: string | null; signal?: AbortSignal }) => {
		setTxnLoading(true);
		setTxnError(null);
		try {
			const res = await adminWalletService.getTransactions(
				{ limit: 50, cursor: opts?.cursor || undefined },
				{ signal: opts?.signal }
			);
			setTxnItems((prev) => (opts?.append ? [...prev, ...(res.items || [])] : (res.items || [])));
			setTxnCursor(res.nextCursor);
			setTxnHasMore(Boolean(res.nextCursor));
		} catch (e: unknown) {
			setTxnError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load transactions');
		} finally {
			setTxnLoading(false);
		}
	};

	useEffect(() => {
		const controller = new AbortController();
		void refreshTransactions({ signal: controller.signal });
		return () => controller.abort();
	}, []);

	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);

		adminUsersService
			.list({ page, limit, status: 'all', search, signal: controller.signal })
			.then((res) => {
				setItems(res.items || []);
				setTotal(res.meta?.total || 0);
			})
			.catch((e: unknown) => {
				setError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load users');
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [page, limit, search]);

	const totalPages = Math.max(1, Math.ceil(total / limit));
	const hasPrev = page > 1;
	const hasNext = page < totalPages;

	const visible = useMemo(() => {
		const q = searchInput.trim().toLowerCase();
		let next = items;

		if (walletOnly) {
			next = next.filter((u) => Number(u.walletBalance || 0) > 0);
		}

		if (q) {
			next = next.filter((u) => {
				const name = safeString(u.name).toLowerCase();
				const email = safeString(u.email).toLowerCase();
				const phone = safeString(u.phone).toLowerCase();
				const id = safeString(u.userId).toLowerCase();
				return name.includes(q) || email.includes(q) || phone.includes(q) || id.includes(q);
			});
		}

		next = [...next].sort((a, b) => {
			const dir = sortDir === 'asc' ? 1 : -1;
			switch (sortKey) {
				case 'walletBalance':
					return dir * (Number(a.walletBalance || 0) - Number(b.walletBalance || 0));
				case 'orders':
					return dir * (Number(a.totalOrders || 0) - Number(b.totalOrders || 0));
				case 'activeSubscriptions':
					return dir * (Number(a.activeSubscriptions || 0) - Number(b.activeSubscriptions || 0));
				case 'createdAt': {
					const av = new Date(a.createdAt || 0).getTime();
					const bv = new Date(b.createdAt || 0).getTime();
					return dir * (av - bv);
				}
				case 'name':
				default: {
					const av = safeString(a.name).toLowerCase();
					const bv = safeString(b.name).toLowerCase();
					return dir * av.localeCompare(bv);
				}
			}
		});

		return next;
	}, [items, searchInput, walletOnly, sortKey, sortDir]);

	const openUserWallet = async (u: AdminUserListItem) => {
		setActiveUser(u);
		setUserSheetOpen(true);
		setWalletLoading(true);
		setWalletError(null);
		setActiveWallet(null);

		try {
			const res = await adminUsersService.getWallet(u.userId);
			setActiveWallet(res);
		} catch (e: unknown) {
			setWalletError(safeString((e as { message?: unknown })?.message || e) || 'Failed to load wallet');
		} finally {
			setWalletLoading(false);
		}
	};

	const onToggleSort = (key: SortKey) => {
		if (key === sortKey) {
			setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
			return;
		}
		setSortKey(key);
		setSortDir(key === 'name' ? 'asc' : 'desc');
	};

	const exportUsersCsv = () => {
		if (visible.length === 0) {
			toast({ title: 'Nothing to export', description: 'No users match the current filters.' });
			return;
		}

		downloadCsv(`wallet-users-page-${page}.csv`,
			visible.map((u) => ({
				userId: safeString(u.userId),
				name: safeString(u.name) || '',
				email: safeString(u.email) || '',
				phone: safeString(u.phone) || '',
				walletBalance: Number(u.walletBalance || 0),
				totalOrders: Number(u.totalOrders || 0),
				activeSubscriptions: Number(u.activeSubscriptions || 0),
				createdAt: safeString(u.createdAt) || '',
			}))
		);
	};

	const submitCredits = async (userId: string, amountRaw: string, note?: string) => {
		const amtNum = Math.round(Number(amountRaw));
		if (!userId) {
			toast({ title: 'Select a user', variant: 'destructive' });
			return false;
		}
		if (!Number.isFinite(amtNum) || amtNum <= 0) {
			toast({ title: 'Enter a valid amount', description: 'Amount must be a positive number.', variant: 'destructive' });
			return false;
		}

		setCreditSaving(true);
		try {
			const res = await adminWalletService.addCredits({ userId, amount: amtNum, note: note || undefined });
			toast({ title: 'Credits added', description: `${formatCurrency(amtNum)} added.` });

			setItems((prev) => prev.map((u) => (u.userId === userId ? { ...u, walletBalance: res.walletBalance } : u)));
			if (activeUser?.userId === userId) {
				setActiveWallet((prev) => (prev ? { ...prev, walletBalance: res.walletBalance } : prev));
			}
			await refreshSummary();
			void refreshTransactions();
			return true;
		} catch (e: unknown) {
			toast({ title: 'Failed to add credits', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
			return false;
		} finally {
			setCreditSaving(false);
		}
	};

	const summaryCards = (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
			<Card className="border-oz-neutral/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm text-muted-foreground">Total Users</CardTitle>
				</CardHeader>
				<CardContent>
					{summaryLoading ? <Skeleton className="h-7 w-20" /> : <div className="text-2xl font-semibold">{Number(summary?.totalUsers || 0)}</div>}
				</CardContent>
			</Card>
			<Card className="border-oz-neutral/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm text-muted-foreground">Users w/ Balance</CardTitle>
				</CardHeader>
				<CardContent>
					{summaryLoading ? <Skeleton className="h-7 w-20" /> : <div className="text-2xl font-semibold">{Number(summary?.usersWithBalance || 0)}</div>}
				</CardContent>
			</Card>
			<Card className="border-oz-neutral/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm text-muted-foreground">Total Wallet</CardTitle>
				</CardHeader>
				<CardContent>
					{summaryLoading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-semibold">{formatCurrency(Number(summary?.totalWalletBalance || 0))}</div>}
				</CardContent>
			</Card>
			<Card className="border-oz-neutral/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm text-muted-foreground">Avg (non-zero)</CardTitle>
				</CardHeader>
				<CardContent>
					{summaryLoading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-semibold">{formatCurrency(Number(summary?.avgWalletBalance || 0))}</div>}
				</CardContent>
			</Card>
			<Card className="border-oz-neutral/40">
				<CardHeader className="pb-2">
					<CardTitle className="text-sm text-muted-foreground">Max</CardTitle>
				</CardHeader>
				<CardContent>
					{summaryLoading ? <Skeleton className="h-7 w-32" /> : <div className="text-2xl font-semibold">{formatCurrency(Number(summary?.maxWalletBalance || 0))}</div>}
				</CardContent>
			</Card>
		</div>
	);

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
				<div className="flex flex-col gap-1">
					<div className="text-sm text-muted-foreground">Wallet & Credits</div>
					<div className="text-2xl font-semibold text-oz-primary">Manage balances and credit operations</div>
				</div>
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
					<Button variant="outline" onClick={exportUsersCsv}>
						<Download className="h-4 w-4 mr-2" />Export Users (CSV)
					</Button>
					<Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
						<DialogTrigger asChild>
							<Button className="bg-oz-primary hover:bg-oz-primary/90">
								<Plus className="h-4 w-4 mr-2" />Add Credits
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-5xl p-0">
							<DialogHeader>
								<VisuallyHidden>
									<DialogTitle>Add credits to a user</DialogTitle>
								</VisuallyHidden>
								<VisuallyHidden>
									<DialogDescription>This increments the user wallet balance.</DialogDescription>
								</VisuallyHidden>
							</DialogHeader>
							<AdminFormLayout
								title="Add credits to a user"
								description="This increments the user wallet balance. Transaction logs are not yet stored server-side."
								stickyActions
								actions={
									<>
										<Button
											variant="outline"
											className="h-11 rounded-xl"
											onClick={() => setCreditDialogOpen(false)}
											disabled={creditSaving}
										>
											Cancel
										</Button>
										<Button
											className="h-11 rounded-xl"
											onClick={async () => {
												const ok = await submitCredits(creditUserId, creditAmount, creditNote);
												if (ok) {
													setCreditAmount('');
													setCreditNote('');
													setCreditDialogOpen(false);
												}
											}}
											disabled={creditSaving}
										>
											Add Credits
										</Button>
									</>
								}
							>
								<div className="p-6">
									<div className={ADMIN_FORM_GRID}>
										<FormField label="User" required applyInputStyles={false}>
											<Select value={creditUserId} onValueChange={setCreditUserId}>
												<SelectTrigger className="h-11 rounded-xl px-4">
													<SelectValue placeholder="Select a user from this page" />
												</SelectTrigger>
												<SelectContent>
													{items.map((u) => {
														const id = safeString(u.userId);
														const label = `${safeString(u.name) || '—'} • ${safeString(u.email) || '—'} • ${shortId(id)}`;
														return (
															<SelectItem key={id} value={id}>
																{label}
															</SelectItem>
														);
													})}
												</SelectContent>
											</Select>
										</FormField>
										<FormField label="Amount" required>
											<Input value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} placeholder="e.g. 250" />
										</FormField>
										<FormField label="Note (optional)">
											<Input value={creditNote} onChange={(e) => setCreditNote(e.target.value)} placeholder="Internal note" />
										</FormField>
									</div>
								</div>
							</AdminFormLayout>
						</DialogContent>
					</Dialog>
				</div>
			</div>

			{summaryError ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load wallet summary</AlertTitle>
					<AlertDescription>{summaryError}</AlertDescription>
				</Alert>
			) : null}

			{summaryCards}

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load users</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card className="border-oz-neutral/40">
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<CardTitle className="text-lg">User Wallets</CardTitle>
						<div className="text-xs text-muted-foreground">Page {page} of {totalPages}</div>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
						<Button
							variant={walletOnly ? 'secondary' : 'outline'}
							onClick={() => setWalletOnly((v) => !v)}
						>
							{walletOnly ? 'Wallet-only' : 'All users'}
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{loading ? (
						<div className="space-y-3">
							{Array.from({ length: 8 }).map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<Skeleton className="h-4 w-56" />
									<Skeleton className="h-4 w-40" />
									<Skeleton className="h-4 w-24" />
								</div>
							))}
						</div>
					) : visible.length === 0 ? (
						<div className="py-10 text-center">
							<div className="text-sm text-muted-foreground">No users found.</div>
						</div>
					) : (
						<>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>
											<Button variant="ghost" className="px-0" onClick={() => onToggleSort('name')}>
												User
												{sortKey === 'name' ? <span className="ml-2 text-xs text-muted-foreground">({sortDir})</span> : null}
											</Button>
										</TableHead>
										<TableHead>Contact</TableHead>
										<TableHead className="text-right">
											<Button variant="ghost" className="px-0" onClick={() => onToggleSort('walletBalance')}>
												Wallet
												{sortKey === 'walletBalance' ? <span className="ml-2 text-xs text-muted-foreground">({sortDir})</span> : null}
											</Button>
										</TableHead>
										<TableHead className="text-right">
											<Button variant="ghost" className="px-0" onClick={() => onToggleSort('orders')}>
												Orders
												{sortKey === 'orders' ? <span className="ml-2 text-xs text-muted-foreground">({sortDir})</span> : null}
											</Button>
										</TableHead>
										<TableHead className="text-right">
											<Button variant="ghost" className="px-0" onClick={() => onToggleSort('activeSubscriptions')}>
												Subs
												{sortKey === 'activeSubscriptions' ? <span className="ml-2 text-xs text-muted-foreground">({sortDir})</span> : null}
											</Button>
										</TableHead>
										<TableHead className="text-right">Action</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{visible.map((u) => {
										const userId = safeString(u.userId);
										const walletBalance = Number(u.walletBalance || 0);
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
												<TableCell className="text-right">
													<div className="inline-flex items-center gap-2 justify-end">
														<div className="font-medium">{formatCurrency(walletBalance)}</div>
														{walletBalance > 0 ? <Badge variant="outline" className="bg-green-50 text-green-900 border-green-200">Active</Badge> : null}
													</div>
												</TableCell>
												<TableCell className="text-right">{Number(u.totalOrders || 0)}</TableCell>
												<TableCell className="text-right">{Number(u.activeSubscriptions || 0)}</TableCell>
												<TableCell className="text-right">
													<Button size="sm" variant="outline" onClick={() => void openUserWallet(u)}>
														View
													</Button>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>

							<div className="mt-4 flex items-center justify-between">
								<div className="text-sm text-muted-foreground">Showing {visible.length} of {items.length} users on this page</div>
								<div className="flex items-center gap-2">
									<Button variant="outline" size="sm" disabled={!hasPrev || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
										<ChevronLeft className="h-4 w-4 mr-1" />Prev
									</Button>
									<Button variant="outline" size="sm" disabled={!hasNext || loading} onClick={() => setPage((p) => p + 1)}>
										Next<ChevronRight className="h-4 w-4 ml-1" />
									</Button>
								</div>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<Card className="border-oz-neutral/40">
				<CardHeader>
					<div className="flex items-start justify-between gap-3">
						<div>
							<CardTitle className="text-lg">Transactions</CardTitle>
							<div className="text-sm text-muted-foreground">Most recent wallet credits/debits (includes order debits).</div>
						</div>
						<Button variant="outline" size="sm" onClick={() => void refreshTransactions()} disabled={txnLoading}>
							Refresh
						</Button>
					</div>
				</CardHeader>
				<CardContent>
					{txnError ? (
						<Alert variant="destructive">
							<AlertTitle>Failed to load transactions</AlertTitle>
							<AlertDescription>{txnError}</AlertDescription>
						</Alert>
					) : null}

					{txnLoading && txnItems.length === 0 ? (
						<div className="space-y-2">
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
							<Skeleton className="h-8 w-full" />
						</div>
					) : txnItems.length === 0 ? (
						<div className="py-10 text-center">
							<div className="text-sm text-muted-foreground">No transactions yet.</div>
						</div>
					) : (
						<>
							<div className="overflow-x-auto">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>When</TableHead>
											<TableHead>User</TableHead>
											<TableHead>Type</TableHead>
											<TableHead className="text-right">Amount</TableHead>
											<TableHead className="text-right">Balance After</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{txnItems.map((t) => {
											const u = txnUserInfo(t);
											const isDebit = safeString(t.type).toUpperCase() === 'DEBIT';
											return (
												<TableRow key={safeString(t._id)}>
													<TableCell className="whitespace-nowrap">{formatWhen(t.createdAt)}</TableCell>
													<TableCell className="min-w-[200px]">
														<div className="font-medium text-oz-primary">{u.name || u.email || shortId(u.id)}</div>
														<div className="text-xs text-muted-foreground">{u.email || u.id}</div>
													</TableCell>
													<TableCell>
														<Badge className={isDebit ? 'bg-red-100 text-red-800 hover:bg-red-100' : 'bg-green-100 text-green-800 hover:bg-green-100'}>
															{txnLabel(t)}
														</Badge>
													</TableCell>
													<TableCell className={isDebit ? 'text-right text-red-600' : 'text-right text-green-700'}>
														{isDebit ? '-' : '+'}{formatCurrency(Number(t.amount || 0))}
													</TableCell>
													<TableCell className="text-right">{formatCurrency(Number(t.balanceAfter || 0))}</TableCell>
												</TableRow>
											);
										})}
									</TableBody>
								</Table>
							</div>

							{txnHasMore ? (
								<div className="mt-3 flex justify-center">
									<Button
										variant="outline"
										size="sm"
										onClick={() => void refreshTransactions({ append: true, cursor: txnCursor })}
										disabled={txnLoading || !txnCursor}
									>
										Load more
									</Button>
								</div>
							) : null}
						</>
					)}
				</CardContent>
			</Card>

			<Sheet open={userSheetOpen} onOpenChange={(open) => {
				setUserSheetOpen(open);
				if (!open) {
					setActiveUser(null);
					setActiveWallet(null);
					setWalletError(null);
					setWalletLoading(false);
				}
			}}>
				<SheetContent side="right" className="w-full sm:max-w-xl p-0 overflow-hidden">
					<div className="flex flex-col max-h-[90vh]">
						<div className="shrink-0 p-6 border-b">
							<SheetHeader>
								<SheetTitle className="text-oz-primary">{activeUser?.name || 'User Wallet'}</SheetTitle>
								<SheetDescription>
									{activeUser?.email || '—'} • {activeUser?.phone || '—'}
								</SheetDescription>
							</SheetHeader>
						</div>

						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
							<Card className="border-oz-neutral/40">
								<CardHeader className="pb-2">
									<CardTitle className="text-sm text-muted-foreground">Current Balance</CardTitle>
								</CardHeader>
								<CardContent>
									{walletLoading ? (
										<Skeleton className="h-9 w-48" />
									) : walletError ? (
										<div className="text-sm text-red-600">{walletError}</div>
									) : (
										<div className="text-3xl font-semibold">{formatCurrency(Number(activeWallet?.walletBalance || activeUser?.walletBalance || 0))}</div>
									)}
									<div className="mt-3 flex items-center gap-2">
										<Button
											size="sm"
											className="bg-oz-primary hover:bg-oz-primary/90"
											onClick={() => {
												setCreditUserId(safeString(activeUser?.userId));
												setCreditAmount('');
												setCreditNote('');
												setCreditDialogOpen(true);
											}}
											disabled={!activeUser?.userId}
										>
											<Plus className="h-4 w-4 mr-1" />Add Credits
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={async () => {
												if (!activeUser?.userId) return;
												setWalletLoading(true);
												setWalletError(null);
												try {
													const res = await adminUsersService.getWallet(activeUser.userId);
													setActiveWallet(res);
												} catch (e: unknown) {
													setWalletError(safeString((e as { message?: unknown })?.message || e) || 'Failed to refresh');
												} finally {
													setWalletLoading(false);
												}
											}}
											disabled={!activeUser?.userId || walletLoading}
										>
											Refresh
										</Button>
									</div>
								</CardContent>
							</Card>

							<Card className="border-oz-neutral/40">
								<CardHeader>
									<CardTitle className="text-lg">Recent Credit Usage</CardTitle>
									<div className="text-sm text-muted-foreground">Derived from orders with credits applied.</div>
								</CardHeader>
								<CardContent>
									{walletLoading ? (
										<div className="space-y-3">
											{Array.from({ length: 4 }).map((_, i) => (
												<Skeleton key={i} className="h-4 w-full" />
											))}
										</div>
									) : (activeWallet?.recentCredits || []).length === 0 ? (
										<div className="py-8 text-center text-sm text-muted-foreground">No recent credit usage found.</div>
									) : (
										<Table>
											<TableHeader>
												<TableRow>
													<TableHead>Order</TableHead>
													<TableHead>Date</TableHead>
													<TableHead className="text-right">Credits</TableHead>
													<TableHead className="text-right">Order Total</TableHead>
												</TableRow>
											</TableHeader>
											<TableBody>
												{(activeWallet?.recentCredits || []).map((r) => (
													<TableRow key={safeString(r.orderId)}>
														<TableCell className="font-mono text-xs">{shortId(safeString(r.orderId))}</TableCell>
														<TableCell className="text-sm">{formatWhen(r.createdAt)}</TableCell>
														<TableCell className="text-right">{formatCurrency(Number(r.amount || 0))}</TableCell>
														<TableCell className="text-right">{formatCurrency(Number(r.total || 0))}</TableCell>
													</TableRow>
												))}
											</TableBody>
										</Table>
									)}
								</CardContent>
							</Card>
						</div>

						<div className="shrink-0 p-6 border-t bg-muted/20 flex items-center justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => {
									setUserSheetOpen(false);
								}}
							>
								Close
							</Button>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}
