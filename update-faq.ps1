$filePath = "c:\Users\fathi\Desktop\OZ Gainz\OG-Gainz-WebApplication\Client\src\pages\Index.tsx"
$content = [System.IO.File]::ReadAllText($filePath, [System.Text.UTF8Encoding]::new($false))

# Update skip FAQ
$oldSkip = @'
                  <AccordionItem value="skip">
                    <AccordionTrigger>Can I skip a day?</AccordionTrigger>
                    <AccordionContent>
                      Yes — skip today's meal when plans change, without losing control of your routine.
                    </AccordionContent>
                  </AccordionItem>
'@

$newSkip = @'
                  <AccordionItem 
                    value="skip"
                    className="border-0 rounded-lg bg-gradient-to-r from-oz-primary/5 to-transparent px-4 py-1 hover:from-oz-primary/10 transition-all duration-300 data-[state=open]:bg-oz-primary/5"
                  >
                    <AccordionTrigger className="text-oz-primary font-medium hover:no-underline py-3 text-sm">
                      Can I skip a day?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pt-1 pb-3 leading-relaxed">
                      Absolutely! Life happens and plans change. You can skip any upcoming delivery day directly from your dashboard without affecting your subscription. This feature lets you maintain control over your meal schedule while staying flexible with your routine and commitments.
                    </AccordionContent>
                  </AccordionItem>
'@

$content = $content.Replace($oldSkip, $newSkip)

# Update trial FAQ (remove icon)
$oldTrial = @'
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-md">
                          <BadgeCheck className="h-5 w-5" />
                        </div>
                        <span>Is there a trial?</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pt-2 pb-4 pl-[52px]">
                      Yes — start with Trial Packs to experience OG Gainz before subscribing.
                    </AccordionContent>
'@

$newTrial = @'
                    <AccordionTrigger className="text-oz-primary font-medium hover:no-underline py-3 text-sm">
                      Is there a trial?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pt-1 pb-3 leading-relaxed">
                      Yes! We offer Trial Packs that let you experience the quality and taste of OG Gainz meals before committing to a subscription. These trial options give you a chance to try different meal varieties and see how our nutrition plans fit into your lifestyle and goals.
                    </AccordionContent>
'@

$content = $content.Replace($oldTrial, $newTrial)

# Update trial className
$content = $content.Replace(
    'value="trial" ' + [Environment]::NewLine + '                    className="border-0 rounded-xl bg-gradient-to-r from-oz-primary/5 to-oz-accent/5 px-5 py-2 shadow-sm hover:shadow-md transition-all duration-300 data-[state=open]:shadow-lg data-[state=open]:from-oz-primary/10 data-[state=open]:to-oz-accent/10"',
    'value="trial" ' + [Environment]::NewLine + '                    className="border-0 rounded-lg bg-gradient-to-r from-oz-accent/5 to-transparent px-4 py-1 hover:from-oz-accent/10 transition-all duration-300 data-[state=open]:bg-oz-accent/5"'
)

# Update delivery FAQ (remove icon)
$oldDelivery = @'
                    <AccordionTrigger className="text-oz-primary font-semibold hover:no-underline py-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white shadow-md">
                          <Truck className="h-5 w-5" />
                        </div>
                        <span>How does delivery work?</span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pt-2 pb-4 pl-[52px]">
                      Meals follow a clear daily workflow (cooking → packed → out for delivery → delivered).
                    </AccordionContent>
'@

$newDelivery = @'
                    <AccordionTrigger className="text-oz-primary font-medium hover:no-underline py-3 text-sm">
                      How does delivery work?
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm pt-1 pb-3 leading-relaxed">
                      Our meals follow a streamlined daily workflow to ensure freshness. Each day, your meals are prepared in our kitchen, carefully packed with quality ingredients, dispatched for delivery, and arrive at your doorstep. You can track your delivery status in real-time through your dashboard for complete transparency.
                    </AccordionContent>
'@

$content = $content.Replace($oldDelivery, $newDelivery)

# Update delivery className
$content = $content.Replace(
    'value="delivery" ' + [Environment]::NewLine + '                    className="border-0 rounded-xl bg-gradient-to-r from-oz-primary/5 to-oz-accent/5 px-5 py-2 shadow-sm hover:shadow-md transition-all duration-300 data-[state=open]:shadow-lg data-[state=open]:from-oz-primary/10 data-[state=open]:to-oz-accent/10"',
    'value="delivery" ' + [Environment]::NewLine + '                    className="border-0 rounded-lg bg-gradient-to-r from-green-500/5 to-transparent px-4 py-1 hover:from-green-500/10 transition-all duration-300 data-[state=open]:bg-green-500/5"'
)

[System.IO.File]::WriteAllText($filePath, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host "FAQ updated successfully!"
