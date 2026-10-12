import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State { error: Error | null }

/** Last line of defence: a friendly screen instead of a blank page if something unexpected breaks. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Xعفش] unexpected error', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="container">
          <div className="empty">
            <div className="big">😵</div>
            <h2>حصلت مشكلة غير متوقعة</h2>
            <p className="meta">جرّب تحدّث الصفحة. لو المشكلة اتكررت، قولنا من صفحة حسابك.</p>
            <button className="btn btn-primary" onClick={() => { this.setState({ error: null }); window.location.reload() }}>تحديث الصفحة</button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
