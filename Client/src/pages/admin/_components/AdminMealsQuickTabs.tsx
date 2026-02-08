import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocation, useNavigate } from 'react-router-dom';

type AdminMealsQuickTabValue = '' | 'meal-types' | 'included-items';

function getActiveTab(pathname: string): AdminMealsQuickTabValue {
	if (pathname.startsWith('/admin/meal-types')) return 'meal-types';
	if (pathname.startsWith('/admin/included-items')) return 'included-items';
	return '';
}

export default function AdminMealsQuickTabs() {
	const location = useLocation();
	const navigate = useNavigate();

	const activeTab = getActiveTab(location.pathname);

	return (
		<div className="w-full">
			<Tabs
				value={activeTab}
				onValueChange={(v) => {
					const value = (v || '') as AdminMealsQuickTabValue;
					if (value === 'meal-types') navigate('/admin/meal-types');
					if (value === 'included-items') navigate('/admin/included-items');
				}}
				className="w-full"
			>
				<div className="-mx-1 overflow-x-auto">
					<TabsList className="flex w-max flex-wrap justify-start gap-1 bg-muted p-1">
						<TabsTrigger value="meal-types">Meal Types</TabsTrigger>
						<TabsTrigger value="included-items">Included Items</TabsTrigger>
					</TabsList>
				</div>
			</Tabs>
		</div>
	);
}
