TASK: CREATE DEDICATED MOBILE SIGN IN + REGISTRATION PAGES FOR CHARTVOLT

IMPORTANT:

We already have working DESKTOP Sign In and Registration pages.

DO NOT simply shrink the desktop pages.
DO NOT scale the desktop form down.
DO NOT squeeze the desktop registration form into a phone.
DO NOT change the existing desktop design.

Create completely separate MOBILE layouts that feel like a real
ChartVolt mobile application.

Desktop must remain unchanged.

==================================================
1. BREAKPOINT
==================================================

Mobile:
max-width: 768px

Desktop:
min-width: 769px

Test at:

360px
375px
390px
393px
412px
430px

Example:

<div className="hidden md:block">
    <DesktopSignIn />
</div>

<div className="md:hidden">
    <MobileSignIn />
</div>

Do the same for Registration.

SHARE:
- APIs
- auth logic
- validation
- referral logic
- affiliate logic
- backend data

DO NOT SHARE:
- desktop layout
- desktop positioning
- desktop sizing

==================================================
2. MOBILE DESIGN DIRECTION
==================================================

Both pages must feel like the same ChartVolt mobile app.

Use the existing ChartVolt backgrounds but crop them properly for
portrait/mobile screens.

Visual style:

- dark navy
- cyan neon
- electric blue
- purple/magenta accents
- gold primary CTA
- subtle glass panels
- premium gaming UI
- modern fintech quality
- clean, not overcrowded

The background should still show:

TRADING
+
GAMING
+
COMPETITION

but the form must remain easy to read.

Use a dark overlay over the artwork.

Example:

background:
linear-gradient(
    rgba(2,7,20,.55),
    rgba(2,7,20,.82)
)

Do NOT make the background brighter than the form.

==================================================
3. MOBILE SIGN IN PAGE
==================================================

EXACT CONTENT ORDER:

ChartVolt Logo

↓

WELCOME BACK, CHALLENGER

Trade. Play. Compete. Conquer.

↓

JUMP BACK IN

Sign in and pick up where you left off — join competitions,
challenge players and keep climbing the leaderboard.

↓

Email

Password

↓

Keep me signed in       Forgot password?

↓

ENTER CHARTVOLT

↓

OR CONTINUE WITH

Google       Apple

↓

New to ChartVolt? Create your account

↓

small feature chips

Markets
Games
Competitions
Leaderboards
Rewards

==================================================
4. SIGN IN WORDING
==================================================

Replace current wording with:

TOP TITLE:

Welcome Back, Challenger

TOP SUBTITLE:

Trade. Play. Compete. Conquer.

CARD TITLE:

Jump Back In

CARD DESCRIPTION:

Sign in and pick up where you left off — join competitions,
challenge players and keep climbing the leaderboard.

Remember me becomes:

Keep me signed in

MAIN CTA:

Enter ChartVolt

BOTTOM:

New to ChartVolt? Create your account

==================================================
5. MOBILE SIGN IN CARD
==================================================

Do NOT use the narrow desktop floating panel exactly as it exists now.

Mobile card:

width:
calc(100% - 32px)

max-width:
430px

margin:
auto

padding:
20px

border-radius:
20-24px

background:
rgba(4,14,34,.94)

border:
1px solid rgba(0,215,255,.35)

Use a very subtle cyan outer glow.

The card must feel premium but readable.

==================================================
6. MOBILE SIGN IN INPUTS
==================================================

Each field:

FULL WIDTH

Height:
52-56px

Font:
16px minimum

Border radius:
12px

Fields:

Email
Password

Add:

mail icon
lock icon
password visibility eye

Focused state:

cyan border
small cyan glow

Do NOT use tiny text.

Do NOT reduce input font below 16px because iPhones may zoom.

==================================================
7. REMEMBER + FORGOT PASSWORD
==================================================

Put on one row:

[ ] Keep me signed in       Forgot password?

Use:

display:flex
justify-content:space-between
align-items:center

On very small screens allow it to wrap.

Do NOT shrink the text to force it to fit.

==================================================
8. ENTER CHARTVOLT BUTTON
==================================================

Full width.

Height:
56px

Gold ChartVolt style.

Text:

Enter ChartVolt

Add subtle arrow if appropriate.

Use:

gold gradient
subtle glow
pressed state
loading state

When loading:

Signing in...

Do not allow duplicate clicks.

==================================================
9. SOCIAL LOGIN
==================================================

Below CTA:

OR CONTINUE WITH

Then:

Google
Apple

Prefer two equal buttons.

On very narrow phones they may stack.

Height:
48-52px.

Social buttons must NOT visually overpower the main gold CTA.

==================================================
10. MOBILE SIGN IN BACKGROUND
==================================================

Use the current ChartVolt trading + gaming city artwork.

But create a MOBILE crop.

The user should still visually understand:

left:
trading / charts

right:
gaming

center:
ChartVolt competition world

Do not put important artwork directly underneath the form.

Use:

background-size: cover

and a separate mobile:
background-position

Do not simply reuse the desktop position.

==================================================
11. SIGN IN PAGE HEIGHT
==================================================

Use:

min-height: 100dvh

NOT ONLY:

height: 100vh

The page must work correctly when the mobile keyboard opens.

Do not vertically lock the form in the center if that causes fields
to disappear behind the keyboard.

==================================================
12. MOBILE REGISTRATION PAGE
==================================================

The registration page currently contains many fields.

DO NOT display the desktop 2-column form on mobile.

This is especially important.

Create a dedicated mobile registration flow.

Use:

ONE COLUMN

and preferably:

TWO STEPS

==================================================
13. MOBILE REGISTRATION WORDING
==================================================

TOP TITLE:

Join ChartVolt

TOP SUBTITLE:

Create your account and start competing across trading and games.

CARD TITLE:

Create Your Player Account

CARD DESCRIPTION:

Set up your profile, choose what you want to compete in,
and get ready to play.

Interest section:

What do you want to compete in?

TRADING
Trading competitions & challenges

GAMES
Skill games & competitions

BOTH
Trading + games

TERMS:

I agree to the Terms of Service and Privacy Policy.

MAIN CTA:

Create Account & Start Playing

BOTTOM:

Already have an account? Sign in

==================================================
14. REGISTRATION STEP 1
==================================================

STEP 1 OF 2

ACCOUNT DETAILS

Fields:

Full Name
Email
Password
Confirm Password
Country
Phone Number

Then button:

Continue →

Do NOT submit yet.

Validate Step 1 before moving to Step 2.

Preserve all entered values.

==================================================
15. REGISTRATION STEP 2
==================================================

STEP 2 OF 2

PROFILE & PREFERENCES

Fields:

Address
City
ZIP / Postal Code

Then:

What do you want to compete in?

[ Trading ]

[ Games ]

[ Both ]

Then:

[ ] I agree to the Terms of Service and Privacy Policy.

Buttons:

Back

Create Account & Start Playing

==================================================
16. IF YOU DO NOT USE A 2-STEP FORM
==================================================

If changing registration into a stepper would interfere with existing
business logic, keep it as ONE page.

BUT IT MUST STILL BE:

ONE COLUMN

and grouped visually as:

ACCOUNT DETAILS

then

PROFILE DETAILS

then

COMPETITION PREFERENCES

then

TERMS

Do not use the desktop 2-column field grid on mobile.

==================================================
17. INTEREST SELECTION
==================================================

Do NOT use tiny radio buttons as the main interaction.

Create 3 touch-friendly selection cards.

TRADING

icon:
trading/chart

description:
Trading competitions & challenges

GAMES

icon:
game controller

description:
Skill games & competitions

BOTH

icon:
trophy / ChartVolt symbol

description:
Trading + games

Entire card should be clickable.

Selected states:

Trading:
cyan

Games:
purple

Both:
gold

==================================================
18. PHONE NUMBER
==================================================

Make the phone input properly mobile responsive.

Use:

[ Country Code ] [ Phone Number ]

Country code:
90-105px

Phone field:
remaining width

Use:

inputmode="tel"

Correctly format phone numbers.

Do not show phone numbers as an unformatted raw number.

==================================================
19. PASSWORD FIELDS
==================================================

On mobile:

Password

Confirm Password

MUST be stacked.

Never put them side-by-side.

Add show/hide controls.

If password requirements exist, show them beneath the password field.

==================================================
20. COUNTRY / ADDRESS / CITY / ZIP
==================================================

Country:
full width

Address:
full width

City:
full width

ZIP:
full width

Do not create tiny half-width inputs on 360px phones.

If there is enough room at 430px, City + ZIP may optionally be
side-by-side, but this is NOT required.

Readability is more important.

==================================================
21. TERMS
==================================================

Use proper checkbox.

Text:

I agree to the Terms of Service and Privacy Policy.

Terms of Service must be clickable.

Privacy Policy must be clickable.

Do not allow registration until terms are accepted if acceptance is
required by the existing registration logic.

==================================================
22. IMPORTANT GM / REFERRAL LOGIC
==================================================

DO NOT BREAK THIS.

If a user arrives through a Game Master referral link:

- preserve GM ID / referral token
- preserve it between registration steps
- send it through the same registration backend
- maintain the existing affiliate terms workflow
- maintain first-login affiliate terms popup logic
- do not classify normal registrations as referrals
- do not remove or change existing GM linking logic

The mobile redesign is primarily UI/UX.

Do not rewrite business rules unnecessarily.

==================================================
23. REGISTRATION BACKGROUND
==================================================

Use the existing ChartVolt trading + gaming competition artwork.

The background should visually show:

Trading Competitions
1v1 Trading Challenges
Volt Velocity
Circuit Sprint
Volt Stack

BUT:

darken it strongly behind the registration form.

The user must be able to read every field easily.

==================================================
24. MOBILE REGISTRATION CARD
==================================================

width:
calc(100% - 32px)

max-width:
430px

margin:
auto

padding:
18-20px

border-radius:
20-24px

background:
rgba(4,14,34,.95)

border:
1px solid rgba(0,215,255,.30)

Registration is allowed to scroll.

DO NOT try to force the whole registration form into one phone screen.

==================================================
25. VERY IMPORTANT: NO INTERNAL FORM SCROLL
==================================================

Do NOT do this:

registration card:
height: 600px
overflow-y: scroll

WRONG.

The entire PAGE should scroll naturally.

No nested scroll area inside the form.

This is important for:

keyboard behavior
accessibility
touch scrolling
small phones

==================================================
26. MOBILE HEADER
==================================================

Use the ChartVolt logo centered at the top.

Recommended width:

110-135px

Below it:

page title

Then subtitle.

Keep top section compact.

Do not waste 200px of vertical space before the form.

==================================================
27. MOBILE TYPOGRAPHY
==================================================

Logo:
110-135px

Page title:
28-34px

Subtitle:
13-15px

Card title:
20-24px

Card description:
13-14px

Input labels:
11-12px

Input text:
16px

Buttons:
15-17px

Bottom links:
13-14px

Do not use tiny desktop typography.

==================================================
28. MOBILE SPACING
==================================================

Horizontal page padding:
16px

Title → subtitle:
6px

Subtitle → form:
18-22px

Field spacing:
14px

Form section spacing:
20px

CTA margin:
18px

Bottom page padding:
24px + safe area

==================================================
29. SAFE AREAS
==================================================

Support modern iPhones.

Use:

padding-top:
max(16px, env(safe-area-inset-top))

padding-left:
max(16px, env(safe-area-inset-left))

padding-right:
max(16px, env(safe-area-inset-right))

padding-bottom:
max(24px, env(safe-area-inset-bottom))

==================================================
30. KEYBOARD BEHAVIOR
==================================================

When keyboard opens:

- focused input must remain visible
- page must be scrollable
- CTA should not permanently cover inputs
- do not use fixed center positioning
- do not lock body height

Use:

min-height: 100dvh

==================================================
31. COMPONENT STRUCTURE
==================================================

Recommended:

components/
auth/

desktop/
DesktopSignIn.tsx
DesktopRegister.tsx

mobile/
MobileSignIn.tsx
MobileRegister.tsx
MobileAuthHeader.tsx
MobileAuthCard.tsx
MobileAuthInput.tsx
MobileRegisterStepper.tsx
MobileInterestSelector.tsx
MobileSocialLogin.tsx

shared/
AuthErrors.tsx
AuthLoading.tsx

hooks/
useSignIn.ts
useRegister.ts

Both desktop and mobile must use the SAME backend hooks.

==================================================
32. VALIDATION
==================================================

Keep current backend validation.

Display errors directly below fields.

Examples:

Please enter a valid email.

Password is required.

Passwords do not match.

Please select your country.

Please enter a valid phone number.

You must accept the Terms of Service and Privacy Policy.

Do NOT use browser alert().

==================================================
33. LOADING STATES
==================================================

Sign In:

Enter ChartVolt
→
Signing in...

Registration:

Create Account & Start Playing
→
Creating your account...

Disable the CTA during request.

Prevent duplicate submissions.

==================================================
34. MOBILE IMAGE QUALITY
==================================================

The mobile version must remain retina-ready.

Use high-resolution background artwork.

Prefer:

AVIF
WebP

where possible.

Use the original ChartVolt logo:

SVG
or
high-resolution transparent PNG.

Do not stretch low-resolution screenshots.

==================================================
35. IMPORTANT — DO NOT LOAD BOTH LARGE BACKGROUNDS
==================================================

Do not make the browser unnecessarily download:

desktop background
+
mobile background

at the same time.

Use responsive image handling / media queries.

Optimize production assets.

==================================================
36. MOBILE SIGN IN FINAL STRUCTURE
==================================================

LOGO

WELCOME BACK, CHALLENGER

Trade. Play. Compete. Conquer.

[JUMP BACK IN CARD]

Email

Password

Keep me signed in      Forgot password?

[ ENTER CHARTVOLT ]

OR CONTINUE WITH

[ GOOGLE ] [ APPLE ]

New to ChartVolt?
Create your account

small feature chips

==================================================
37. MOBILE REGISTRATION FINAL STRUCTURE
==================================================

LOGO

JOIN CHARTVOLT

Create your account and start competing across trading and games.

[CREATE YOUR PLAYER ACCOUNT]

STEP 1 OF 2

Full Name
Email
Password
Confirm Password
Country
Phone Number

[ CONTINUE ]

STEP 2 OF 2

Address
City
ZIP

WHAT DO YOU WANT TO COMPETE IN?

Trading
Games
Both

Terms acceptance

[ CREATE ACCOUNT & START PLAYING ]

Already have an account?
Sign in

==================================================
38. DO NOT DO THESE
==================================================

DO NOT:

- shrink the desktop layout
- scale the desktop page
- keep registration 2-column on mobile
- make tiny form controls
- put forms inside an internal scrollbar
- hide fields
- remove current validation
- break referrals
- break GM affiliate registration
- lose URL referral parameters
- use 12px input text
- make background too bright
- overuse neon glow
- make the form transparent enough that background interferes
- hardcode example user information
- change desktop to solve mobile problems

==================================================
39. FINAL ACCEPTANCE TEST
==================================================

Do not call the job complete until:

✓ Desktop Sign In is unchanged
✓ Desktop Registration is unchanged

✓ Mobile Sign In is a dedicated layout
✓ Mobile Registration is a dedicated layout

✓ Works at 360px
✓ Works at 375px
✓ Works at 390px
✓ Works at 393px
✓ Works at 412px
✓ Works at 430px

✓ No horizontal scrolling
✓ No clipped fields
✓ Input font is at least 16px
✓ Keyboard does not hide fields
✓ Page uses 100dvh
✓ Safe areas work
✓ Google login works
✓ Apple login works
✓ Password visibility works
✓ Forgot password works
✓ Country selection works
✓ Phone number works
✓ Interest selection works
✓ Terms links work
✓ Terms acceptance works
✓ Registration works
✓ Login works
✓ GM referral links still work
✓ Affiliate data is preserved
✓ Existing backend logic remains intact
✓ Loading states work
✓ Error states work
✓ Mobile backgrounds are high resolution
✓ It feels like a proper ChartVolt mobile app

==================================================
40. BUILT — FORGOT PASSWORD + MOBILE POLISH (5 Oct 2026)
==================================================

Shipped after the mobile layouts:

- Mobile terms checkbox is high-contrast (readable on the dark card).
- Phone national input and dial-code trigger share the same 56px height.
- Forgot password is live: `/forgot-password` → email with
  `password_reset` admin template → `/reset-password?token=…`.
- If the account has 2FA enrolled, the reset page requires TOTP/backup
  before a new password can be set (session-less verify).
- Middleware allows `/forgot-password` and `/reset-password` without a
  session. Sessions are revoked on successful reset.

==================================================
41. FIX — RESET EMAIL WAS WELCOME COPY (5 Oct 2026)
==================================================

Symptom: forgot-password sent an email with subject
"Welcome to ChartVolt - Start competing and win real prizes!".

Cause: admin Email Templates GET created missing rows as
`EmailTemplate.create({ templateType, name })`. The schema's field
defaults are welcome-shaped, so `password_reset` was stored with the
welcome subject/body. `sendPasswordResetEmail` then rendered that row.

Fix: seed/repair through `getEmailTemplate` (type-specific defaults;
auto-repair when subject still equals the welcome schema default).
Admin list create uses the same helper. Redeploy required.
==================================================
42. EMPLOYEE LOGIN, UNLOCK AND DELETE-REASSIGN (5 Oct 2026)
==================================================

Report: new employee passwords (custom, auto-generated, reset) never let
the employee log in; lock/unlock left them locked; deleting an employee
left their customer unassigned.

Passwords were NOT broken. Production logs show every password hashed and
verified ("Password verification test: PASSED"). Every failed attempt was
on the PLAYER site (chartvolt-web, Better Auth "User not found"). Employees
sign in at the admin panel URL in the credentials email, never chartvolt.com.
Proven by __tests__/admin/employee-password-login.test.ts (3 paths -> 200).

Unlock: the five player-site failures wrote an AccountLockout row, which
the Employee Management toggle never cleared. Unlock now also calls
clearLoginLockouts() (apps/admin/lib/services/login-lockout-clear.ts,
case-insensitive), shared with the Fraud unlock route.

Delete-reassign: eligibility required role in assignableRoles (default
["Backoffice"]) and a STORED status "active" (older accounts, the owner's
included, store none). Now: not disabled and not locked out; on delete, if
nobody holds an assignable role, any active employee is used. least_customers
re-reads counts per customer, so several customers are split.
Proven by __tests__/admin/employee-delete-and-unlock.test.ts (4 tests; the
role test fails against the old service).

Also fixed: admin login trims the email; /api/credentials (first-login
"set your credentials") used an undeclared auth and always returned 500,
and wrote any employee's login into WhiteLabel - now owner only, min 8;
profile routes' auth.email / auth.isSuperAdmin were undefined.
Not retroactive: customers already left unassigned stay unassigned.
