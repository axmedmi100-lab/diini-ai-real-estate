export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-lg shadow-sm">⌁</div>
      <p className="mt-4 font-semibold text-slate-900">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}
