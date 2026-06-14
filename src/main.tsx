import { createRoot } from 'react-dom/client'
import './styles.css'
import { App } from './App'
import { DialogProvider } from './components/DialogProvider'

const container = document.getElementById('root')
if (!container) throw new Error('Root element not found')

// StrictMode is intentionally omitted: its double-invoked effects interfere with
// xterm instance lifecycle and the global terminal data listener.
createRoot(container).render(
  <DialogProvider>
    <App />
  </DialogProvider>
)
