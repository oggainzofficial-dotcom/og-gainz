import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation, useNavigate } from 'react-router-dom';

type AddonsTab = 'addons' | 'addon-categories';

function getActiveTab(pathname: string): AddonsTab {
	if (pathname.startsWith('/admin/add-on-categories') || pathname.startsWith('/admin/addon-categories')) return 'addon-categories';
	return 'addons';
}

export default function AddonsQuickTabs() {
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = getActiveTab(location.pathname);

	return (
		<div className="w-full">
			<Tabs
				value={activeTab}
				onValueChange={(v) => {
					const value = v as AddonsTab;
					if (value === 'addons') navigate('/admin/add-ons');
					if (value === 'addon-categories') navigate('/admin/add-on-categories');
				}}
				className="w-full"
			>
				<div className="-mx-1 overflow-x-auto">
					<TabsList className="flex w-max flex-nowrap justify-start gap-1 rounded-xl border border-oz-neutral/20 bg-white/80 p-1 shadow-sm backdrop-blur">
						<TabsTrigger
							value="addons"
							className="rounded-lg px-4 py-2 data-[state=active]:bg-oz-primary data-[state=active]:text-white data-[state=active]:shadow"
						>
							Add-Ons Items
						</TabsTrigger>
						<TabsTrigger
							value="addon-categories"
							className="rounded-lg px-4 py-2 data-[state=active]:bg-oz-primary data-[state=active]:text-white data-[state=active]:shadow"
						>
							Add-On Categories
						</TabsTrigger>
					</TabsList>
				</div>
			</Tabs>
		</div>
	);
}
