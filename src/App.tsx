import Hub from './windows/Hub'
import EditorWindow from './windows/EditorWindow'
import ViewerWindow from './windows/ViewerWindow'
import TagsWindow from './windows/TagsWindow'
import { ErrorBoundary } from './components/UI/ErrorBoundary'

export default function App() {
  const params = new URLSearchParams(window.location.search)
  const win = params.get('window')

  const renderWindow = () => {
    if (win === 'editor') return <EditorWindow />
    if (win === 'viewer') return <ViewerWindow />
    if (win === 'tags') return <TagsWindow />
    return <Hub />
  }

  return <ErrorBoundary>{renderWindow()}</ErrorBoundary>
}
