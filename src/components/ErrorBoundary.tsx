import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/** Top-level error boundary to prevent white-screen crashes. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled render error:', error, info);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            padding: 24,
            background: '#1a1a2e',
            color: '#d4d4d8',
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: 20, marginBottom: 8 }}>Plot3D encountered an error</h1>
          <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '8px 16px',
              background: '#0ea5e9',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
