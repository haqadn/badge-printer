// SPDX-License-Identifier: GPL-3.0-or-later
import { createRoot } from 'react-dom/client'
import App from './App'
import PrintRoot from './print/PrintRoot'
import './styles.css'

const isPrintWindow = location.hash === '#print'
if (isPrintWindow) document.documentElement.classList.add('print-window')

createRoot(document.getElementById('root')!).render(isPrintWindow ? <PrintRoot /> : <App />)
