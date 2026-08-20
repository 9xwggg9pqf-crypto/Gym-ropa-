export default function SectionKicker({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px w-8 bg-red" />
      <span className="font-display text-sm tracking-[0.3em] text-red uppercase">
        {children}
      </span>
    </div>
  );
}
