export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="amanah-ambient relative min-h-dvh overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,_rgba(25,184,121,0.07)_0%,_rgba(91,141,239,0.04)_42%,_transparent_72%)]"
        aria-hidden
      />
      <div className="relative">{children}</div>
    </div>
  );
}
