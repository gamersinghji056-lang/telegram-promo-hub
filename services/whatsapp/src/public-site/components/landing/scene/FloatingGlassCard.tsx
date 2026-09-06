type FloatingGlassCardProps = {
  title: string;
  body: string;
  className?: string;
};

export function FloatingGlassCard({ title, body, className }: FloatingGlassCardProps) {
  return (
    <article className={`float-card ${className ?? ""}`} data-parallax-depth="8" data-parallax-base="translateZ(0)">
      <small>{title}</small>
      <strong>{body}</strong>
    </article>
  );
}
