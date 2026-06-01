type Variant = "error" | "success" | "info";

const variantClasses: Record<Variant, string> = {
  error: "border-no/40 bg-no/10 text-no",
  success: "border-accent/40 bg-accent-soft text-accent-ink",
  info: "border-line-strong bg-surface-2 text-ink-soft",
};

type Props = {
  message: string;
  variant?: Variant;
  className?: string;
};

export default function AlertBanner({
  message,
  variant = "error",
  className = "",
}: Props) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm ${variantClasses[variant]} ${className}`}
    >
      {message}
    </p>
  );
}
