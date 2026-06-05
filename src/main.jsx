import React from 'react'
import ReactDOM from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './fonts.css'
import './styles.css'
import App from './App.jsx'

// No StrictMode: the Leaflet map is created imperatively in a useEffect and the
// double mount/unmount StrictMode performs in dev can race the map teardown.
// The prototype rendered a bare <App/> too.
ReactDOM.createRoot(document.getElementById('root')).render(<App />)