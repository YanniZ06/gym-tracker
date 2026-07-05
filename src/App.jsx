import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
// import './App.css'

function App() {
  const [view, setView] = useState('login')
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [loadingFadeOut, setLoadingFadeOut] = useState(false)
  const [fadeState, setFadeState] = useState('in')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setView('dashboard')

      if (checkingSession) {
        setLoadingFadeOut(true)

        setTimeout(() => {
          setCheckingSession(false)
        }, 200)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  function changeView(newView) {
    setFadeState('out')
    setTimeout(() => {
      setView(newView)
      setFadeState('in')
    }, 200)
  }

  function renderView() {
    switch (view) {
      case 'dashboard':
        return <Dashboard session={session} onLogout={() => changeView('login')} />

      // case 'login':
      default:
        return (
          <Login
            session={session}
            setSession={setSession}
            onLoginSuccess={() => changeView('dashboard')}
          />
        )
    }
  }

  if (checkingSession) {
    return (
      <div className={`app-loading ${loadingFadeOut ? 'app-loading-out' : ''}`} />
    )
  }

  return (
    <div className={`view-fade view-fade-${fadeState}`}>
      {renderView()}
    </div>
  )
}

export default App
