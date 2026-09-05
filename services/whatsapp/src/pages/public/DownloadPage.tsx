import { PlaceholderPage } from "../../shared/ui/PlaceholderPage";
import { downloadCatalog } from "../../config/downloads";

export function DownloadPage() {
  return (
    <main className="page-shell">
      <h1>Download</h1>
      <ul>
        {downloadCatalog.map((entry) => (
          <li key={entry.id}>
            {entry.title} ({entry.status})
          </li>
        ))}
      </ul>
    </main>
  );
}

