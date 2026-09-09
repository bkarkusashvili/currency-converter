import type { ReactNode } from 'react';

interface ContentSectionProps {
  id: string;
  title: string;
  children: ReactNode;
}

export function ContentSection({ id, title, children }: ContentSectionProps) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="grid scroll-mt-20 gap-4">
      <h2 id={`${id}-heading`} className="section-title">
        {title}
      </h2>
      {children}
    </section>
  );
}
