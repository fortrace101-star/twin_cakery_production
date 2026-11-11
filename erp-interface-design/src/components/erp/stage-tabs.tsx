export function StageTabs({
  stages,
  active,
  onChange,
}: {
  stages: { id: string; label: string; shortLabel?: string; count: number }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="stage-tabs" role="tablist" aria-label="Stages">
      {stages.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-label={`${s.label} (${s.count})`}
          aria-selected={s.id === active}
          className={(s.id === active ? "active" : "") + (s.count === 0 ? " is-empty" : "")}
          ref={(el) => { if (el && s.id === active) el.scrollIntoView({ inline: 'center', block: 'nearest' }); }}
          onClick={() => onChange(s.id)}
        >
          {s.shortLabel ?? s.label}
          <span className="inline-count">{s.count}</span>
        </button>
      ))}
    </div>
  );
}
