export function ParagraphList({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="grid gap-4">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted text-pretty">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
