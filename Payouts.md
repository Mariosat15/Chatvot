I've completed a thorough study of Payouts.md and the entire deposit/withdrawal system. Here's my analysis and plan. No code changes made yet — this is check-only as you asked.

PHASE 1 — ANALYSIS
What the new API actually is
Payouts.md is CreditPilot®, a payout-only gateway (the title is literally "API specification for payout methods"). Evidence and shape:

Aspect	Detail (from doc)
Transport
HTTPS GET, Basic auth (Base64 login:password), XML responses
URL
https://[server]/KPDealerWeb/KPBossHttpServer?actionName=… (test test.creditpilot.com:8080, prod payout.creditpilot.com:8080)
Flow
PREPARE (validate, no provider call) → PAY (queues the payout) → FINDPAY (poll final status)
Other actions
ACCOUNTS (balances), PROVIDERS2 (services + field rules), GETTRANSACTIONS/GETROLLBACKS (daily reconciliation), GETERRS
Key fields
dealerTransactionId (unique numeric ≤20 digits), serviceProviderId (which payout service), amount/amountAll, phoneNumber (= payer/destination id: account/card/IBAN), paydeskId, terminalId, remoteSystemId, instrumentType (1 cash/2 card/3 mobile/4 wallet)
Hard rules
Async — never infer success from PAY; on timeout you must call FINDPAY. Retry on 5xx/-55000.
Critical implication: CreditPilot has no deposit/acquiring API. So your deposit system is unaffected — this is purely a new withdrawal/payout provider. Deposits stay on Nuvei/Atlas/Stripe/Paddle.

Your withdrawal system is already built for this (the good news)
The repo already has a plug-and-play payout architecture whose file headers literally document the "add a provider" recipe:

Capability registry — lib/services/payout/payout-providers.ts (+ admin mirror): PAYOUT_PROVIDERS with supportsPayout/supportsCardPayout/supportsBankPayout/enableFlag. The admin provider dropdown is driven by getPayoutCapableProviders().
Routing — lib/services/payout/withdrawal-routing.ts (+ mirror): resolveWithdrawalRouting + resolvePayoutExecution are fully capability-driven (card→PSP-only, bank→PSP-or-manual). No per-provider if branches.
Execution contract — apps/admin/lib/services/payout/payout-adapter.ts + payout-adapter-registry.ts + adapters/nuvei.payout-adapter.ts.
Admin approval route — apps/admin/app/api/withdrawals/[id]/route.ts (processing case) already does getPayoutAdapter(providerId).executePayout(...) — provider-agnostic.
Settings — withdrawal-settings.model.ts (+ mirror) has withdrawalProvider, sendWithdrawalsToProvider, nuveiWithdrawalEnabled, usePaymentProcessorForManual. The save route spreads updates with runValidators, so new schema fields persist automatically.
Credentials — PaymentProvider collection keyed by slug + credentials[] (Nuvei reads via getCredentials()); admin PaymentProvidersSection.tsx has a BUILT_IN_PROVIDERS catalog with default credential fields.
fast-xml-parser is already a dependency. ✅
The admin selector already says "Only providers that support payouts are listed" — so CreditPilot appears the moment it's registered.

Gaps / weaknesses to solve (evidence-based)
Async settlement is the real work. Nuvei's payout.do is treated as synchronous (adapter returns a txn id → admin marks completed; the worker job worker/jobs/withdrawal-process.job.ts only sends reminders, no status polling). CreditPilot queues then needs FINDPAY. So we must add a status poller to finalize processing → completed/failed (and refund credits on failure).
Per-provider "enable" UI is Nuvei-hardcoded in WithdrawalSettingsSection.tsx (nuveiWithdrawalEnabled, nuveiAutoActive). Needs a CreditPilot equivalent (or generalization).
No card-refund equivalent. Nuvei refunds to the original card via stored UPO; CreditPilot pays to a destination identifier (IBAN/account/card number) per serviceProviderId — no UPO. So CreditPilot should declare supportsCardPayout: false, supportsBankPayout: true. The capability router then correctly sends original-card withdrawals to manual and bank withdrawals to CreditPilot — no route changes needed.
Admin has its own service copies (apps/admin/lib/services/nuvei.service.ts, atlas.service.ts exist) → CreditPilot needs a mirrored service in both lib/services/ and apps/admin/lib/services/.
dealerTransactionId must be unique numeric ≤20 digits → need a generator + store the mapping on the withdrawal.
serviceProviderId selection (per currency/scheme) must be configurable (store in PaymentProvider credentials; discover via PROVIDERS2).
PHASE 2 — PLAN (minimal, follows the documented pattern)
Provider: slug creditpilot, supportsPayout: true, supportsBankPayout: true, supportsCardPayout: false (v1), enableFlag: "creditpilotWithdrawalEnabled".

#	Step	Files (main + admin mirror)
1
Register provider in the capability registry
lib/services/payout/payout-providers.ts + apps/admin/…/payout-providers.ts
2
Settings flag creditpilotWithdrawalEnabled (default false)
database/models/withdrawal-settings.model.ts + admin mirror
3
CreditPilot service (getCredentials, call() w/ Basic auth + XML parse + retry, prepare/pay/findPay/getBalances/…, submitPayout) — <500 lines, stateless per services.mdc
new lib/services/creditpilot.service.ts + apps/admin/lib/services/creditpilot.service.ts
4
Payout adapter (PREPARE→PAY, map to submitted/skipped/error, store billNumber+dealerTransactionId) + register it
new apps/admin/lib/services/payout/adapters/creditpilot.payout-adapter.ts + edit payout-adapter-registry.ts
5
Status poller (worker) — finalize processing→completed/failed via FINDPAY; refund on failure; reuse the admin route's completion/fee logic (extract a shared helper — DRY). Optional daily GETTRANSACTIONS/GETROLLBACKS reconciliation.
extend worker/jobs/withdrawal-process.job.ts (or new creditpilot-reconcile.job.ts)
6
Admin UI: CreditPilot "Automatic Processing" card gated on selectedProviderId === "creditpilot"; make the status banner provider-aware; add creditpilot to BUILT_IN_PROVIDERS (login, password, base_url, remote_system_id, paydesk_id, terminal_id, service_provider_id, account_currency)
WithdrawalSettingsSection.tsx, PaymentProvidersSection.tsx
7
Config/seed a PaymentProvider{ slug:"creditpilot" } doc with credentials (secrets flagged)
admin Payment Providers UI
8
Tests + docs (XML parse, status mapping, id generator, routing) + README
*.test.ts, README.md
Trade-offs, risks, edge cases
Money-critical (P0): finalize inside DB transactions; idempotent (unique dealerTransactionId; on retry call FINDPAY before re-PAY); refund credits on failure/rollback.
Card refunds: with CreditPilot selected, original-card withdrawals become manual (correct — it can't refund cards). If you want Nuvei card-refunds + CreditPilot bank payouts simultaneously, that needs per-method provider routing (bigger change) vs today's single withdrawalProvider switch.
Ops: CreditPilot requires an IP allowlist (coordinated pool) + credentials from them.
Mirroring rule: keep payout-providers, withdrawal-routing, withdrawal-settings.model, and the new service in sync across main/admin.
Estimated effort: ~2–4 focused days for v1 (bank payouts + poller + admin toggle), the poller/finalization being the bulk.

Before I implement — two decisions
Provider selection model: simple single switch (pick CreditPilot or Nuvei), or per-method routing (Nuvei for card refunds + CreditPilot for bank payouts at the same time)?
CreditPilot scope for v1: bank/IBAN payouts only (recommended), or also attempt card-number payouts (user types the destination card number, instrumentType=2) if your CreditPilot services support it?
Want me to proceed with the recommended v1 (single-switch, bank-only, with the finalization poller), or adjust based on your answers?

explain in simple terms : Trade-offs, risks, edge cases

Money-critical (P0): finalize inside DB transactions; idempotent (unique dealerTransactionId; on retry call FINDPAY before re-PAY); refund credits on failure/rollback.

Card refunds: with CreditPilot selected, original-card withdrawals become manual (correct — it can't refund cards). If you want Nuvei card-refunds + CreditPilot bank payouts simultaneously, that needs per-method provider routing (bigger change) vs today's single withdrawalProvider switch.

Ops: CreditPilot requires an IP allowlist (coordinated pool) + credentials from them.

Mirroring rule: keep payout-providers, withdrawal-routing, withdrawal-settings.model, and the new service in sync across main/admin.

Estimated effort: ~2–4 focused days for v1 (bank payouts + poller + admin toggle), the poller/finalization being the bulk.



Before I implement — two decisions

Provider selection model: simple single switch (pick CreditPilot or Nuvei), or per-method routing (Nuvei for card refunds + CreditPilot for bank payouts at the same time)?

CreditPilot scope for v1: bank/IBAN payouts only (recommended), or also attempt card-number payouts (user types the destination card number, instrumentType=2) if your CreditPilot services support it?

Want me to proceed with the recommended v1 (single-switch, bank-only, with the finalization poller), or adjust based on your answers?


Here's each point in plain language.

Money-critical (P0)
This is about never losing money or paying someone twice.

Finalize inside DB transactions — When a payout finishes, several database updates happen together (mark the withdrawal done, record the fee, update totals). A "transaction" means all of them succeed or none of them do — like a bank transfer that either fully completes or fully cancels, never half. This prevents a broken state where, say, the user was paid but our records didn't update.
Idempotent + unique dealerTransactionId — Every payout gets its own unique receipt number. That way, if the system tries the same payout twice (e.g. a retry), CreditPilot recognizes the number and won't send the money again. Like pressing an elevator button twice — still one elevator.
On retry, call FINDPAY before re-PAY — If we send a payout and the connection drops before we get an answer, we don't know if it went through. Instead of blindly sending again (risking a double payment), we first ask CreditPilot "did this one already happen?" (that's FINDPAY), then decide. Like checking your bank statement before re-paying a bill you're unsure about.
Refund credits on failure/rollback — If the payout ultimately fails, we put the credits back in the user's wallet automatically. Like an ATM returning your money if it can't dispense cash.
Card refunds
Nuvei can send money back to the exact card someone deposited with (a refund). CreditPilot cannot do that — it pays out to a destination like a bank account. So if you switch withdrawals to CreditPilot, a user asking to "withdraw back to my card" would have to be paid by hand by you (the system correctly flags it as manual). If you want both at once — cards refunded automatically by Nuvei and bank payouts by CreditPilot — that's a bigger change (see decision 1 below).

Ops (setup, not code)
Before CreditPilot works live, they need to: put your server's IP addresses on their approved list (a security "guest list"), and give you a login/password + a few IDs. This is a coordination/paperwork step with CreditPilot, separate from the coding.

Mirroring rule
This project keeps two copies of certain files — one for the main app, one for the admin app (like two identical control panels). If I add CreditPilot, I must update both copies or the two apps will disagree and break.

Estimated effort
About 2–4 focused days for the first version. Most of that time goes into the "poller" — a small background job that keeps checking CreditPilot "is this payout done yet?" and then marks it complete or refunds it. (CreditPilot doesn't call us back; we have to keep asking.)



Changes	history	
Version	
2.0.26-01	
Date	
01/03/2026	
Changes	
The	protocol	description	has	been	updated.		
01/06/2026	
Outdated	methods	have	been	removed.	
…	
2 
API	specification	for	payout	methods	
CONTENT	
1 TERMS	AND	DEFINITIONS 
4 
2 GENERAL	DESCRIPTION 
4 
2.1 GENERAL	REQUIREMENTS 
2.2 REQUEST	TYPES 
2.3 GENERAL	PRINCIPLES	OF	INTERACTION 
3 MESSAGES	PROCESSING 
4 
4 
4 
6 
3.1 GENERAL	REQUIREMENTS 
3.2 PAYMENT	REQUESTS 
3.2.1 CHECK	THE	POSSIBILITY	OF	PAYMENT 
3.2.2 CREATE	PAYMENT 
3.2.3 GET	PAYMENT	STATUS 
3.3 FINANCE	REQUESTS 
3.3.1 GET	CURRENT	BALANCES	IN	THE	SYSTEM 
3.4 DICTIONARIES 
3.4.1 LIST	OF	SYSTEM	ERRORS 
3.4.2 LIST	OF	AVAILABLE	SERVICES 
3.5 PAYMENT	RECONCILIATION 
3.5.1 GET	LIST	OF	SUCCESSFUL	PAYMENTS 
3.5.2 GET	LIST	OF	CANCELLED	PAYMENTS 
ANNEX	1.	RESPONSE	CODES 
6 
6 
6 
8 
10 
12 
12 
13 
13 
14 
17 
17 
18 
20 
ANNEX	2.	GATEWAY	ADDRESS 
21 
ANNEX	3.	TEST	SERVICES 
21 
ANNEX	4.	MANDATORY	METHODS	FOR	IMPLEMENTATION. 
21 
3 
API	specification	for	payout	methods	
1 Terms	and	Definitions	
Contractor	(partner)	-	external	payment	acceptance	systems	that	have	a	valid	contract	with	the	
Company	of	system	CreditPilot®	and	use	their	own	software	to	receive	payments.	
External	partner	system	(EPS)	-	software	developed	by	a	partner	to	interact	with	the	CreditPilot	
system	through	a	gateway.	
Gateway	(API)	is	a	special	functionality	of	the	system	that	allows	partners	to	use	all	the	
functionality	of	the	system	using	their	software.	
Message	-	a	request	from	the	Contractor	to	the	Subsystem	or	a	response	of	the	Subsystem;	
An	informational	message	is	a	message	which	results	from	direct	processing	by	the	Subsystem	
and/or	Contractor	that	does	not	cause	a	change	in	the	financial	condition	of	the	participants	in	
the	payment	process.	
Payment/financial	message	is	a	message	which	results	in	direct	processing	by	the	Subsystem	
and/or	Contractor	cause	a	change	in	the	financial	condition	of	the	participants	in	the	payment	
process.	
2 General	Description	
2.1 General	requirements		
The	API	provides	an	opportunity	for	partners	to	connect	to	the	CreditPilot	substation	using	
proprietary	software	(EPS).	
2.2 Request	types	
The	API	includes	the	following	groups	of	requests	
• Payment	and	information	messages;	
• Classifiers;	
• Payment	Reconciliation.	
2.3 General	principles	of	interaction		
Data	exchange	between	an	external	partner	system	(EPS)	and	the	system	gateway	occurs	
through	the	exchange	of	HTTP	messages	through	a	secure	SSL	channel	using	the	HTTPS	protocol.	
ESP	is	always	the	initiator	of	data	exchange.	The	gateway	does	not	begin	the	exchange	of	data	on	
its	own	initiative	under	any	circumstances.	Therefore,	if	you	do	not	receive	a	response	to	any	
request,	you	should	repeat	this	request.	
EPS	software	must	correctly	process	standard	HTTP	protocol	responses	in	accordance	with	RFC	
2616,	RFC	1945.	5xx	responses	(section	"10.5	Server	Error	5xx"	in	RFC	2616,	"9.5	Server	Error	
4 
API	specification	for	payout	methods	
5xx"	in	RFC	1945)	indicate	that	the	server	is	unavailable.	It	is	necessary	to	send	the	request	
again	after	a	while,	upon	receiving	such	a	response.	
For	EPS,	a	pool	of	IP	addresses	should	be	coordinated	and	controlled,	from	which	a	partner	can	
access	the	System	server.	
All	requests	from	the	EPS	are	transmitted	to	the	server	using	the	GET	method	in	UTF-8	encoding	
with	the	mandatory	transfer	of	the	actionName	parameter	and	authorization	parameters	in	the	
standard	Basic	authentication	format	(Base64	encoded	login:	password	string).	
All	requests	sent	to	the	address	(URL):		
https://[server	address]/KPDealerWeb/KPBossHttpServer?actionName=[request	name]	
General	request	format:	
GET	{URL}?[parameter_name=parameter_value&...]	HTTP/1.1	
Authorization:	Basic	{login:password	в	Base64}	
System	responses	are	presented	in	XML	format.	
If	the	request	is	sent	in	the	wrong	format,	the	following	response	may	be	returned:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0">	
<result	resultCode="-55000"	resultDescription="Wrong	request	format"/>	
</kp-dealer>	
Attention!		
If	you	receive	a	response	of	“-55000”	to	any	request,	you	should	stop	its	execution	and	check	the	
correctness	of	formation.	If	in	the	explicit	form	of	an	error	it	is	not	clear	(if	the	Contractor	
believes	that	he	is	forming	everything	correctly),	then	it	is	necessary	to	contact	the	technical	
support	of	the	system.	
If	the	Contractor	makes	a	decision	on	the	success	or	failure	of	the	payment,	upon	sending	of	
which	the	code	“-55000”	was	received	in	any	of	the	payment	requests,	claims	for	this	payment	
are	NOT	CONSIDERED		
5 
API	specification	for	payout	methods	
3 Messages	processing	
3.1 General	requirements	
The	API	provides	processing	in	accordance	with	the	following	formats	of	the	following	types	of	
messages:	
• Payment	requests:	
o Check	the	possibility	of	payment.	
o Create	payment.	
o Get	payment	status.	
• Financial	requests	
o Get	current	balances	in	the	System.	
• Dictionaries	
o List	of	system	responses	(errors).	
o List	of	available	services	with	params	description.	
• Information	requests	
o List	of	system	messages,	news	etc.	
• Payment’s	reconciliations		
o List	of	successful	payments.	
o List	of	cancelled	payments.	
3.2 Payment	requests	
3.2.1 Check	the	possibility	of	payment	
Sent	after	the	Client	enters	the	payment	details.	
Verification	is	performed	on	the	System	side	without	sending	data	to	the	Provider.	
Request	format:	
actionName=PREPARE&accountCurrency=EUR&dealerTransactionId=2223&serviceProviderId=78102030
4&amount=10&amountAll=11&phoneNumber=12345678901234&paydeskId=123&terminalId=123&para
ms[‘paramName1']=11&params[‘paramName2']=22	
Request	fields:	
Field	name	
Mandatory	Type	
Description	
actionName	
Yes	
string	
accountCurrency	
It should be equal to the value «PREPARE»	
Yes	
String(3)	
Indication	of	the	account	in	the	KP	system	
from	where	the	funds	will	be	debited	for	the	
transaction	
6 
API	specification	for	payout	methods	
dealerTransactionId	
Yes	
long	
client	transaction	number	(numeric	identifier	
up	to	20	symbols)1	
serviceProviderId	
Yes	
string	
service ID	
amount	
Yes	
double	
Payment	amount	to	be	credited	to	the	client’s	
account	with	the	Provider	
amountAll	
Yes	
double	
Amount	of	payment	received	from	the	client	
(including	commission)2	
phoneNumber	
Yes	
string	
paydeskId	
Yes	
string	
Payer	ID3	
Cashbox number4	
terminalId	
Yes	
string	
EPS	Payment	Point	Number	
params	
No	
string	
Response	format:	
In	case	of	a	successful	response:	
Additional	payment	parameters5	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0">	
<result	resultCode="0"	resultDescription="Operation	completed	successfully"/>	
</kp-dealer>	
In	this	case,	success	means	that	all	checks	on	the	side	of	the	System	have	been	made	(no	requests	
are	made	to	the	Provider	at	this	stage),	and	you	can	proceed	to	send	a	request	for	payment.	
Attention!		
If,	based	on	the	response	about	the	success	of	the	PREPARE	request,	the	Contractor	decides	on	
the	success	of	the	payment,	which	will	ultimately	fail,	the	claims	for	this	payment	are	NOT	
CONSIDERED.	
In	case	of	a	wrong	response6:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0">	
<result	resultCode="-20110"	resultDescription="Payment	to	the	service	provider	is	prohibited."/>	
</kp-dealer>	
1	The	uniqueness	of	the	identifier	for	all	payments	of	the	counterparty	should	be	ensured.	
2 If	not	specified,	then	it	is	considered	that	amountAll	=	amount.	The	transfer	of	the	full	amount	is	required	
for	some	services	
3 The	payer	identifier	can	be	a	phone	number,	personal	account	number,	card	number,	etc.	It	is	determined	
by	the	parameters	of	a	particular	service.	
4 If	not	specified,	then	the	default	cashbox	is	used	for	the	operator	whose	login	is	used	for	authorization.	
5 It	is	indicated	if	required	by	the	Provider	through	query	parameters	of	the	form	params	['paramName1']	
(the	presence	of	single	quotes	is	mandatory),	where	paramName1	is	the	name	of	an	additional	parameter	
depending	on	a	specific	service	(see	section	3.4.2).	
6 Completely	all	response	codes	are	available	upon	request	of	the	error	code	directory	(see	3.4.1),	as	well	as	
a	list	of	the	main	codes	that	must	be	supported	is	given	in	Annex	1 
7 
 
 
API	specification	for	payout	methods	
	
  
8 
 
	Response	fields:	
Field	name	Type	Description	
resultCode	string	Response	code	
resultDescription	string	Response	description	
	
3.2.2 Create	payment	
The	request	is	sent	after	receiving	a	successful	response	to	the	payment	verification.	
	
Request	format:	
actionName=PAY&accountCurrency=EUR&dealerTransactionId=2223&serviceProviderId=781020304&am
ount=10&amountAll=11&paydeskId=123&terminalId=123&remoteSystemId=2011060&phoneNumber=12
345678901234&params[‘paramName1']=11&params[‘paramName2']=22&instrumentType=1	
Request	fields7:	
Field	name	Mandatory	Type	Description	
actionName	Yes	string	It	should	be	equal	to	the	value	«PAY»	
accountCurrency	Yes	String(3)	Indication	of	the	account	in	KP	systems	from	
where	the	funds	will	be	debited	for	
transaction	
dealerTransactionId	Yes	long	Client	transaction	number	(numeric	
identifier	up	to	20	characters)	
serviceProviderId	Yes	string	service ID	
amount	Yes	double	Payment	amount	to	be	credited	to	the	client’s	
account	with	the	Provider	
amountAll8	Yes	double	Amount	of	payment	received	from	the	client	
(including	commission)	
phoneNumber	Yes	string	Payer	ID	
paydeskId	Yes	string	Cashbox	number	at	the	System	
terminalId	Yes	string	EPS	Payment	Point	Number	
remoteSystemId	Yes	string	EPS	ID	
instrumentType9	Yes	string	Instrument	type	
comment	No	string	Comment	
params	No	string	Additional	payment	parameters.	
		
 
7	All	input	parameters	of	the	request	should	be	identical	to	those	sent	using	the	same	parameters	in	the	
request	to	verify	the	possibility	of	making	a	payment.	
8	In	case	the	commission	is	not	taken	the	value	amountAll	=	amount.	If	the	provider	requires	a	mandatory	
fee	(including	strictly	defined	values),	and	the	amountAll	is	transferred	incorrectly,	the	payment	will	be	
refused.	
9	Type	of	payment	instrument:	
1	–	cash,	2	-	payment	by	card,	3	-	payment	from	a	mobile	account,	4	-	payment	from	an	electronic	wallet. 
API	specification	for	payout	methods	
Response	format:	
In	case	of	a	successful	response:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0">	
<billNumber>387233641987137431</billNumber>	
<beginDate>12.01.2026	15:23:13</beginDate>	
<tsDateSp>12.01.2026	15:23:13</tsDateSp>	
<tsDateDealer>12.01.2026	16:23:13</tsDateDealer>	
<amount>10.0</amount>	
<result	resultCode="0"	resultDescription="Operation	completed	successfully"/>	
</kp-dealer>	
In	this	case,	the	answer	“operation	completed	successfully”	means	that	the	payment	has	passed	
all	the	necessary	checks	on	the	System	and	has	been	queued	for	processing	by	the	Provider	and	
cannot	be	unambiguously	interpreted	as	successfully	completed	-	it	is	necessary	to	execute	the	
status/search	command	(see	section	3.2.3).	
Attention!		
If,	based	on	the	response	about	the	success	of	the	PAY	request,	the	Contractor	decides	on	the	
success	of	the	payment,	which	will	ultimately	fail,	the	claims	for	this	payment	are	NOT	
CONSIDERED.	
In	case	of	a	wrong	response:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0">	
<result	resultCode="-20110"	resultDescription="Payment	to	the	service	provider	is	prohibited."/>	
</kp-dealer>	
Attention!		
If,	after	sending	the	PAY	request,	the	connection	is	lost	due	to	timeout	or	for	some	other	reason	
no	response	is	received,	it	is	mandatory	to	call	the	payment	status	verification	request	
(FINDPAY)	using	the	dealer	transaction	identifier	(dealerTransactionId).	
If	the	contractor	decides	whether	the	payment	was	successful	or	unsuccessful	without	sending	a	
status	check	request	(for	example,	by	sending	a	repeated	PAY	request	and	receiving	error	
20150),	then	claims	for	this	payment	are	NOT	CONSIDERED.	
Response	fields:	
Field	name	
Type	
Description	
billNumber	
long	
Payment	cheque	number	at	the	System	
tsDateDealer	
string	
beginDate	
Date	of	payment	receiving	according	to	Contractor	time	
string	
tsDateSp	
Registration	date	according	to	the	System	time	(UTC)	
string	
amount	
Date	of	payment	registration	according	to	Provider	time	
double	
Charge	amount	
9 
API	specification	for	payout	methods	
resultCode	
string	
Response	code	
resultDescription	
string	
Response	description	
3.2.3 Get	payment	status	
This	request	is	executed	to	obtain	the	status	of	the	payment	sent	for	defrayal.	
Search	with	this	query	is	carried	out	only	for	the	payments	made	in	the	last	five	days.	
Request	format:	
Search	by	check	number:	
actionName=FINDPAY&billNumber=	387233641987137431	
Search	by	dealer	transaction	number:	
actionName=FINDPAY&dealerTransactionId=2223	
Request	fields:	
Field	name	
Mandatory10	
Type	
Description	
actionName	
Yes	
string	
billNumber	
It	should	be	equal	to	the	value	«FINDPAY»	
Optional	
long	
dealerTransactionId	
Payment	cheque	number	at	the	System	
Optional	
string	
Response	format:	
Client's	transaction	number	
<?xml	version="1.0"	encoding="UTF-8"	?>	
<kp-dealer	version="2.0">	
<payment	version="2.0"	remoteCheckId="1234567"	billNumber="387233641987137431"		
dealerTransactionId="222333555">	
<beginDate>12.01.2026	15:23:13</beginDate>	
<tsDateSp>12.01.2026	15:23:13</tsDateSp>	
<tsDateDealer>12.01.2026	16:23:13</tsDateDealer>	
<userData>	
<phoneNumber>1234567890123456</phoneNumber>	
<serviceProviderId>61077506</serviceProviderId>	
<amount>10.0</amount>	
<fullAmount>11.0</fullAmount>	
</userData>	
<result	fatal="true"	resultCode="1"	resultDescription="Completed"	
providerResultMessage="Completed"	/>	
</payment>	
</kp-dealer>	
10	Either	the	check	number	or	the	customer	transaction	number	must	be	indicated.	
10 
API	specification	for	payout	methods	
If	no	records	were	found	in	the	search,	the	answer	is	as	follows:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0"/>	
This	situation	may	occur	when	a	search	is	performed	outside	the	allowed	period	(5	days).	
Response	fields:	
Field	name	
Type	
Description	
billNumber	
long	
Payment	cheque	number	at	the	System	
dealerTransactionId	
long	
Client's	transaction	number	
remoteCheckId	
string	
Provider	transaction	number	
beginDate	
string	
tsDateSp	
Payment	date	according	to	the	System	time	(UTC)	
string	
Payment	date	according	to	Provider	time	
tsDateDealer	
string	
phoneNumber	
Date	of	payment	receiving	according	to	Contractor	time	
string	
Payer	ID	
serviceProviderId	
string	
Service	ID	
amount	
double	
Payment	amount	to	be	credited	to	the	client’s	account	
with	the	Provider	
fullAmount	
double	
Amount	of	payment	received	from	the	client	
(commission	included)	
resultCode	
string	
Response	code	
resultDescription	
string	
Response	descriptio	
providerResultMessage	
string	
Provider	response	description	
fatal	
string	
Sign	of	final	response	(true	/	false)	
11 
API	specification	for	payout	methods	
3.3 Finance	requests	
3.3.1 Get	current	balances	in	the	System	
The	request	is	intended	to	obtain	the	accounts	list	of	the	Contractor	in	the	System.	
Request	format:	
actionName=ACCOUNTS	
Request	fields:	
Field	name	
Mandatory	
Yes	
Type	
Description	
actionName	
string	
It	should	be	equal	to	value	«ACCOUNTS»	
Response	format:	
<?xml	version="1.0"	encoding="UTF-8"	?>		
<kp-dealer	version="2.0">	
<accounts>	
<account>	
<balance>2259.8</balance>		
<currency>EUR</currency>	
</account>	
<account>	
<balance>100.5</balance>		
<currency>USD</currency>	
</account>	
</accounts>	
</kp-dealer>	
Response	fields:	
Field	name	
Type	
Description	
balance11	
double	
The	current	value	of	the	Contractor's	balance	in	the	System.	
currency	
string(3)	
Account	currency	
11	If	the	user	(operator)	is	prohibited	from	viewing,	then	balance=null	
12 
API	specification	for	payout	methods	
3.4 Dictionaries	
3.4.1 List	of	system	errors	
The	directory	is	used	to	convert	error	data	contained	in	responses	to	Counterparty	requests	
received	from	payment	executors	(payment	systems,	providers).	
Request	format:	
actionName=GETERRS	
Request	fields:	
Field	name	
Mandatory	
Yes	
Type	
Description	
actionName	
string	
It	should	be	equal	to	value	«GETERRS»	
Response	format:	
<?xml	version="1.0"	encoding="UTF-8"?>	
<kp-dealer	version="2.0">	
<errors>	
<error>	
<id>-20144</id>	
<description>Invalid	parameter</description>	
<isFatal>1</isFatal>	
</error>	
<error>	
<id>-20215</id>	
<description>Operation	is	in	progress</description>	
<isFatal>0</isFatal>	
</error>	
</errors>	
</kp-dealer>	
Response	fields:	
Field	name	
Type	
Description	
id	
string	
Response	code	
description	
string	
Response	description	
isFatal	
string	
Sign	of	final	response:		
0	-	temporary	error	
1	-	constant	error	
13 
API	specification	for	payout	methods	
3.4.2 List	of	available	services	
Request	format:	
actionName=PROVIDERS2	
Request	fields:	
Field	name	
Mandatory	
Yes	
Type	
Description	
actionName	
string	
It	should	be	equal	to	value	«PROVIDERS2»	
Response	format:	
Service	without	additional	parameters	
<?xml	version="1.0"	encoding="UTF-8"?>	
<kp-dealer	version="2.0">	
<provider>	
<id>453315258</id>	
<name>	Provider	Title	</name>	
<minsum>1</minsum>	
<maxsum>15000</maxsum>	
<additpercent	max="0"	allow="true"/>	
<isAmountFixed>false</isAmountFixed>	
<countries>	
<country	desc="All"	code="000"/>	
</countries>	
<currencies>		
<currency>EUR</currency>		
</currencies>	
<version>87</version>	
<params>	
<!	-	the	main	parameter	is	passed	to	the	phoneNumber	field	when	paying	->	
<param>	
<minlength>10</minlength>	
<maxlength>10</maxlength>	
<pattern>^\d{10}$</pattern>	
<mask>*****-*****</mask>	
<type>numeric</type>	
<patterndesc>Account	number</patterndesc>	
<comments>Account	number</comments>	
</param>	
</params>	
</provider>	
</kp-dealer>	
14 
API	specification	for	payout	methods	
Service	with	additional	parameters	
<?xml	version="1.0"	encoding="UTF-8"?>	
<kp-dealer	version="2.0">	
<provider>	
<id>78003301</id>	
<name>	Provider	Title	</name>	
<minsum>1</minsum>	
<maxsum>15000</maxsum>	
<additpercent	max="0"	allow="true"/>	
<isAmountFixed>false</isAmountFixed>	
<countries>	
<country	desc="All"	code="000"/>	
</countries>	
<currencies>		
<currency>EUR</currency>		
</currencies>	
<version>87</version>	
<params>	
<!	-	the	main	parameter	is	passed	to	the	phoneNumber	field	when	paying	->	
<param>	
<minlength>10</minlength>	
<maxlength>10</maxlength>	
<pattern>^\d{10}$</pattern>	
<type>numeric</type>	
<patterndesc>Account	number	(10	digits)</patterndesc>	
<comments>Account	number	(10	digits)</comments>	
</param>	
<!	-	additional	parameter	of	text	type	->	
<param	name="firstName">	
<type>text</type>	
<pattern>.*</pattern>	
<patterndesc>First	name</patterndesc>	
</param>	
<param	name="lastName">	
<type>text</type>	
<pattern>.*</pattern>	
<patterndesc>Last	Name</patterndesc>	
</param>	
<!	-	additional	parameter	of	list	type	->	
<param	name="paymenType">	
<type>enum</type>	
<elements>	
<item	value="1">Type	1</item>	
<item	value="2">Type	2</item>	
</elements>	
<pattern>.*</pattern>	
<patterndesc>Payment	type</patterndesc>	
</param>	
</params>	
</provider>	
</kp-dealer>	
15 
 
 
API	specification	for	payout	methods	
	
  
16 
 
Response	fields:	
Field	name	Type	Description	
id	string	Service	ID	
name	string	Service	name	
minsum	string	Minimum	payment	amount	
maxsum	string	Maximum	payment	amount	
additpercent		Permission	to	charge	extra	interest	when	paying	- max	double	The	maximum	allowed	percentage	value.	
If	"0"	there	is	no	limit.	- allow	string	Permission	to	charge	extra	interest	when	paying	
«true»	/	«false»	
isAmountFixed	string	The	principle	of	calculating	the	additional	commission:	-	“true”	-	commission	is	charged	in	addition	to	the	
amount	of	payment	-	“false”	-	the	commission	is	deducted	from	the	payment	
amount	
country		Service	Country	- desc	string	Name	of	country	- code	string	ISO	(3)	country	code	
currencies		Allowed	payment	acceptance	currencies	- currency	string	ISO	(alfa3)	currency	code	
param		The	main	parameter	identifying	the	payer	- minlength	string	Minimum	parameter	length	- maxlength	string	Maximum	parameter	length	- pattern	string	Input	pattern	- mask	string	Input	mask	- type	string	Parameter	Type	(Numeric	/	Text)	- patterndesc	string	Pattern	Description	- comments	string	Comment	
param	name="***"		Additional	parameter	of	text	type	- type	string	It	should	be	equal	to	“text”	- pattern	string	Input	pattern	- patterndesc	string	Pattern	Description	
param	name="***"		Additional	parameter	of	list	type	- type	string	It	should	be	equal	to	“enum”	- elements		List	of	elements	
o item	string	Element	value	- pattern	string	Input	pattern	- patterndesc	string	Pattern	Description	
	
  
API	specification	for	payout	methods	
3.5 Payment	Reconciliation	
3.5.1 Get	list	of	successful	payments	
The	request	is	used	to	obtain	a	list	of	successful	payments	for	a	specified	date	(without	any	
statute	of	limitations).	
Request	format:	
actionName=GETTRANSACTIONS&date=12.01.2026	
Request	fields:	
Field	name	
Mandatory	
Yes	
Type	
Description	
actionName	
string	
date	
It should be equal to value “GETTRANSACTIONS”	
Yes	
string	
The	date	for	which	transactions	are	searched.		
It	is	specified	in	the	following	format:	DD.MM.YYYY	
Response	format:	
<?xml	version="1.0"	encoding="ISO-8859-1"?>	
<kp-dealer	version="2.0">		
<payment	version="2.0"	remoteCheckId="405936824293"	dealerTransactionId="-441601537370421791"	
billNumber="2832911330659675184">		
<beginDate>12.01.2026	15:23:13</beginDate>	
<tsDateSp>12.01.2026	15:23:13</tsDateSp>	
<tsDateDealer>12.01.2026	16:23:13</tsDateDealer>	
<userData>		
<phoneNumber>535590******6179</phoneNumber>		
<serviceProviderId>728084004</serviceProviderId>		
<amount>10</amount>		
<fullAmount>11</fullAmount>		
<systemCommission>1</systemCommission>		
<agentFee>0</agentFee>		
</userData>		
<extras>		
<extra	name="authCode"	value="12345"/>		
<extra	name="rrn"	value="405936824352"/>		
</extras>		
<result	resultDescription="Completed"	resultCode="1"	fatal="true"	
providerResultMessage="Completed"/>		
</payment>	
</kp-dealer>	
Response	fields:	
Field	name	
Type	
Description	
billNumber	
long	
Payment	cheque	number	at	the	System	
17 
 
 
API	specification	for	payout	methods	
	
  
18 
 
dealerTransactionId	long	Client's	transaction	number	
remoteCheckId	string	Provider	transaction	number	
beginDate	string	Payment date according to the System time (UTC)	
tsDateSp	string	Payment	date	according	to	Provider	time	
tsDateDealer	string	Payment	date	receiving	according	to	Contractor	time	
phoneNumber	string	Payer	ID	
serviceProviderId	string	Service	ID	
amount	double	Payment	amount	to	be	credited	to	the	client’s	account	
with	the	Provider	
fullAmount	double	Amount	of	payment	received	from	the	client	
(commission	included)	
systemCommission	double	System	commission	(from	dealer)	
agentFee	double	Dealer	fee	(from	system)	
extras	string	Additional	payment	parameters	
resultCode	string	Response	code	
resultDescription	string	Response	description	
providerResultMessage	string	Provider	response	description	
fatal	string	Sign	of	final	response:	
“true”	/	“false”	
	
3.5.2 Get	list	of	cancelled	payments	
Запрос	используется	для	получения	списка	отменных	платежей.	Выдача	результатов	
производится	по	дате	отмены	платежа.	
Будут	выданы	все	отменные	платежи,	которые	были	приняты	за	последние	пять	дней.		
	
Request	format:	
actionName=GETROLLBACKS	
As	additional	filters,	one	can	set	the	search	interval	and	service	identifier.	
Request	fields:	
Field	name	Mandatory	Type	Description	
actionName	Yes	string	It	should	be	equal	to	the	value	
“GETROLLBACKS”	
fromDate	No	string	Start	of	the	search	interval	
toDate	No	string	End	of	the	search	interval	
serviceProviderId	No	string	Service	ID	
	
Response	format:	
	
<?xml	version="1.0"	encoding="UTF-8"?>	
<kp-dealer	version="2.0">	
<payment	version="2.0"	remoteCheckId="3516516513615"	dealerTransactionId="184211406830406434"	
billNumber="3634965531004748163">	
<rollbackDate>31.05.2026	11:38:39</rollbackDate>	
API	specification	for	payout	methods	
<beginDate>15.05.2026	10:13:25</beginDate>	
<tsDateDealer>15.05.2026	11:13:25</tsDateDealer>	
<userData>	
<phoneNumber>1234567890123456</phoneNumber>	
<serviceProviderId>739312002</serviceProviderId>	
<amount>12</amount>	
<bankFee>0</bankFee>	
</userData>	
<result	fatal="true"	providerResultMessage="Rollback	-500	(Processing	error)"	
resultDescription="Rollback	-500	(Processing	error)"	resultCode="-500"	
providerResultCode="132"/>	
</payment>	
</kp-dealer>	
If	no	records	were	found	in	the	search,	the	answer	is	as	follows:	
<?xml	version='1.0'	encoding='UTF-8'?>	
<kp-dealer	version="2.0"/>	
Response	fields:	
Field	name	
Type	
Description	
billNumber	
long	
Payment	cheque	number	at	the	System	
dealerTransactionId	
long	
Client's	transaction	number	
remoteCheckId	
string	
Provider	transaction	number	
rollbackDate	
string	
Cancellation	payment	date	according	to	the	System	time	
(UTC)	
beginDate	
string	
tsDateDealer	
Payment	date	according	to	the	System	time	(UTC)	
string	
phoneNumber	
Date	of	payment	receiving	according	to	Contractor	time	
string	
Payer	ID	
serviceProviderId	
string	
Service	ID	
amount	
double	
Payment	amount	to	be	credited	to	the	client’s	account	
with	the	Provider	
bankFee	
double	
Amount	of	commission	withheld	by	the	system	upon	
payment	
resultCode	
string	
Response	code	
resultDescription	
string	
Response	description	
providerResultMessage	
string	
Provider	response	description	
providerResultCode	
string	
Provider	response	code	
fatal	
string	
Sign	of	final	response:	“true”	/	“false”	
19 
API	specification	for	payout	methods	
Annex	1.	Response	codes	
A	complete	list	of	valid	response	codes	is	available	on	request	"GETERRS"	(see	section	3.4.1).	
Upon	create	of	a	new	payment	(PREPARE,	PAY):		
Response	code	
Description	
0	-55000	
Operation	completed	successfully	
Stop	processing.	
Check	the	correctness	of	the	request.	
If	the	request	was	formed	correctly,	contact	technical	support.	
When	checking	the	payment	status	(FINDPAY):		
Response	code	
Description	
0	
Transaction	rollback	
1	
Payment	completed	
Payment	queued	for	processing	
20000	
20002	
2	
Payment	in	processing	(request	sent	to	provider)	
The	payment	status	is	unknown,	failure	to	make	a	payment	to	the	billing	
provider	(in	the	future,	the	status	will	be	changed	to	completed	or	one	of	the	
refusals).	-100	-200	
Cancellation	of	transaction	in	the	first	step	(verification)	
Manual	cancellation	of	payment	(in	the	case	of	payment	in	a	condition	
requiring	additional	verification)	-300	-400	
Insufficient	balance	of	the	account		
Cancellation	of	a	transaction	at	the	request	of	the	Contractor	-500	-600	
Cancellation	of	a	transaction	at	the	request	of	the	System	
Cancellation	of	a	transaction	at	the	request	of	the	Provider	
5500012	
Repeat	request	in	1	min,	5	min,	10	min,	15	min	...	
(to	1	hour).	
If	the	response	code	still	returns	-55000,	then	stop	processing	and	contact	
technical	support.	
12 Response with the code "-55000" is not final. 
If upon receipt of the error code "-55000" the Agent decides whether the payment is successful or unsuccessful, claims will not be 
accepted for these requests. 
If, as a result, the payment assumes the status of successful, then the Agent has obligations to pay this payment to the System. 
If the payment assumes an unsuccessful status, then the Agent incurs obligations to return money for the accepted payment to 
the Payer. 
20 
API	specification	for	payout	methods	
Annex	2.	Gateway	address	
Test	environment	
Address	
test.creditpilot.com:8080	
Login	
Provided	by	request	
Password	
Provided	by	request	
remoteSystemId	
Provided	by	request	
paydeskId	
Created	by	Admin.UI	
terminalId	
Created	by	Admin.UI	
Production	environment	
Address	
payout.creditpilot.com:8080	
Annex	3.	Test	services	
A	complete	list	of	available	test	services	and	their	specifications	is	obtained	using	the	
PROVIDERS2	command.	
Service	ID	
Service	name	
Description	
1234567890	
TEST	Service	…		
Annex	4.	Mandatory	methods	for	implementation.	
1. Get	of	available	services	list	-	PROVIDERS213	
2. Get	balance	of	accounts	in	the	system	-	ACCOUNTS	
3. Create	payment	-	PREPARE-PAY-FINDPAY	
4. Gel	list	of	rollback	payments	-	GETROLLBACKS14	
5. Get	list	of	successful	payments	-	GETTRANSACTIONS15	
13 It	is	recommended	to	call	it	on	a	regular	basis	(frequency	is	determined	independently)	to	control	the	
versioning	(<version>	tag)	of	the	service	specification.	
14	Required	for	daily	reconciliation.	
15	Recommended	for	daily	reconciliation.