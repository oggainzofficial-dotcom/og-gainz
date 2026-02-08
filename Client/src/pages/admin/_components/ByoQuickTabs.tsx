import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation, useNavigate } from 'react-router-dom';

type ByoTab = 'byo-items' | 'byo-item-types' | 'byo-minimums';

function getActiveTab(pathname: string): ByoTab {
	if (pathname.startsWith('/admin/byo-item-types')) return 'byo-item-types';
	if (pathname.startsWith('/admin/byo-items')) return 'byo-items';
	// Back-compat: treat old minimums route as minimums tab.
	if (pathname.startsWith('/admin/byo-config')) return 'byo-minimums';
	return 'byo-minimums';
}

export default function ByoQuickTabs() {
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = getActiveTab(location.pathname);

	return (
		<div className="w-full">
			<Tabs
				value={activeTab}
				onValueChange={(v) => {
					const value = v as ByoTab;
					if (value === 'byo-items') navigate('/admin/byo-items');
					if (value === 'byo-item-types') navigate('/admin/byo-item-types');
					if (value === 'byo-minimums') navigate('/admin/byo-minimums');
				}}
				className="w-full"
			>
				<div className="-mx-1 overflow-x-auto">
					<TabsList className="flex w-max flex-nowrap justify-start gap-1 rounded-xl border border-oz-neutral/20 bg-white/80 p-1 shadow-sm backdrop-blur">
						<TabsTrigger
							value="byo-items"
							className="rounded-lg px-4 py-2 data-[state=active]:bg-oz-primary data-[state=active]:text-white data-[state=active]:shadow"
						>
							BYO Items
						</TabsTrigger>
						<TabsTrigger
							value="byo-item-types"
							className="rounded-lg px-4 py-2 data-[state=active]:bg-oz-primary data-[state=active]:text-white data-[state=active]:shadow"
						>
							BYO Item Types
						</TabsTrigger>
						<TabsTrigger
							value="byo-minimums"
							className="rounded-lg px-4 py-2 data-[state=active]:bg-oz-primary data-[state=active]:text-white data-[state=active]:shadow"
						>
							BYO Minimum
						</TabsTrigger>
					</TabsList>
				</div>
			</Tabs>
		</div>
	);
}
