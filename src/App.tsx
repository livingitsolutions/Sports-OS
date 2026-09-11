/**
 * SportsOS — architecture sprint placeholder.
 *
 * No product UI is built this sprint. This shell only proves the build path
 * (React + Vite + TS + Tailwind) compiles and that layer boundaries resolve.
 */
export default function App() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-8">
      <div className="max-w-xl text-center space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">SportsOS</h1>
        <p className="text-slate-400 leading-relaxed">
          Architecture sprint. Domain boundaries, ADRs, and port/adapter seams
          are defined under <code className="text-brand-300">docs/</code> and
          <code className="text-brand-300"> src/</code>.
        </p>
        <p className="text-slate-500 text-sm">
          Product UI, auth, migrations, and feature implementation arrive in
          Sprint 1.
        </p>
      </div>
    </main>
  );
}
