export default function HoldingPage({ name }: { name: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--color-accent)" }}>{name}</p>
        <h1 className="font-display text-4xl font-bold mt-4">Menu temporarily unavailable</h1>
        <p className="mt-4 opacity-80 max-w-md mx-auto">Please check back soon. If you are at the restaurant, a member of the team can help you with today&apos;s menu.</p>
      </div>
    </main>
  );
}
