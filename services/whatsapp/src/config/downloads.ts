export type DownloadPlatform = "android" | "windows" | "web" | "ios";

export type DownloadStatus = "available" | "coming-soon";

export type DownloadEntry = {
  id: string;
  platform: DownloadPlatform;
  title: string;
  description: string;
  status: DownloadStatus;
  url?: string;
};

export const downloadCatalog: DownloadEntry[] = [
  {
    id: "android-apk",
    platform: "android",
    title: "Android APK",
    description: "Native Android installation package for MARK WhatsApp.",
    status: "coming-soon",
  },
  {
    id: "windows-app",
    platform: "windows",
    title: "Windows App",
    description: "Desktop client package for Windows.",
    status: "coming-soon",
  },
  {
    id: "web-app",
    platform: "web",
    title: "Web App",
    description: "Browser-based access via wa.mark8bot.com.",
    status: "available",
    url: "/app",
  },
  {
    id: "ios-app",
    platform: "ios",
    title: "iOS App",
    description: "iOS app is planned.",
    status: "coming-soon",
  },
];

