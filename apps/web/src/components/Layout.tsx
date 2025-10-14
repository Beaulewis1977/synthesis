import { Link, Outlet } from 'react-router-dom';

export function Layout() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <header className="bg-white border-b border-border">
        <div className="container mx-auto px-lg py-md">
          <div className="flex items-center justify-between">
            <Link to="/" className="text-xl font-bold text-text-primary">
              Synthesis RAG
            </Link>
            <nav className="flex gap-md">
              <Link
                to="/"
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                Collections
              </Link>
              <Link
                to="/costs"
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                💰 Costs
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-lg py-lg">
        <Outlet />
      </main>
    </div>
  );
}
