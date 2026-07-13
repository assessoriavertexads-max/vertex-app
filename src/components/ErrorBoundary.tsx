import React from 'react';
import { AlertTriangle, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-background">
          <div className="space-y-4 text-center max-w-md mx-auto px-4">
            <div className="flex justify-center">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Algo deu errado</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado. Tente recarregar a página ou voltar para o início.
            </p>
            {this.state.error && (
              <pre className="text-left bg-muted p-3 rounded text-xs overflow-auto max-h-40 text-destructive">
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.error.stack?.split('\n').slice(0, 6).join('\n')}
              </pre>
            )}
            <div className="flex gap-2 justify-center pt-4">
              <Button variant="outline" onClick={this.resetError}>
                Tentar Novamente
              </Button>
              <Button onClick={() => (window.location.href = '/')}>
                <Home className="h-4 w-4 mr-2" />
                Ir para Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
