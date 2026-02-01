$filePath = "c:\Users\fathi\Desktop\OZ Gainz\OG-Gainz-WebApplication\Client\src\pages\MealPackDetails.tsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.UTF8Encoding]::new($false))

# Update Highlights card header
$content = $content -replace '(<Card>\s+<CardHeader>\s+<CardTitle className="text-oz-primary">Highlights</CardTitle>)', '<Card className="border-2 border-oz-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
						<CardHeader className="bg-gradient-to-r from-oz-primary/5 to-oz-accent/5">
							<CardTitle className="text-oz-primary flex items-center gap-2">
								<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-oz-accent to-orange-500 flex items-center justify-center">
									<span className="text-white text-sm">✨</span>
								</div>
								Highlights
							</CardTitle>'

# Update Highlights card content wrapper
$content = $content -replace '(<CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">)', '<CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">'

# Update Protein highlight box
$content = $content -replace '(<div className="rounded-lg bg-oz-neutral/30 p-4">\s+<div className="text-xs text-muted-foreground">Protein per meal</div>\s+<div className="mt-1 font-semibold text-oz-primary inline-flex items-center gap-2">\s+<Zap className="h-4 w-4 text-oz-secondary" />)', '<div className="rounded-xl bg-gradient-to-br from-oz-primary/10 to-oz-secondary/10 p-5 border border-oz-primary/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Protein per meal</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-oz-secondary to-oz-secondary/80 flex items-center justify-center shadow-md">
										<Zap className="h-5 w-5 text-white" />'

# Update Calories highlight box  
$content = $content -replace '(<div className="rounded-lg bg-oz-neutral/30 p-4">\s+<div className="text-xs text-muted-foreground">Calories</div>\s+<div className="mt-1 font-semibold text-oz-primary inline-flex items-center gap-2">\s+<Leaf className="h-4 w-4 text-oz-accent" />)', '<div className="rounded-xl bg-gradient-to-br from-oz-accent/10 to-orange-500/10 p-5 border border-oz-accent/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Calories</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-oz-accent to-orange-500 flex items-center justify-center shadow-md">
										<Leaf className="h-5 w-5 text-white" />'

# Update Servings highlight box
$content = $content -replace '(<div className="rounded-lg bg-oz-neutral/30 p-4">\s+<div className="text-xs text-muted-foreground">Servings</div>\s+<div className="mt-1 font-semibold text-oz-primary inline-flex items-center gap-2">\s+<BadgeCheck className="h-4 w-4 text-oz-secondary" />)', '<div className="rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10 p-5 border border-green-500/20 shadow-sm hover:shadow-md transition-all duration-300">
								<div className="text-xs text-muted-foreground font-medium mb-2">Servings</div>
								<div className="font-bold text-oz-primary inline-flex items-center gap-2 text-xl">
									<div className="h-10 w-10 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-md">
										<BadgeCheck className="h-5 w-5 text-white" />'

# Fix closing divs for all three boxes
$content = $content -replace '\{isLoading \? ''—'' : `\$\{effectiveProteinPerMeal \?\? meal\?\.proteinPerMeal \?\? 0\}g`\}\s+</div>\s+</div>', '{isLoading ? ''—'' : `${effectiveProteinPerMeal ?? meal?.proteinPerMeal ?? 0}g`}
								</div>
							</div>'

$content = $content -replace '\{isLoading \? ''—'' : meal\?\.caloriesRange \|\| ''Balanced Calories''\}\s+</div>\s+</div>', '{isLoading ? ''—'' : meal?.caloriesRange || ''Balanced''}
								</div>
							</div>'

$content = $content -replace '\{isLoading \? ''—'' : meal\?\.servings\}\s+</div>\s+</div>\s+</CardContent>', '{isLoading ? ''—'' : meal?.servings}
								</div>
							</div>
						</CardContent>'

# Update Included Items card
$content = $content -replace '(\{\!isLoading && \(dynamicIncluded\.length > 0 \|\| included\.length > 0\) && \(\s+)<Card>\s+<CardHeader>\s+<CardTitle className="text-oz-primary">Included Items</CardTitle>', '$1<Card className="border-2 border-oz-primary/10 shadow-lg hover:shadow-xl transition-shadow duration-300">
									<CardHeader className="bg-gradient-to-r from-oz-primary/5 to-oz-accent/5">
										<CardTitle className="text-oz-primary flex items-center gap-2">
											<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
												<span className="text-white text-sm">🥗</span>
											</div>
											Included Items
										</CardTitle>'

$content = $content -replace '(<CardHeader>\s+<CardTitle className="text-oz-primary flex items-center gap-2">.*?</CardTitle>\s+</CardHeader>\s+<CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">)', '$1' -replace '(<CardContent className="grid grid-cols-1 sm:grid-cols-2) gap-2">', '$1 gap-3 pt-6">'

# Update Included Items list items
$content = $content -replace '(<div key=\{it\.key\} className="flex items-center gap-2 text-sm text-oz-primary">\s+<div className="h-6 w-6 rounded-full bg-oz-secondary/10 flex items-center justify-center">\s+<Check className="h-4 w-4 text-oz-secondary" />)', '<div key={it.key} className="flex items-center gap-3 text-sm text-oz-primary p-2 rounded-lg bg-gradient-to-r from-oz-primary/5 to-transparent hover:from-oz-primary/10 transition-colors duration-200">
												<div className="h-7 w-7 rounded-full bg-gradient-to-br from-oz-secondary to-oz-secondary/80 flex items-center justify-center shadow-sm">
													<Check className="h-4 w-4 text-white" />'

$content = $content -replace '(</div>\s+)\{it\.label\}', '$1<span className="font-medium">{it.label}</span>'

# Update Pricing card
$content = $content -replace '(<div className="lg:col-span-1">\s+<div className="sticky top-24">\s+)<Card className="border-oz-secondary">\s+<CardHeader className="bg-oz-secondary/5">\s+<CardTitle className="text-oz-primary">Pricing</CardTitle>', '$1<Card className="border-2 border-oz-secondary/30 shadow-2xl">
							<CardHeader className="bg-gradient-to-r from-oz-secondary/10 to-oz-accent/10 border-b border-oz-secondary/20">
								<CardTitle className="text-oz-primary flex items-center gap-2">
									<div className="h-8 w-8 rounded-lg bg-gradient-to-br from-oz-secondary to-oz-accent flex items-center justify-center">
										<span className="text-white text-sm">💰</span>
									</div>
									Pricing
								</CardTitle>'

# Update buttons
$content = $content -replace '(<Button\s+className="w-full bg-oz-secondary hover:bg-oz-secondary/90) h-11"', '$1 h-12 font-semibold shadow-lg hover:shadow-xl transition-all duration-300" style={{background: "linear-gradient(to right, var(--oz-secondary), rgba(var(--oz-secondary-rgb), 0.9))"}'

$content = $content -replace '(<Button className="w-full bg-oz-accent hover:bg-oz-accent/90) h-11"', '$1 h-12 font-semibold shadow-lg hover:shadow-xl transition-all duration-300" style={{background: "linear-gradient(to right, var(--oz-accent), #f97316)"}'

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "File updated successfully!"
