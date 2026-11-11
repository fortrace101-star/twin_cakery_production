export function StageTabs({
  stages,
  active,
  onChange,
}: {
  stages: { id: string; label: string; count: number }[];
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
          aria-selected={s.id === active}
          className={s.id === active ? "active" : ""}
          onClick={() => onChange(s.id)}
        >
          {s.label}
          <span className="inline-count">{s.count}</span>
        </button>
      ))}
    </div>
  );
}
