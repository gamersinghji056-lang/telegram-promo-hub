type PlaceholderPageProps = {
  title: string;
};

export function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <main className="page-shell">
      <h1>{title}</h1>
    </main>
  );
}

