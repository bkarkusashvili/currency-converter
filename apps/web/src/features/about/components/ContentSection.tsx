import type { ReactNode } from 'react';

interface ContentSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function ContentSection({ id, title, children }: ContentSectionProps) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <h2 id={id} className="border-line border-b pb-3 text-lg">
        {title}
      </h2>
      {children}
    </section>
  );
}
