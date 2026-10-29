export default {
	meta: 'Manna · {entity}\nEffective upon store release (draft)\nContact: {support}',
	privacy: {
		titleKey: 'legal_privacy',
		fallbackTitle: 'Privacy Policy',
		sections: [
			{
				heading: 'Introduction',
				paragraphs: [
					'Manna (“we”, “us”, or “our”) provides a mobile application for daily affirmations, gentle devotion, check-ins, wallpapers, and optional AI reflection features. This Privacy Policy explains what information we collect, how we use it, and your choices.',
					'If you do not agree with this Policy, do not use the App.',
				],
			},
			{
				heading: 'Information We Collect',
				paragraphs: [
					'Account & identifiers: a locally generated device identifier (device_id), optional Google or Apple bind identifiers, and your server-issued user ID.',
					'Profile & preferences: optional display name, language, onboarding answers you choose to provide, marketing opt-in, sound/mute settings, and check-in reminder preferences.',
					'Usage & analytics: product events (views, likes, shares, check-ins, VIP funnel) and basic device/app metadata for diagnostics.',
					'User content: likes, collections, history, self-written affirmations, reports, and AI chat messages you send.',
					'Purchases: subscription status and store transaction identifiers needed to validate App Store / Google Play purchases. Full payment card numbers are processed by Apple or Google, not stored by Manna.',
					'Photos: if you save a share card, the image is written to your photo library with permission. We do not upload your camera roll.',
					'We do not require precise location, contacts, microphone, or camera for core features in version 1.0.',
				],
			},
			{
				heading: 'How We Use Information',
				paragraphs: [
					'We use information to provide and sync features, personalize feeds, enforce AI quotas and VIP entitlements, schedule local reminders you enable, improve product quality, comply with law, prevent abuse, and send marketing only if you opt in.',
				],
			},
			{
				heading: 'AI Processing',
				paragraphs: [
					'AI replies are generated via a configurable third-party model provider. Message content you submit is processed to return a response and apply safety filters. AI output is informational only and is not pastoral, medical, legal, or mental-health advice.',
				],
			},
			{
				heading: 'Sharing',
				paragraphs: [
					'We share data with infrastructure vendors, AI providers, Apple/Google for auth and purchase validation, and authorities when legally required. We do not sell your personal information.',
				],
			},
			{
				heading: 'Scripture translation (Google Translate API)',
				paragraphs: [
					'When you use in-app Bible translation, we send the verse text you request to the Google Translate API and display the live result on screen. Translation is generated in real time at the moment you tap Translate.',
					'We do not save, catalog, or publish the machine-translated text as a stored Bible edition. The licensed or public-domain source (for example WEB or KJV where used) remains the canonical copy. Google and Google Translate are trademarks of Google LLC.',
				],
			},
			{
				heading: 'Retention, Security & Children',
				paragraphs: [
					'We retain account and content data while your account remains active and as needed for subscriptions, security, and legal obligations. Request deletion via {support}.',
					'We use HTTPS in production and standard access controls. No method of transmission is 100% secure.',
					'Manna is not directed to children under 13 (or the minimum age required in your country). Contact us if you believe a child has provided data.',
				],
			},
			{
				heading: 'Your Choices & Contact',
				paragraphs: [
					'You may bind or skip Google/Apple; toggle marketing, sounds, and reminders; limit photo access in system settings; and request access or deletion via {support}.',
					'Controller / operator: {entity}.',
				],
			},
		],
	},
	terms: {
		titleKey: 'legal_terms',
		fallbackTitle: 'Terms of Use',
		sections: [
			{
				heading: 'Agreement',
				paragraphs: [
					'By downloading or using Manna, you agree to these Terms and our Privacy Policy. If you do not agree, do not use the App.',
				],
			},
			{
				heading: 'The Service & Accounts',
				paragraphs: [
					'Manna offers affirmations, topics, wallpapers, check-ins, sharing tools, and optional AI chat. Features may differ by platform, region, and subscription status.',
					'Default access uses a device-based account. Binding Google or Apple helps preserve collections after reinstall. You are responsible for activity under your account. We may suspend accounts that abuse the service or violate these Terms.',
				],
			},
			{
				heading: 'Acceptable Use',
				paragraphs: [
					'You agree not to unlawfully scrape or disrupt the service; upload unlawful or infringing content; bypass AI quotas, VIP locks, or payment systems; misrepresent Manna as professional counseling; or use the App to harm yourself or others. If you are in crisis, contact local emergency services or listed helplines.',
				],
			},
			{
				heading: 'Content, AI & Subscriptions',
				paragraphs: [
					'App software, branding, and curated catalogs are owned by Manna or licensors. You retain rights to text you create and grant us a license to host it to operate the product.',
					'AI responses can be inaccurate. They are not a substitute for clergy, therapists, physicians, or lawyers.',
					'Paid features are auto-renewing subscriptions billed by Apple or Google. See Subscription Terms in the App and the store product page. Prices are set by the stores.',
				],
			},
			{
				heading: 'Scripture and machine translation',
				paragraphs: [
					'Bible text in Manna is displayed from licensed or public-domain editions. Optional on-screen translation is provided exclusively by calling the Google Translate API in real time when you request it. It is not a stored, official, or publisher-authorized Bible translation.',
					'Machine output may be inaccurate. You may not scrape, redistribute, or commercially exploit the displayed rendering as a new Bible version. Use “Show original” to return to the source text.',
				],
			},
			{
				heading: 'Disclaimers',
				paragraphs: [
					'THE APP IS PROVIDED “AS IS” WITHOUT WARRANTIES OF ANY KIND, TO THE MAXIMUM EXTENT PERMITTED BY LAW.',
					'TO THE MAXIMUM EXTENT PERMITTED BY LAW, MANNA AND {entity} SHALL NOT BE LIABLE FOR INDIRECT OR CONSEQUENTIAL DAMAGES ARISING FROM YOUR USE OF THE APP.',
					'Contact: {support}.',
				],
			},
		],
	},
	subscription: {
		titleKey: 'legal_subscription',
		fallbackTitle: 'Subscription Terms',
		sections: [
			{
				heading: 'Products & Trial',
				paragraphs: [
					'Manna VIP may be offered as monthly and/or yearly auto-renewing subscriptions. Exact product IDs and prices are shown by Apple or Google at purchase time and may vary by region.',
					'Where offered, a 3-day free trial is an official store introductory offer. Unless canceled in time under store rules, the subscription converts to a paid plan and your payment method is charged.',
				],
			},
			{
				heading: 'Renewal, Cancel & Restore',
				paragraphs: [
					'Subscriptions renew automatically until canceled in Apple ID settings or Google Play subscriptions. Deleting the App does not cancel a subscription.',
					'Use Restore Purchases after reinstall or device change. Entitlements are validated with store receipts. Binding Google/Apple is recommended so VIP follows your account.',
					'Refunds are handled by Apple or Google under their policies.',
				],
			},
		],
	},
	help: {
		titleKey: 'legal_help',
		fallbackTitle: 'Help & FAQ',
		sections: [
			{
				heading: 'Getting started',
				paragraphs: [
					'Q: Do I need an account?\nA: Manna creates a lightweight account from your device ID. Bind Google or Apple to keep favorites after reinstall.',
					'Q: What does Free include?\nA: Daily affirmations, limited AI quota, free wallpapers, and core sharing.',
					'Q: What does VIP unlock?\nA: Higher AI limits, VIP topics/wallpapers where configured, watermark control, and benefits listed on the VIP page.',
				],
			},
			{
				heading: 'Check-in & support',
				paragraphs: [
					'Q: How do check-ins work?\nA: Check in daily to build a streak. Hearts can freeze short misses; missing more than the configured days may reset the streak. Free users may earn AI quota on successful check-in.',
					'Q: How do I contact support?\nA: Email {support} and include your User ID from Settings.',
					'If you are in crisis, contact local emergency services. The App may show regional helpline resources.',
				],
			},
			{
				heading: 'Bible translation',
				paragraphs: [
					'Q: How does verse translation work?\nA: Manna calls the Google Translate API when you tap Translate. The result is generated in real time for this page only and is not saved as a translated Bible.',
					'Q: Why isn’t this an official translation?\nA: Copyrighted Bible editions cannot be replaced by a stored machine translation. The source text stays the licensed copy; Google Translate API output is a live convenience overlay.',
				],
			},
		],
	},
}
