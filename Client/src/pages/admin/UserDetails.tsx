import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShieldBan, ShieldCheck, Pause, Play } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';

import { useToast } from '@/hooks/use-toast';
import {
	adminUsersService,
	type AdminUserDeliveriesSummary,
	type AdminUserDetail,
	type AdminUserOrder,
	type AdminUserSubscription,
	type AdminUserWallet,
} from '@/services/adminUsersService';
import { formatCurrency } from '@/utils/formatCurrency';

const safeString = (v: unknown) => String(v || '').trim();

const formatDateTime = (value?: string) => {
	if (!value) return '-';
	const d = new Date(value);
	if (Number.isNaN(d.getTime())) return '-';
	return d.toLocaleString();
};

export default function UserDetails() {
	const navigate = useNavigate();
	const { toast } = useToast();
	const { userId } = useParams();
	const resolvedId = safeString(userId);

	const [profile, setProfile] = useState<AdminUserDetail | null>(null);
	const [subs, setSubs] = useState<AdminUserSubscription[]>([]);
	const [orders, setOrders] = useState<AdminUserOrder[]>([]);
	const [wallet, setWallet] = useState<AdminUserWallet | null>(null);
	const [deliveries, setDeliveries] = useState<AdminUserDeliveriesSummary | null>(null);

	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState<string | null>(null);

	useEffect(() => {
		if (!resolvedId) {
			setError('Invalid user id');
			setLoading(false);
			return;
		}

		const controller = new AbortController();
		setLoading(true);
		setError(null);

		Promise.all([
			adminUsersService.getUser(resolvedId, { signal: controller.signal }),
			adminUsersService.listSubscriptions(resolvedId, { signal: controller.signal }),
			adminUsersService.listOrders(resolvedId, { limit: 20, signal: controller.signal }),
			adminUsersService.getWallet(resolvedId, { signal: controller.signal }),
			adminUsersService.getDeliveries(resolvedId, { signal: controller.signal }),
		])
			.then(([u, s, o, w, d]) => {
				setProfile(u);
				setSubs(s || []);
				setOrders(o || []);
				setWallet(w);
				setDeliveries(d);
			})
			.catch((e: unknown) => {
				const msg = safeString((e as { message?: unknown })?.message || e) || 'Failed to load user details';
				if (msg.toLowerCase().includes('authentication required') || msg.toLowerCase().includes('unauthorized')) {
					navigate('/login', { replace: true, state: { from: `/admin/users/${resolvedId}` } });
					return;
				}
				setError(msg);
			})
			.finally(() => setLoading(false));

		return () => controller.abort();
	}, [resolvedId, navigate]);

	const defaultAddress = useMemo(() => {
		const addrs = profile?.addresses || [];
		return addrs.find((a) => a?.isDefault) || addrs[0];
	}, [profile]);

	const onBlockToggle = async () => {
		if (!profile?.userId) return;
		setActionLoading('block');
		try {
			if (profile.isBlocked) {
				await adminUsersService.unblock(profile.userId);
				setProfile((p) => (p ? { ...p, isBlocked: false, blockedAt: undefined, blockedBy: undefined } : p));
				toast({ title: 'User unblocked' });
			} else {
				const res = await adminUsersService.block(profile.userId);
				setProfile((p) => (p ? { ...p, isBlocked: true, blockedAt: res.blockedAt } : p));
				toast({ title: 'User blocked' });
			}
		} catch (e: unknown) {
			toast({ title: 'Action failed', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setActionLoading(null);
		}
	};

	const onPauseAll = async () => {
		if (!profile?.userId) return;
		setActionLoading('pause');
		try {
			await adminUsersService.pauseAllSubscriptions(profile.userId);
			toast({ title: 'Subscriptions paused' });
			setSubs((prev) => prev.map((s) => ({ ...s, status: 'paused' })));
		} catch (e: unknown) {
			toast({ title: 'Failed to pause subscriptions', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setActionLoading(null);
		}
	};

	const onResumeAll = async () => {
		if (!profile?.userId) return;
		setActionLoading('resume');
		try {
			await adminUsersService.resumeAllSubscriptions(profile.userId);
			toast({ title: 'Subscriptions resumed' });
			setSubs((prev) => prev.map((s) => ({ ...s, status: 'active' })));
		} catch (e: unknown) {
			toast({ title: 'Failed to resume subscriptions', description: safeString((e as { message?: unknown })?.message || e), variant: 'destructive' });
		} finally {
			setActionLoading(null);
		}
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex items-center gap-3">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-56" />
				</div>
				<Card className="border-oz-neutral/40">
					<CardHeader>
						<Skeleton className="h-6 w-40" />
					</CardHeader>
					<CardContent className="space-y-3">
						<Skeleton className="h-4 w-72" />
						<Skeleton className="h-4 w-56" />
						<Skeleton className="h-4 w-64" />
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div className="flex items-center gap-3">
					<Button variant="outline" size="sm" onClick={() => navigate('/admin/users')}>
						<ArrowLeft className="h-4 w-4 mr-2" />
						Back
					</Button>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button
								variant={profile?.isBlocked ? 'secondary' : 'destructive'}
								disabled={actionLoading != null}
							>
								{profile?.isBlocked ? (
									<><ShieldCheck className="h-4 w-4 mr-2" />Unblock</>
								) : (
									<><ShieldBan className="h-4 w-4 mr-2" />Block</>
								)}
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>{profile?.isBlocked ? 'Unblock user?' : 'Block user?'}</AlertDialogTitle>
								<AlertDialogDescription>
									{profile?.isBlocked
										? 'This will restore access for ordering and subscriptions.'
										: 'This is a soft-block. The user will be prevented from creating new orders/subscriptions.'}
								</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={onBlockToggle}>Confirm</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>

					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" disabled={actionLoading != null}>
								<Pause className="h-4 w-4 mr-2" />
								Pause All Subs
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Pause all subscriptions?</AlertDialogTitle>
								<AlertDialogDescription>This sets all current subscriptions to paused.</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={onPauseAll}>Confirm</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>

					<AlertDialog>
						<AlertDialogTrigger asChild>
							<Button variant="outline" disabled={actionLoading != null}>
								<Play className="h-4 w-4 mr-2" />
								Resume All Subs
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent>
							<AlertDialogHeader>
								<AlertDialogTitle>Resume all subscriptions?</AlertDialogTitle>
								<AlertDialogDescription>This sets all paused subscriptions back to active.</AlertDialogDescription>
							</AlertDialogHeader>
							<AlertDialogFooter>
								<AlertDialogCancel>Cancel</AlertDialogCancel>
								<AlertDialogAction onClick={onResumeAll}>Confirm</AlertDialogAction>
							</AlertDialogFooter>
						</AlertDialogContent>
					</AlertDialog>
				</div>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertTitle>Failed to load user</AlertTitle>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			<Card className="border-oz-neutral/40">
				<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<CardTitle className="text-lg">{profile?.name || '—'}</CardTitle>
						<div className="text-sm text-muted-foreground">{profile?.email || '—'}</div>
						<div className="text-xs text-muted-foreground">Joined: {formatDateTime(profile?.createdAt)}</div>
					</div>
					<div className="flex items-center gap-2">
						{profile?.isBlocked ? (
							<Badge variant="outline" className="bg-red-50 text-red-900 border-red-200">Blocked</Badge>
						) : (
							<Badge variant="outline" className="bg-green-50 text-green-900 border-green-200">Active</Badge>
						)}
						<Badge variant="outline" className="bg-muted/40">Wallet: {formatCurrency(Number(profile?.walletBalance || 0))}</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Primary Contact</div>
							<div className="mt-2 text-sm text-muted-foreground">
								<div>Phone: {profile?.phone || defaultAddress?.contactNumber || '—'}</div>
								<div>Address: {safeString(defaultAddress?.addressLine1) || '—'}</div>
								<div>
									{[defaultAddress?.city, defaultAddress?.state, defaultAddress?.pincode].filter(Boolean).join(', ') || ''}
								</div>
							</div>
						</div>
						<div className="rounded-lg border p-4">
							<div className="text-sm font-medium">Notes</div>
							<div className="mt-2 text-sm text-muted-foreground">
								Blocked at: {formatDateTime(profile?.blockedAt)}
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			<Tabs defaultValue="subscriptions">
				<TabsList className="flex flex-wrap justify-start">
					<TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
					<TabsTrigger value="orders">Orders</TabsTrigger>
					<TabsTrigger value="deliveries">Deliveries</TabsTrigger>
					<TabsTrigger value="wallet">Wallet</TabsTrigger>
				</TabsList>

				<TabsContent value="subscriptions">
					<Card className="border-oz-neutral/40">
						<CardHeader>
							<CardTitle className="text-lg">Subscriptions</CardTitle>
						</CardHeader>
						<CardContent>
							{subs.length === 0 ? (
								<div className="py-8 text-center text-sm text-muted-foreground">No subscriptions found.</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Type</TableHead>
											<TableHead>Frequency</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Created</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{subs.map((s) => (
											<TableRow key={s.id}>
												<TableCell className="font-medium">{s.kind === 'customMeal' ? 'Custom Meal' : 'Add-on'}</TableCell>
												<TableCell>{s.frequency || '—'}</TableCell>
												<TableCell>
													<Badge variant="outline" className={safeString(s.status).toLowerCase() === 'paused' ? 'bg-yellow-50 text-yellow-900 border-yellow-200' : 'bg-green-50 text-green-900 border-green-200'}>
														{safeString(s.status) || '—'}
													</Badge>
												</TableCell>
												<TableCell>{formatDateTime(s.createdAt)}</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="orders">
					<Card className="border-oz-neutral/40">
						<CardHeader>
							<CardTitle className="text-lg">Recent Orders</CardTitle>
						</CardHeader>
						<CardContent>
							{orders.length === 0 ? (
								<div className="py-8 text-center text-sm text-muted-foreground">No orders found.</div>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Order</TableHead>
											<TableHead>Status</TableHead>
											<TableHead>Payment</TableHead>
											<TableHead className="text-right">Total</TableHead>
											<TableHead>Created</TableHead>
											<TableHead className="text-right">Action</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{orders.map((o) => (
											<TableRow key={o.orderId}>
												<TableCell className="font-mono text-xs">{o.orderId}</TableCell>
												<TableCell>{safeString(o.orderStatus) || '—'}</TableCell>
												<TableCell>{safeString(o.paymentStatus) || '—'}</TableCell>
												<TableCell className="text-right">{formatCurrency(Number(o.total || 0))}</TableCell>
												<TableCell>{formatDateTime(o.createdAt)}</TableCell>
												<TableCell className="text-right">
													<Button asChild size="sm" variant="outline">
														<Link to={`/admin/orders/${encodeURIComponent(o.orderId)}`}>View</Link>
													</Button>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="deliveries">
					<Card className="border-oz-neutral/40">
						<CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
							<CardTitle className="text-lg">Deliveries</CardTitle>
							<Button asChild variant="outline" size="sm">
								<Link to="/admin/kitchen">Open Kitchen View</Link>
							</Button>
						</CardHeader>
						<CardContent>
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div className="rounded border p-3">
									<div className="text-xs text-muted-foreground">Today</div>
									<div className="text-xl font-semibold text-oz-primary">{deliveries?.today?.length || 0}</div>
								</div>
								<div className="rounded border p-3">
									<div className="text-xs text-muted-foreground">Upcoming (7d)</div>
									<div className="text-xl font-semibold text-oz-primary">{deliveries?.upcoming?.length || 0}</div>
								</div>
								<div className="rounded border p-3">
									<div className="text-xs text-muted-foreground">Skipped (from today)</div>
									<div className="text-xl font-semibold text-oz-primary">{deliveries?.skippedCount || 0}</div>
								</div>
							</div>

							<div className="mt-4">
								<div className="text-sm font-medium">Next deliveries</div>
								<div className="mt-2 space-y-2">
									{(deliveries?.upcoming || []).slice(0, 5).map((d) => (
										<div key={d.id} className="rounded border p-3 flex items-center justify-between">
											<div className="text-sm">
												<div className="font-medium">{d.date || '—'} {d.time ? `• ${d.time}` : ''}</div>
												<div className="text-xs text-muted-foreground">Items: {d.itemsCount ?? 0}</div>
											</div>
											<Badge variant="outline" className="bg-muted/40">{safeString(d.status) || '—'}</Badge>
										</div>
									))}
									{(deliveries?.upcoming || []).length === 0 ? (
										<div className="text-sm text-muted-foreground py-6 text-center">No upcoming deliveries found.</div>
									) : null}
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="wallet">
					<Card className="border-oz-neutral/40">
						<CardHeader>
							<CardTitle className="text-lg">Wallet</CardTitle>
						</CardHeader>
						<CardContent>
							<div className="rounded border p-4 flex items-center justify-between">
								<div>
									<div className="text-sm font-medium">Wallet Balance</div>
									<div className="text-xs text-muted-foreground">Current stored credits for this user.</div>
								</div>
								<div className="text-2xl font-semibold text-oz-primary">{formatCurrency(Number(wallet?.walletBalance || 0))}</div>
							</div>

							<div className="mt-4">
								<div className="text-sm font-medium">Recent credits usage (from orders)</div>
								{wallet?.recentCredits?.length ? (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Order</TableHead>
												<TableHead className="text-right">Credits</TableHead>
												<TableHead className="text-right">Total</TableHead>
												<TableHead>Created</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{wallet.recentCredits.map((c) => (
												<TableRow key={c.orderId}>
													<TableCell className="font-mono text-xs">{c.orderId}</TableCell>
													<TableCell className="text-right">{formatCurrency(Number(c.amount || 0))}</TableCell>
													<TableCell className="text-right">{formatCurrency(Number(c.total || 0))}</TableCell>
													<TableCell>{formatDateTime(c.createdAt)}</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								) : (
									<div className="py-6 text-sm text-muted-foreground text-center">No recent credit usage found.</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
