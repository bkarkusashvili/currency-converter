export interface CommandBlockContent {
  caption: string;
  commands: readonly string[];
}

export function CommandBlock({ caption, commands }: CommandBlockContent) {
  return (
    <div>
      <p className="eyebrow">{caption}</p>
      <pre className="bg-sunken border-line mt-2 overflow-x-auto rounded-lg border p-4 font-mono text-xs leading-6">
        {commands.join('\n')}
      </pre>
    </div>
  );
}
