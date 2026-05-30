type Variant = "error" | "success" | "info";

const variantClasses: Record<Variant, string> = {
  error:
    "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  info:
    "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-100",
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
      className={`rounded-lg border px-4 py-3 text-sm ${variantClasses[variant]} ${className}`}
    >
      {message}
    </p>
  );
}
