import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode; name: string }
type State = { error: Error | null }

export class LayerErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="layer-error-fallback">
          <span>Layer error</span>
          <small>{this.props.name}</small>
        </div>
      )
    }
    return this.props.children
  }
}
