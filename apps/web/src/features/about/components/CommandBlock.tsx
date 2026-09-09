export interface CommandBlockContent {
  caption: string;
  commands: readonly string[];
}

export function CommandBlock({ caption, commands }: CommandBlockContent) {
  return (
    // A grid item defaults to min-width:auto, which would let the block widen
    // the whole page instead of wrapping inside itself.
    <figure className="m-0 grid min-w-0 gap-2">
      <figcaption className="text-faint font-mono text-[0.6875rem] font-medium tracking-[0.12em] uppercase">
        {caption}
      </figcaption>
      <pre className="code-block m-0">{commands.join('\n')}</pre>
    </figure>
  );
}
