# Telegram Promo Hub

MASTER BUILD PROMPT

Multi-Tenant Telegram Promotion SaaS — Telegram Bot + Mini App + Super Admin Website

Build a complete, production-ready, multi-tenant SaaS platform consisting of:

1. Telegram Bot — customer entry/login point
2. Telegram Mini App — COMPLETE customer control panel
3. Backend/API — all business logic
4. Database — multi-tenant architecture
5. Background workers/queues — discovery, campaigns and asynchronous jobs
6. Super Admin Website — ONLY for the platform owner/admin

⸻

1. CRITICAL ACCESS RULE — MUST FOLLOW

This is the most important requirement.

CUSTOMER

Customers must NOT have a normal website dashboard.

Customers will operate the entire product through:

Telegram Bot → Telegram Mini App

The customer should never need to open a normal website to manage their account.

The Telegram Mini App is the customer’s complete dashboard.

Customer functions inside Mini App:

* Dashboard
* Telegram account connections
* Group discovery
* Group approval
* Approved groups
* Audience discovery
* Audience selection
* Promotion message builder
* Group promotion campaigns
* Eligible/opt-in DM campaigns
* Campaign history
* Analytics
* Message templates
* Subscription/billing
* Account settings
* Help/support
* Notifications

⸻

2. ADMIN WEBSITE — ONLY FOR SUPER ADMIN

Create a separate normal web application for the platform owner.

Only Super Admin can access this website.

There must be NO normal customer dashboard on this website.

There must be NO customer login page on the Admin Website.

Admin Website:

/admin/login
/admin/dashboard
/admin/customers
/admin/customers/:id
/admin/plans
/admin/subscriptions
/admin/payments
/admin/settings
/admin/telegram
/admin/logs
/admin/analytics

Customer:

Telegram Bot
      ↓
Register/Login
      ↓
Open Mini App
      ↓
Customer Dashboard

⸻

3. COMPLETE SYSTEM ARCHITECTURE

                    SUPER ADMIN
                        │
                        ▼
              ┌───────────────────┐
              │  ADMIN WEBSITE    │
              │                   │
              │ Dashboard         │
              │ Customers         │
              │ Plans             │
              │ Subscriptions     │
              │ Payments          │
              │ USDT Configuration│
              │ Telegram Settings │
              │ System Logs       │
              │ Analytics         │
              └───────────────────┘
                    CUSTOMERS
                        │
                        ▼
              ┌───────────────────┐
              │   TELEGRAM BOT    │
              │                   │
              │ Register          │
              │ Login             │
              │ Open Mini App     │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ TELEGRAM MINI APP │
              │                   │
              │ Dashboard         │
              │ Connections       │
              │ Group Finder      │
              │ Groups            │
              │ Audience          │
              │ Campaigns         │
              │ Promotion         │
              │ Analytics         │
              │ Billing           │
              │ Settings          │
              └─────────┬─────────┘
                        │
                        ▼
              ┌───────────────────┐
              │ BACKEND / API     │
              │ DATABASE          │
              │ QUEUES / WORKERS  │
              └───────────────────┘

⸻

4. CUSTOMER REGISTRATION

Customer starts with Telegram Bot.

Bot /start should show:

Welcome to Telegram Promotion Platform.
[Register]
[Login]
[Open Mini App]
[Help]

Register

Fields:

* Gmail/email
* Password
* Confirm Password

Optional:

* Name
* Telegram username

For initial testing:

Email verification should be configurable and disabled by default.

Customer can register and immediately login.

However, authentication must still use secure password hashing.

Never store plaintext passwords.

⸻

5. CUSTOMER LOGIN

Customer can login through the Telegram Bot.

Fields:

Email/Gmail

Password

After successful login:

Login successful.
[OPEN MINI APP]

The Mini App must automatically identify the authenticated customer.

Do not trust a customer ID sent from the frontend.

Resolve the tenant/customer from the authenticated session.

⸻

6. TELEGRAM MINI APP

The Mini App is the customer’s COMPLETE control panel.

Use a premium modern SaaS UI.

Mobile-first because it primarily runs inside Telegram.

Main navigation:

Home
Groups
Audience
Campaigns
Connections
Settings

Additional pages accessible from dashboard:

Analytics
Templates
Billing
Help
Notifications

⸻

7. MINI APP DASHBOARD

The first screen after opening the Mini App should be:

Dashboard

Show:

Telegram Connections

Connected Accounts
Active Accounts
Connection Issues

Groups

Groups Found
Pending Approval
Approved Groups
Joined Groups

Audience

Eligible Users
Previously Contacted
Available New Audience

Campaigns

Running
Scheduled
Completed
Failed

Usage

Messages Used
Monthly Limit
Groups Used
Connections Used

Subscription

Current Plan
Expiry
Usage percentage

Dashboard should contain:

+ Create Campaign
+ Find Groups
+ Find Audience

⸻

8. TELEGRAM ACCOUNT CONNECTIONS

Mini App page:

Telegram Connections

Customers can connect authorized Telegram accounts through supported Telegram authentication mechanisms.

Do NOT implement:

* OTP harvesting
* Password harvesting
* Session-string theft
* Reverse engineering Telegram authentication
* Security bypass
* Anti-ban bypass
* IP/proxy rotation for restriction evasion

Use legitimate/authorized Telegram authentication.

Show:

Account Name
Username
Telegram ID
Status
Last Active
Last Sync

Statuses:

CONNECTED
DISCONNECTED
ERROR
REQUIRES ACTION

Buttons:

Connect
Reconnect
Disconnect
Check Status

Sensitive credentials must never be exposed to frontend.

⸻

9. GROUP FINDER

Mini App page:

Find Groups

Customer enters keywords.

Example:

USDT
P2P
Payment
Gaming
Crypto
Trading

Functions:

Add Keyword
Remove Keyword
Save Keywords
Search

Search publicly discoverable groups using permitted Telegram capabilities/data sources.

Do not attempt unauthorized access to private groups.

Results:

Group Name
@username
Member Count (if legitimately available)
Matched Keywords
Discovery Date
Status

Status:

FOUND
PENDING
APPROVED
REJECTED
JOINED
FAILED

⸻

10. GROUP APPROVAL

Customer must approve a group before joining/promotion.

Group card:

Example P2P Group
@p2p_example
12,450 members
Matched Keywords:
USDT
P2P
Payment
[View]
[Approve]
[Reject]

After Approve:

Attempt joining only through authorized Telegram functionality and where permitted.

Show:

JOINED
FAILED
REQUIRES ACTION

Never silently join groups.

⸻

11. APPROVED GROUPS

Mini App:

My Groups

Tabs:

All
Pending
Approved
Joined
Failed

Table/card:

Group
Username
Members
Status
Connected Account
Last Promotion
Campaigns

Actions:

View
Promote
Pause
Remove
History

⸻

12. GROUP DETAIL PAGE

Show:

Group information
Username
Member count
Status
Connected Telegram account
Join status
Permissions/status
Promotion history
Campaign history
Errors

Actions:

Promote
Pause
Remove
Refresh Status

⸻

13. AUDIENCE DISCOVERY

Before finding users, the system MUST ask:

Select Source Group

Customer must select which approved group(s) should be used.

Example:

Select Groups
☐ @group_one
☐ @group_two
☐ @group_three
[Find Eligible Audience]

Allow one or multiple groups.

IMPORTANT:

Only users who are legitimately contactable, such as users who interacted with the customer’s bot or explicitly opted in, may be used for DM promotion.

Do not build arbitrary group-member scraping or unsolicited bulk-DM functionality.

⸻

14. AUDIENCE RESULTS

After discovery show:

Total Found: 1,284
Eligible: 1,050
Previously Contacted: 234
Duplicates: 48
Excluded: XX

User list:

☐ User A
☐ User B
☐ User C
☐ User D

Columns:

Display Name
Username
Source Group
Eligibility
Previous Contact
Last Contact
Status

⸻

15. USER SELECTION

Customer must have:

Select All
Select None
Select 10
Select 15
Select 25
Select 50
Custom Selection

Example:

Customer selects:

User A ✓
User B ✓
User C ☐
User D ✓

Show:

Selected: 3

Then:

[Continue]

⸻

16. DUPLICATE PROTECTION

This is mandatory.

If the same user appears in multiple groups, count the user only once.

Use Telegram user ID as the deduplication identifier where legitimately available.

Example:

Group A → User 123
Group B → User 123
Group C → User 123

Result:

User 123 = 1 user

NOT:

3 users

Also maintain complete contact history.

Suggested table:

audience_contacts
id
tenant_id
telegram_user_id
source_group_id
first_found_at
last_contacted_at
contact_count
last_campaign_id
status

Before campaign:

Check previous contact
Check campaign history
Check eligibility

Default filter:

ONLY NEW / NOT PREVIOUSLY CONTACTED

⸻

17. CAMPAIGN CENTER

Customer should have ONE campaign center.

Campaign types:

GROUP PROMOTION
DM PROMOTION

Optional combined campaign:

GROUP + ELIGIBLE DM

Campaign list:

Campaign Name
Type
Status
Groups/Users
Created
Started
Completed
Failed

Filters:

All
Group
DM
Running
Scheduled
Completed
Failed

⸻

18. GROUP PROMOTION CAMPAIGN

Customer clicks:

Create Campaign

Select:

Step 1

Campaign Name

Step 2

Promotion Type:

GROUP

Step 3

Select approved groups.

Step 4

Select Telegram connection.

Step 5

Create message.

Support:

Text
Image
Video
Buttons
URL

Step 6

Preview.

Step 7

Schedule.

Options:

Start Now
Schedule

Step 8

Final approval.

Show:

Groups: 24
Message Preview
Schedule
Telegram Account

Button:

APPROVE & START

⸻

19. DM PROMOTION CAMPAIGN

Customer clicks:

Create Campaign

Select:

DM Promotion

Then:

1. Select source group(s)
2. Find eligible audience
3. Remove duplicate users
4. Exclude previously contacted users
5. Select All / 10 / 15 / Custom
6. Create message
7. Preview
8. Approve
9. Start

Before starting show:

Eligible Users: 1,050
Previously Contacted: 234
Selected: 15
Message Preview
[Cancel]
[Approve & Start]

Only eligible/contactable users may be included.

Do not implement:

* unsolicited mass DM
* scraping arbitrary private member data
* spam automation
* anti-spam bypass
* rate-limit bypass
* account rotation to evade restrictions

⸻

20. MESSAGE BUILDER

Create reusable message builder.

Support:

Text
Photo
Video
Buttons
URL

Preview should look similar to Telegram.

Allow:

Save Template
Use Template
Duplicate Template
Edit Template
Delete Template

Template fields:

Name
Message
Media
Buttons
Created Date

⸻

21. CAMPAIGN STATUS

Every campaign has:

DRAFT
PENDING_APPROVAL
SCHEDULED
RUNNING
PAUSED
COMPLETED
PARTIAL
FAILED
CANCELLED

Customer can:

Pause
Resume
Stop

Show real-time progress:

Campaign Running
Selected: 100
Completed: 42
Pending: 53
Failed: 5
42%

⸻

22. BACKGROUND QUEUE

Do not process large campaigns inside one HTTP request.

Use:

Campaign
↓
Recipient/Group jobs
↓
Queue
↓
Worker
↓
Telegram API
↓
Result
↓
Database
↓
Analytics

Workers must be idempotent.

If a worker crashes, it must not create duplicate sends.

Retries only for appropriate temporary failures.

Do not repeatedly retry permanent Telegram restrictions.

⸻

23. CAMPAIGN HISTORY

Mini App:

Campaign History

Show:

Campaign
Type
Date
Status
Selected
Completed
Failed

Click campaign:

Detailed report.

⸻

24. ANALYTICS

Mini App:

Analytics

Show:

Groups found
Groups approved
Groups joined
Campaigns
Messages processed
Successful
Failed
Eligible audience
Previously contacted
New audience

Charts:

Campaign activity
Audience activity
Group activity

⸻

25. NOTIFICATIONS

Mini App notifications:

Group approved
Group join successful
Group join failed
Telegram connection issue
Campaign started
Campaign completed
Campaign failed
Subscription expiry
Payment status

Bot can also notify customer about important events.

⸻

26. CUSTOMER BILLING

Billing page should exist INSIDE THE TELEGRAM MINI APP.

Customer sees:

Current Plan
Plan Price
Usage
Expiry Date
Payment Status
Payment History

Customer does NOT need a normal website for billing.

⸻

27. USDT PAYMENT SYSTEM

Build payment architecture but keep it disabled for initial testing.

Admin will later configure:

Payment Enabled: OFF
Network:
TRC20
USDT Wallet:
EMPTY

Do not hard-code a real wallet.

Database structure:

billing_transactions
id
tenant_id
plan_id
amount
currency
network
wallet_address
status
tx_hash
created_at
paid_at

Statuses:

PENDING
CONFIRMED
EXPIRED
CANCELLED

When testing is complete, Admin can enable payment and add the production USDT address from Admin Website.

⸻

28. ADMIN WEBSITE

The Admin Website is completely separate from the customer Mini App.

Only Super Admin can login.

Admin Login

Email
Password

Secure authentication.

⸻

29. ADMIN DASHBOARD

Show:

Total Customers
Active Customers
Suspended Customers
Active Plans
Revenue
Pending Payments
Total Campaigns
Running Campaigns
Messages Processed
System Errors

Charts:

Revenue
Customer Growth
Campaign Volume
System Usage

⸻

30. CUSTOMER MANAGEMENT

Admin Website:

Customers

List:

Customer
Email
Plan
Status
Created
Expiry
Usage

Actions:

View
Suspend
Activate
Change Plan
Reset Password
View Usage
View Billing
View Campaigns

Admin can create customers manually if required.

⸻

31. CUSTOMER DETAIL

Admin can see:

Customer information
Plan
Subscription
Usage
Telegram connections
Groups
Campaigns
Billing
Logs

Admin can:

Activate
Suspend
Change Plan
Change Limits
Add Notes

Admin must not expose customer credentials unnecessarily.

⸻

32. PLANS

Admin can create/edit plans.

Example:

FREE
BASIC
PRO
PREMIUM

Configurable:

Price
Duration
Telegram connections
Groups
Campaigns
Audience records
Monthly message limit

Do NOT hard-code limits.

⸻

33. SUBSCRIPTIONS

Admin can see:

Customer
Plan
Start Date
Expiry
Status
Payment Status

Statuses:

ACTIVE
EXPIRED
CANCELLED
SUSPENDED
PENDING

⸻

34. ADMIN PAYMENT SETTINGS

Admin Website:

Payment Settings

Payment Status:
Disabled
Network:
TRC20
USDT Address:
[ EMPTY ]
[Save]

Admin can later enable the payment system.

Do not automatically enable it.

Do not put a wallet address in source code.

⸻

35. TELEGRAM ADMIN SETTINGS

Admin Website:

Telegram Settings

Fields:

Bot Token
Bot Username
Mini App URL

Sensitive values must be stored securely.

Bot token should be masked after saving.

Example:

••••••••••••••••

⸻

36. ADMIN SYSTEM SETTINGS

Admin can configure:

System Name
Logo
Support Telegram
Support Email
Maintenance Mode
Registration Enabled
Email Verification Enabled
Payment Enabled
Default Limits
Notification Settings

⸻

37. ADMIN LOGS

Admin Website:

System Logs

Track:

Customer registration
Login
Telegram connection
Group discovery
Group approval
Group join
Campaign creation
Campaign execution
Payment
Subscription
Admin changes
Errors

Columns:

Timestamp
Customer
Action
Resource
Status
Details

⸻

38. CUSTOMER LOGS

Customer can only see their own activity in Mini App.

They cannot see another tenant’s logs.

⸻

39. MULTI-TENANT SECURITY

This is mandatory.

Every customer must have a tenant/workspace.

Example:

Tenant A
 ├── Telegram Accounts
 ├── Groups
 ├── Audience
 ├── Campaigns
 ├── Templates
 └── Billing
Tenant B
 ├── Telegram Accounts
 ├── Groups
 ├── Audience
 ├── Campaigns
 ├── Templates
 └── Billing

Tenant A must NEVER access Tenant B.

Implement:

Authentication
Authorization
RLS/database policies
Tenant isolation
Server-side ownership checks

Never trust:

tenant_id
customer_id
user_id

coming directly from frontend.

Resolve ownership from authenticated session.

⸻

40. ROLES

Create:

SUPER_ADMIN
CUSTOMER
CUSTOMER_USER

SUPER_ADMIN:

All access.

CUSTOMER:

Own tenant only.

CUSTOMER_USER:

Optional future role.

⸻

41. DATABASE

At minimum create:

users
tenants
tenant_members
plans
subscriptions
telegram_connections
telegram_accounts
keywords
discovered_groups
approved_groups
group_memberships
audience_contacts
message_templates
campaigns
campaign_groups
campaign_recipients
campaign_jobs
campaign_logs
billing_transactions
notifications
admin_logs
system_logs

Use UUIDs.

Create indexes for:

tenant_id
telegram_user_id
telegram_group_id
campaign_id
status
created_at

Unique constraints for duplicate protection.

⸻

42. API

Create clean backend service structure:

/api/auth
/api/telegram
/api/groups
/api/audience
/api/campaigns
/api/templates
/api/analytics
/api/billing
/api/admin
/api/settings

Every protected endpoint must verify:

Authentication
Tenant
Role
Permissions

⸻

43. ENVIRONMENT VARIABLES

Create .env.example.

Include placeholders:

DATABASE_URL=
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TELEGRAM_BOT_TOKEN=
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_MINI_APP_URL=
REDIS_URL=
PAYMENT_NETWORK=TRC20
PAYMENT_WALLET_ADDRESS=

Never commit real secrets.

⸻

44. SECURITY REQUIREMENTS

Implement:

Secure authentication
Password hashing
Session expiration
Rate limiting
Input validation
Database RLS
Authorization
Audit logs
Encrypted secrets
HTTPS
Secure cookies/tokens

Never:

Store plaintext passwords
Expose bot token
Expose API keys
Expose private Telegram credentials
Trust frontend tenant IDs
Allow cross-tenant data access

⸻

45. TELEGRAM SAFETY REQUIREMENTS

Only use legitimate/authorized Telegram functionality.

Do NOT build:

OTP theft
Password harvesting
Session-string theft
Unauthorized session extraction
Private-group bypass
Anti-ban mechanisms
Anti-spam bypass
Rate-limit bypass
Proxy/account rotation specifically to evade restrictions
Arbitrary member scraping
Unsolicited bulk DM automation

Audience messaging must be restricted to users who are legitimately contactable/opted in or have interacted with the customer’s bot.

⸻

46. RESPONSIVE UI

Telegram Mini App

Mobile-first.

Use:

Bottom navigation
Cards
Swipe-friendly controls
Compact tables
Modal sheets
Search
Filters
Progress bars
Skeleton loaders

Admin Website

Desktop-first but responsive.

Use:

Sidebar
Top navigation
Tables
Charts
Filters
Search
Modals
Detail pages

Visual style:

Premium
Professional
Modern SaaS
Clean
Fast
Minimal
Consistent

Do not create a generic template-looking UI.

⸻

47. MINI APP NAVIGATION — FINAL

Customer Mini App must have:

HOME
GROUPS
AUDIENCE
CAMPAIGNS
CONNECTIONS
SETTINGS

Inside:

HOME

* Dashboard
* Analytics
* Notifications

GROUPS

* Find Groups
* Pending
* Approved
* Joined
* History

AUDIENCE

* Select Source Groups
* Find Eligible Audience
* Select Users
* Contact History

CAMPAIGNS

* All
* Group Promotion
* DM Promotion
* Create Campaign
* Templates
* History

CONNECTIONS

* Telegram Accounts
* Connection Status

SETTINGS

* Account
* Subscription
* Billing
* Notifications
* Help

⸻

48. ADMIN WEBSITE NAVIGATION — FINAL

Only Super Admin:

Dashboard
Customers
 ├── All Customers
 └── Customer Details
Plans
Subscriptions
Payments
 ├── Transactions
 └── Payment Settings
Telegram
 ├── Bot Settings
 └── Mini App Settings
Analytics
System Logs
Audit Logs
Settings
 ├── General
 ├── Security
 ├── Registration
 └── System

⸻

49. IMPORTANT: NO CUSTOMER WEBSITE

Do NOT create:

Customer Website Dashboard
Customer Website Analytics
Customer Website Campaign Manager
Customer Website Billing Dashboard
Customer Website Group Manager

All of these belong inside the Telegram Mini App.

The only customer-facing web-like interface is the Telegram Mini App.

The normal website is exclusively for Super Admin.

⸻

50. CUSTOMER JOURNEY

Final customer journey:

Customer receives Telegram Bot
        ↓
/start
        ↓
Register
        ↓
Email + Password
        ↓
Login
        ↓
OPEN MINI APP
        ↓
Dashboard
        ↓
Connect Telegram Account
        ↓
Add Keywords
        ↓
Find Groups
        ↓
Review Groups
        ↓
Approve Groups
        ↓
Join Where Permitted
        ↓
Select Group(s)
        ↓
Find Eligible Audience
        ↓
Remove Previously Contacted
        ↓
Select All / 10 / 15 / 25 / Custom
        ↓
Create Promotion
        ↓
Preview
        ↓
Approve
        ↓
Campaign Queue
        ↓
Execution
        ↓
Live Status
        ↓
Analytics

⸻

51. ADMIN JOURNEY

Admin Website
      ↓
Admin Login
      ↓
Dashboard
      ↓
Customers
      ↓
Plans
      ↓
Subscriptions
      ↓
Payments
      ↓
USDT Configuration
      ↓
Telegram Bot Settings
      ↓
Analytics
      ↓
System Logs

⸻

52. DEMO / TESTING MODE

The platform must support testing mode.

Testing mode:

Payment disabled
USDT wallet empty
Email verification configurable
Demo data clearly marked
External credentials configurable through environment variables

Do not make fake successful Telegram actions look real.

If an external integration is not configured, clearly show:

Not Configured

rather than pretending the operation succeeded.

⸻

53. FINAL QUALITY REQUIREMENT

Do not build only frontend screens.

Build the actual:

Frontend
Backend
Database
Authentication
Authorization
Tenant isolation
Telegram integration layer
Mini App integration
Admin panel
Campaign architecture
Queue/worker architecture
Billing architecture
Logging
Analytics
Error handling

Every important button must perform a real action or clearly show that the required external configuration is missing.

The system must be structured so it can later scale to a large number of independent customers without redesigning the database.

⸻

54. FINAL ACCEPTANCE TEST

Before declaring the project complete, verify:

CUSTOMER:

[ ] Can register from Telegram Bot
[ ] Can login from Telegram Bot
[ ] Can open Mini App
[ ] Can see own Dashboard
[ ] Can connect Telegram account through authorized flow
[ ] Can add keywords
[ ] Can discover permitted public groups
[ ] Can approve/reject groups
[ ] Can manage approved groups
[ ] Can select source groups before audience discovery
[ ] Can find eligible audience
[ ] Can see previously contacted users
[ ] Can deduplicate users
[ ] Can Select All
[ ] Can Select 10
[ ] Can Select 15
[ ] Can Select 25
[ ] Can Custom Select
[ ] Can create Group Promotion
[ ] Can create eligible DM Promotion
[ ] Can preview message
[ ] Can approve campaign
[ ] Can pause campaign
[ ] Can resume campaign
[ ] Can stop campaign
[ ] Can see campaign progress
[ ] Can see history
[ ] Can see analytics
[ ] Can manage templates
[ ] Can see billing
[ ] Can see subscription
[ ] Cannot access another customer

ADMIN:

[ ] Admin login works
[ ] Admin dashboard works
[ ] Customer management works
[ ] Plan management works
[ ] Subscription management works
[ ] Payment settings work
[ ] USDT wallet can be configured later
[ ] Wallet initially empty
[ ] Payment initially disabled
[ ] Telegram bot settings work
[ ] System settings work
[ ] Logs work
[ ] Analytics work
[ ] Admin can suspend customer
[ ] Admin can change customer plan
[ ] Admin can view customer usage
[ ] Admin can see system errors

SECURITY:

[ ] Passwords hashed
[ ] Secrets protected
[ ] RLS implemented
[ ] Tenant isolation tested
[ ] Cross-customer access blocked
[ ] Duplicate campaign jobs prevented
[ ] Duplicate recipients prevented
[ ] Sensitive Telegram credentials protected
[ ] No OTP/password harvesting
[ ] No anti-spam bypass
[ ] No rate-limit bypass

⸻

55. FINAL INSTRUCTION TO LOVABLE

Treat this document as the complete product specification.

Do not simplify the architecture by removing required modules.

Do not create a customer website dashboard.

The product has exactly TWO interfaces:

CUSTOMER

Telegram Bot + Telegram Mini App

SUPER ADMIN

Normal Web Admin Panel

The Mini App is the customer’s complete product.

The Admin Website is the platform owner’s complete management system.

Build the system with clean separation between these two interfaces, a shared secure backend, proper multi-tenant database architecture, scalable background jobs and production-ready security.

If a third-party Telegram capability requires additional credentials, API configuration, webhook, worker or external deployment, create the correct integration abstraction and clearly document the required configuration instead of creating a fake implementation.

Do not claim an external integration is working until it has actually been configured and tested.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4986c53d-b65c-43ab-8783-622431d12398).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
