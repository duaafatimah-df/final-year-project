import React from 'react';

class GlobalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Caught by GlobalErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: 'red', color: 'white', whiteSpace: 'pre-wrap', zIndex: 9999, position: 'relative' }} id="error-boundary-box">
          <h1 id="error-boundary-title">React Crash Detected</h1>
          <p id="error-boundary-msg">{this.state.error && this.state.error.toString()}</p>
          <pre id="error-boundary-stack">{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default GlobalErrorBoundary;
