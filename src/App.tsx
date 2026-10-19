import Hub from './windows/Hub'
import EditorWindow from './windows/EditorWindow'
import ViewerWindow from './windows/ViewerWindow'
import TagsWindow from './windows/TagsWindow'

// Simple window routing via ?window=editor|viewer|tags param
export default function App() {
  const params = new URLSearchParams(window.location.search)
  const win = params.get('window')

  if (win === 'editor') return <EditorWindow />
  if (win === 'viewer') return <ViewerWindow />
  if (win === 'tags') return <TagsWindow />
  return <Hub />
}
