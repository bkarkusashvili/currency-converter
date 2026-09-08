export function ParagraphList({ paragraphs }: { paragraphs: readonly string[] }) {
  return (
    <div className="mt-5 grid max-w-2xl gap-3">
      {paragraphs.map((paragraph) => (
        <p key={paragraph} className="text-muted text-base">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
