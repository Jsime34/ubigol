import { useEffect, useState } from 'react'
import './App.css'

function App() {
  const [status, setStatus] = useState('Revisando conexión...')

  useEffect(() => {
    // Usamos el proxy que configuramos en vite.config.ts
    fetch('/api')
      .then(res => res.text())
      .then(data => setStatus(`Conectado: ${data}`))
      .catch(() => setStatus('Backend no disponible ❌'))
  }, [])

  return (
    <div className="container">
      <nav>
        <h1>Ubigol ⚽</h1>
      </nav>
      
      <main>
        <div className="status-card">
          <p>{status}</p>
        </div>

        {/* Aquí irá nuestro mapa en el siguiente paso */}
        <div id="map-container" style={{ width: '100%', height: '400px', background: '#eee', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p>Cargando Mapa de Canchas...</p>
        </div>
      </main>
    </div>
  )
}

export default App
