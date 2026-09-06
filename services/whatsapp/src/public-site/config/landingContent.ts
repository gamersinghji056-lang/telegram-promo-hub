import type { DownloadStatus } from "../../config/downloads";

export const heroStats = [
  { label: "Businesses", value: "50K+" },
  { label: "Messages Sent", value: "2M+" },
  { label: "Uptime", value: "99.9%" },
  { label: "AI Support", value: "24/7" },
] as const;

export const trustedBrands = [
  "Meta",
  "AWS",
  "Cloudflare",
  "Google Cloud",
  "Stripe",
  "Zapier",
];

export const capabilities = [
  {
    title: "AI Business Assistant",
    body: "Summarize customer conversations, prepare context-aware suggestions, and prioritize next actions for teams.",
  },
  {
    title: "Smart Inbox",
    body: "Cluster follow-ups, surface context and ownership, and keep every thread within an operator workflow.",
  },
  {
    title: "Contacts & CRM",
    body: "Centralize notes, tags, history, lead stage and follow-up context where every action stays connected.",
  },
  {
    title: "Campaigns",
    body: "Plan and monitor outbound activity with clear windows, auditability and role-gated execution.",
  },
  {
    title: "AI Employees",
    body: "Configure Sales, Support and Operations agents with role-specific behavior and explicit tool boundaries.",
  },
  {
    title: "Automations",
    body: "Automate routine operations while preserving explicit approvals for sensitive or high-impact actions.",
  },
  {
    title: "Media & Files",
    body: "Handle PDFs, images and documents in the same workspace with structured context and file controls.",
  },
  {
    title: "Web Tasks",
    body: "Launch approved browser workflows for partner data and operational updates with visibility into every action.",
  },
];

export const markAiExamples = [
  "summarize customer conversations",
  "prepare suggested replies",
  "search CRM records",
  "organize follow-ups",
  "process documents",
  "prepare business actions for review",
] as const;

export const employeeRoles = [
  {
    title: "Sales",
    items: [
      "Lead qualification and prioritization",
      "Quotation flow support",
      "Follow-up scheduling and status tracking",
    ],
  },
  {
    title: "Support",
    items: [
      "Issue triage by topic",
      "Escalation context and handoff notes",
      "Response consistency checks",
    ],
  },
  {
    title: "Operations",
    items: [
      "Order and logistics tracking",
      "Status updates and reminders",
      "Operational playbooks with guardrails",
    ],
  },
];

export const operationsHighlights = [
  "customer conversations with context and handoff notes",
  "templates for structured messaging",
  "approved campaigns with compliant dispatch windows",
  "follow-up reminders and outcomes",
  "contact and label organization",
  "human handoff controls at any step",
];

export const filesMediaHighlights = [
  "PDFs and contracts with indexed context",
  "images and media with structured labels",
  "document workflows in connected customer threads",
  "image resize and compression controls",
  "media sending and delivery state visibility",
  "document processing checks before sharing",
];

export const webTaskHighlights = [
  "Checking supplier portals",
  "Gathering public business information",
  "Updating supported systems with approval",
  "Retrieving business data for team workflows",
] as const;

export const analyticsCards = [
  { title: "Active conversations", value: "1,420", change: "+12%" },
  { title: "Follow-ups completed", value: "884", change: "+8%" },
  { title: "Media processed", value: "2,106", change: "+19%" },
  { title: "AI-assisted actions", value: "1,010", change: "+15%" },
];

export const securityControls = [
  "Role-based permissions for every workspace action",
  "approval gates for high-impact actions",
  "activity logs with clear accountability",
  "business data separation by team and workspace",
  "human oversight with AI permission boundaries",
] as const;

export const languageList = ["English", "Spanish", "Arabic", "Hindi", "French", "Portuguese"];

export const howToUseSteps = [
  {
    title: "Create workspace",
    body: "Set up business profile, team members and workspace operating defaults.",
  },
  {
    title: "Connect WhatsApp",
    body: "Link an approved WhatsApp Business source and define message flow rules.",
  },
  {
    title: "Add/import consented contacts",
    body: "Load customer records with clear ownership and lifecycle metadata.",
  },
  {
    title: "Configure MARK AI",
    body: "Add policies, workflows and response guidance tailored to your brand.",
  },
  {
    title: "Add knowledge and files",
    body: "Upload operational documents and train business context for team and agents.",
  },
  {
    title: "Configure team and employees",
    body: "Assign roles, permissions and language behavior across operator profiles.",
  },
  {
    title: "Create automations",
    body: "Build follow-up, routing and campaign processes with explicit approvals.",
  },
  {
    title: "Launch and improve",
    body: "Run approved campaigns, monitor analytics and optimize continuously.",
  },
];

export const pricingPlans = [
  {
    title: "Starter",
    body: "Built for lean teams starting with Smart Inbox and structured AI support.",
  },
  {
    title: "Growth",
    body: "For teams moving into campaigns, CRM depth, and operations workflows.",
  },
  {
    title: "Scale",
    body: "For larger operations needing multi-agent control and broader automation.",
  },
];

export const faqItems = [
  {
    question: "Is WA MARK only a chatbot?",
    answer:
      "No. WA MARK is an operating workspace for conversations, CRM, AI assistance, campaigns, automations, files, web tasks and reporting.",
  },
  {
    question: "Can my team use the same workspace?",
    answer:
      "Yes. Teams can work in the same environment with role-based access, ownership rules and activity visibility.",
  },
  {
    question: "Can MARK AI reply automatically?",
    answer:
      "MARK AI can assist and automate according to your permissions model. High-impact actions can stay approval gated.",
  },
  {
    question: "Can we run WhatsApp campaigns?",
    answer:
      "Yes. Campaigns are intended for appropriate business communication with consent-aware targeting and approved operational controls.",
  },
  {
    question: "What can AI Employees do?",
    answer:
      "They can support specific roles such as Sales, Support and Operations with configured knowledge, boundaries and permissions.",
  },
  {
    question: "Does WA MARK replace human operations?",
    answer:
      "No. WA MARK is designed as an operator layer. Humans remain accountable and can retain final control where needed.",
  },
];

export const supportCapabilities = [
  "Account and onboarding support",
  "WhatsApp Business setup guidance",
  "AI instruction configuration",
  "Campaign and automation support",
] as const;

export const legalCards = [
  { title: "Privacy", path: "/privacy" },
  { title: "Terms of Service", path: "/terms" },
  { title: "Acceptable Use", path: "/acceptable-use" },
];

export const landingStatus = {
  privacyAndTermsStatus: "Preview content (draft until legal review)",
} as const;

export const marqueeCards = [
  "SMART INBOX",
  "MARK AI",
  "AI EMPLOYEES",
  "AUTOMATIONS",
  "CAMPAIGNS",
  "CRM",
  "FILES",
  "WEB TASKS",
  "ANALYTICS",
] as const;

export const floatingCards = [
  { title: "AI Powered", body: "Smarter Conversations", className: "fc1" },
  { title: "Secure", body: "Your Data, Our Priority", className: "fc2" },
  { title: "Automate", body: "Save Time", className: "fc3" },
  { title: "Grow Faster", body: "Real Results", className: "fc4" },
];

export const dashboardCards = [
  { title: "Inbox", icon: "◉" },
  { title: "Campaigns", icon: "✉" },
  { title: "Analytics", icon: "↗" },
  { title: "Contacts", icon: "◈" },
];

export type DownloadMetadata = {
  platform: "Android APK" | "Windows app" | "Web app" | "iOS (coming soon)";
  status: DownloadStatus;
  description: string;
};

export const downloadMetadata: DownloadMetadata[] = [
  {
    platform: "Android APK",
    status: "coming-soon",
    description: "Native Android installation package.",
  },
  {
    platform: "Windows app",
    status: "coming-soon",
    description: "Desktop client for Windows rollout.",
  },
  {
    platform: "Web app",
    status: "available",
    description: "Use WA MARK directly in the browser.",
  },
  {
    platform: "iOS (coming soon)",
    status: "coming-soon",
    description: "iOS client is planned.",
  },
];
