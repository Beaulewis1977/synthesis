/* biome-ignore */
import React, { useState, useEffect, useCallback } from 'react';
import { Button } from './components/Button';
import type { User } from './types';

// Props interface
interface AppProps {
  title: string;
  user?: User;
}

// Functional component with hooks
export function App({ title, user }: AppProps): JSX.Element {
  const [count, setCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    console.log('Component mounted');
    return () => console.log('Component unmounted');
  }, []);

  const handleClick = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return (
    <div className="app">
      <h1>{title}</h1>
      <p>Count: {count}</p>
      <Button onClick={handleClick}>Increment</Button>
    </div>
  );
}

// Arrow function component
export const Header = ({ text }: { text: string }) => (
  <header>
    <h2>{text}</h2>
  </header>
);

// Another arrow function component with explicit return
const Footer: React.FC<{ year: number }> = ({ year }) => {
  return (
    <footer>
      <p>© {year} All rights reserved</p>
    </footer>
  );
};

// Class component
export class Counter extends React.Component<{ initialValue: number }, { count: number }> {
  static defaultProps = {
    initialValue: 0,
  };

  state = {
    count: this.props.initialValue,
  };

  increment = () => {
    this.setState((prev) => ({ count: prev.count + 1 }));
  };

  decrement = () => {
    this.setState((prev) => ({ count: prev.count - 1 }));
  };

  render() {
    return (
      <div>
        <span>{this.state.count}</span>
        <button onClick={this.increment}>+</button>
        <button onClick={this.decrement}>-</button>
      </div>
    );
  }
}

// Custom hook
export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => setCount((c) => c + 1), []);
  const decrement = useCallback(() => setCount((c) => c - 1), []);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);

  return { count, increment, decrement, reset };
}

// Non-component function (starts with lowercase)
export function formatDate(date: Date): string {
  return date.toLocaleDateString();
}

// Higher-order component
export function withAuth<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & { isAuthenticated: boolean }> {
  return (props) => {
    const isAuthenticated = true; // Simplified auth check

    if (!isAuthenticated) {
      return <div>Please log in</div>;
    }

    return <Component {...props} />;
  };
}

// Regular constant
export const API_URL = 'https://api.example.com';

// Component with Fragment
export const List: React.FC<{ items: string[] }> = ({ items }) => (
  <>
    {items.map((item) => (
      <li key={item}>{item}</li>
    ))}
  </>
);
