import type { ReactElement } from "react";
import { HomePage } from "../pages/public/HomePage";
import { FeaturesPage } from "../pages/public/FeaturesPage";
import { DownloadPage } from "../pages/public/DownloadPage";
import { PricingPage } from "../pages/public/PricingPage";
import { DocsPage } from "../pages/public/DocsPage";
import { LoginPage } from "../pages/public/LoginPage";
import { RegisterPage } from "../pages/public/RegisterPage";
import { PrivacyPage } from "../pages/public/PrivacyPage";
import { TermsPage } from "../pages/public/TermsPage";
import { AcceptableUsePage } from "../pages/public/AcceptableUsePage";
import { AppShellPage } from "../pages/app/AppShellPage";
import { AppInboxPage } from "../pages/app/AppInboxPage";
import { AppContactsPage } from "../pages/app/AppContactsPage";
import { AppCampaignsPage } from "../pages/app/AppCampaignsPage";
import { AppTemplatesPage } from "../pages/app/AppTemplatesPage";
import { AppLeadsPage } from "../pages/app/AppLeadsPage";
import { AppMarkAiPage } from "../pages/app/AppMarkAiPage";
import { AppAiEmployeesPage } from "../pages/app/AppAiEmployeesPage";
import { AppAutomationsPage } from "../pages/app/AppAutomationsPage";
import { AppMediaPage } from "../pages/app/AppMediaPage";
import { AppWebTasksPage } from "../pages/app/AppWebTasksPage";
import { AppAnalyticsPage } from "../pages/app/AppAnalyticsPage";
import { AppIntegrationsPage } from "../pages/app/AppIntegrationsPage";
import { AppTeamPage } from "../pages/app/AppTeamPage";
import { AppBillingPage } from "../pages/app/AppBillingPage";
import { AppSettingsPage } from "../pages/app/AppSettingsPage";

export type NavGroup = "public" | "app";

export type RouteSpec = {
  path: `/${string}`;
  label: string;
  element: ReactElement;
  nav: boolean;
  group: NavGroup;
};

export type MenuItem = {
  path: `/${string}`;
  label: string;
};

export type FooterMenuSection = {
  title: string;
  links: MenuItem[];
};

export const publicHeaderLinks: MenuItem[] = [
  { path: "/#features", label: "Product" },
  { path: "/#how", label: "How to Use" },
  { path: "/#about", label: "About" },
  { path: "/#security", label: "Security" },
  { path: "/#pricing", label: "Pricing" },
  { path: "/#faq", label: "FAQ" },
  { path: "/#support", label: "Support" },
];

export const authMenuLinks: { login: MenuItem; primaryAction: MenuItem } = {
  login: { path: "/login", label: "Login" },
  primaryAction: { path: "/register", label: "Get Started" },
};

export const publicFooterLinks: FooterMenuSection[] = [
  {
    title: "Product",
    links: [
      { path: "/#features", label: "Features" },
      { path: "/#ai", label: "MARK AI" },
      { path: "/#pricing", label: "Pricing" },
      { path: "/#support", label: "Support" },
    ],
  },
  {
    title: "Resources",
    links: [
      { path: "/download", label: "Download" },
      { path: "/docs", label: "Docs" },
      { path: "/features", label: "Product Capability" },
    ],
  },
  {
    title: "Company",
    links: [
      { path: "/#about", label: "About" },
      { path: "/#how", label: "How to Use" },
      { path: "/#faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { path: "/privacy", label: "Privacy" },
      { path: "/terms", label: "Terms" },
      { path: "/acceptable-use", label: "Acceptable Use" },
    ],
  },
];

export const publicRoutes: RouteSpec[] = [
  { path: "/", label: "Home", element: <HomePage />, nav: true, group: "public" },
  { path: "/features", label: "Features", element: <FeaturesPage />, nav: true, group: "public" },
  { path: "/download", label: "Download", element: <DownloadPage />, nav: true, group: "public" },
  { path: "/pricing", label: "Pricing", element: <PricingPage />, nav: true, group: "public" },
  { path: "/docs", label: "Docs", element: <DocsPage />, nav: true, group: "public" },
  { path: "/login", label: "Login", element: <LoginPage />, nav: true, group: "public" },
  { path: "/register", label: "Register", element: <RegisterPage />, nav: true, group: "public" },
  { path: "/privacy", label: "Privacy", element: <PrivacyPage />, nav: true, group: "public" },
  { path: "/terms", label: "Terms", element: <TermsPage />, nav: true, group: "public" },
  {
    path: "/acceptable-use",
    label: "Acceptable Use",
    element: <AcceptableUsePage />,
    nav: true,
    group: "public",
  },
];

export const appRoutes: RouteSpec[] = [
  { path: "/app", label: "App", element: <AppShellPage />, nav: false, group: "app" },
  { path: "/app/inbox", label: "Inbox", element: <AppInboxPage />, nav: true, group: "app" },
  { path: "/app/contacts", label: "Contacts", element: <AppContactsPage />, nav: true, group: "app" },
  { path: "/app/campaigns", label: "Campaigns", element: <AppCampaignsPage />, nav: true, group: "app" },
  { path: "/app/templates", label: "Templates", element: <AppTemplatesPage />, nav: true, group: "app" },
  { path: "/app/leads", label: "Leads", element: <AppLeadsPage />, nav: true, group: "app" },
  { path: "/app/mark-ai", label: "MARK AI", element: <AppMarkAiPage />, nav: true, group: "app" },
  { path: "/app/ai-employees", label: "AI Employees", element: <AppAiEmployeesPage />, nav: true, group: "app" },
  { path: "/app/automations", label: "Automations", element: <AppAutomationsPage />, nav: true, group: "app" },
  { path: "/app/media", label: "Media", element: <AppMediaPage />, nav: true, group: "app" },
  { path: "/app/web-tasks", label: "Web Tasks", element: <AppWebTasksPage />, nav: true, group: "app" },
  { path: "/app/analytics", label: "Analytics", element: <AppAnalyticsPage />, nav: true, group: "app" },
  { path: "/app/integrations", label: "Integrations", element: <AppIntegrationsPage />, nav: true, group: "app" },
  { path: "/app/team", label: "Team", element: <AppTeamPage />, nav: true, group: "app" },
  { path: "/app/billing", label: "Billing", element: <AppBillingPage />, nav: true, group: "app" },
  { path: "/app/settings", label: "Settings", element: <AppSettingsPage />, nav: true, group: "app" },
];

export const publicNavigation = publicRoutes.filter((route) => route.nav);
export const appNavigation = appRoutes.filter((route) => route.nav);
