import { createFileRoute } from "@tanstack/react-router";
import {
  TELEGRAM_PROMOTION_ANDROID,
  TELEGRAM_PROMOTION_ANDROID_APK_FILENAME,
  TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME,
} from "@/lib/promotion-platform";

const DOWNLOADABLE_FILES = new Map([
  [TELEGRAM_PROMOTION_ANDROID_APK_FILENAME, {
    sourceUrl: TELEGRAM_PROMOTION_ANDROID.apkSourceUrl,
    contentType: "application/vnd.android.package-archive",
    disposition: `attachment; filename="${TELEGRAM_PROMOTION_ANDROID_APK_FILENAME}"`,
  }],
  [TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME, {
    sourceUrl: TELEGRAM_PROMOTION_ANDROID.metadataSourceUrl,
    contentType: "application/json; charset=utf-8",
    disposition: `inline; filename="${TELEGRAM_PROMOTION_ANDROID_METADATA_FILENAME}"`,
  }],
]);

export const Route = createFileRoute("/downloads/$file")({
  server: {
    handlers: {
      GET: ({ params }: { params: { file: string } }) => serveDownload(params.file),
      HEAD: ({ params }: { params: { file: string } }) => serveDownload(params.file, true),
    },
  },
});

async function serveDownload(file: string, head = false) {
  const target = DOWNLOADABLE_FILES.get(file);
  if (!target) return new Response("Not found", { status: 404 });

  const upstream = await fetch(target.sourceUrl, {
    redirect: "follow",
    headers: { accept: target.contentType },
  });
  if (!upstream.ok || !upstream.body) {
    return new Response("Android build is not available yet.", {
      status: 503,
      headers: { "cache-control": "public, max-age=60" },
    });
  }

  const headers = new Headers({
    "content-type": target.contentType,
    "content-disposition": target.disposition,
    "cache-control": "public, max-age=300, stale-while-revalidate=3600",
    "x-content-type-options": "nosniff",
  });
  const length = upstream.headers.get("content-length");
  if (length) headers.set("content-length", length);

  return new Response(head ? null : upstream.body, { status: 200, headers });
}
