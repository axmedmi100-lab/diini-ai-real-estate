type AuthMessageProps = Readonly<{
  error?: string;
  message?: string;
}>;

export function AuthMessage({ error, message }: AuthMessageProps) {
  const text = error ?? message;
  if (!text) return null;

  return (
    <p
      className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
      role="status"
    >
      {text}
    </p>
  );
}
