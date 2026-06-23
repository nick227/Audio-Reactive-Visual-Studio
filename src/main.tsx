import React from 'react'
import ReactDOM from 'react-dom/client'
import { VisualizerEditor } from './features/visualizer/editor/VisualizerEditor'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <VisualizerEditor />
  </React.StrictMode>,
)
