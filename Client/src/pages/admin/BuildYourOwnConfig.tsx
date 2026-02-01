import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { adminBuildYourOwnConfigService } from '@/services/adminBuildYourOwnConfigService';

export default function AdminBuildYourOwnConfig() {
	const { toast } = useToast();
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [weeklyMin, setWeeklyMin] = useState(0);
	const [monthlyMin, setMonthlyMin] = useState(0);

	useEffect(() => {
		let alive = true;
		setLoading(true);
		adminBuildYourOwnConfigService
			.get()
			.then((res) => {
				if (!alive) return;
				setWeeklyMin(Number(res.data.minimumWeeklyOrderAmount || 0));
				setMonthlyMin(Number(res.data.minimumMonthlyOrderAmount || 0));
			})
			.catch(() => {
				toast({ title: 'Failed to load config', variant: 'destructive' });
			})
			.finally(() => {
				if (!alive) return;
				setLoading(false);
			});
		return () => {
			alive = false;
		};
	}, [toast]);

	const save = async () => {
		setSaving(true);
		try {
			await adminBuildYourOwnConfigService.update({
				minimumWeeklyOrderAmount: weeklyMin,
				minimumMonthlyOrderAmount: monthlyMin,
			});
			toast({ title: 'Build-your-own minimums updated' });
		} catch {
			toast({ title: 'Failed to update minimums', variant: 'destructive' });
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<CardTitle>Minimum Order Rules</CardTitle>
				</CardHeader>
				<CardContent className="grid gap-4 md:grid-cols-2">
					<div className="grid gap-2">
						<Label>Minimum weekly order amount</Label>
						<Input type="number" disabled={loading} value={String(weeklyMin)} onChange={(e) => setWeeklyMin(Number(e.target.value) || 0)} />
					</div>
					<div className="grid gap-2">
						<Label>Minimum monthly order amount</Label>
						<Input type="number" disabled={loading} value={String(monthlyMin)} onChange={(e) => setMonthlyMin(Number(e.target.value) || 0)} />
					</div>
					<div className="md:col-span-2">
						<Button onClick={save} disabled={loading || saving}>
							{saving ? 'Saving…' : 'Save'}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
