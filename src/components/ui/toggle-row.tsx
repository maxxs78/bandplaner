export function ToggleRow({
  name,
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  name: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-3 rounded-lg border border-border p-3 ${
        disabled ? "opacity-60" : "cursor-pointer hover:border-primary"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{description}</p>
      </div>
    </label>
  );
}
