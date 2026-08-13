import React from 'react';
import { Link } from 'react-router-dom';

type Props = { children: React.ReactNode; label?: string };

type State = { error: Error | null };

function isChunkLoadError(error: Error): boolean {
  const msg = `${error.name} ${error.message}`;
  return /ChunkLoadError|Loading chunk|Failed to fetch|dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(
    msg
  );
}

/**
 * Catches lazy-route failures (stale chunk after deploy, network blip).
 * Without this, React white-screens the main pane with no recovery UI.
 */
export class RouteErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    if (isChunkLoadError(error) && !sessionStorage.getItem('guardentra_chunk_reload')) {
      sessionStorage.setItem('guardentra_chunk_reload', '1');
      window.location.reload();
    }
  }

  private clearAndReload = () => {
    sessionStorage.removeItem('guardentra_chunk_reload');
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const label = this.props.label || 'This page';
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center justify-center space-y-4 py-24 text-center">
        <h1 className="font-display text-2xl font-bold text-slate-50">{label} failed to load</h1>
        <p className="text-sm text-slate-400">
          Usually a stale browser cache after a deploy. Reload to pick up the latest app bundle.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <button
            type="button"
            onClick={this.clearAndReload}
            className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
          >
            Reload page
          </button>
          <Link
            to="/vendors"
            className="inline-flex h-9 items-center rounded-md border border-white/10 px-4 text-sm font-medium text-slate-300 hover:bg-white/5"
          >
            Back to Vendors
          </Link>
        </div>
      </div>
    );
  }
}
