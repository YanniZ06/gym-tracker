import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import WorkoutView from './pages/new_workout/WorkoutView'
// import './App.css'

const VIEW_STORAGE_KEY = 'app_last_view'

function loadStoredView() {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch (e) {
    console.warn('Konnte gespeicherte View nicht lesen:', e)
  }
  return null
}

function persistView(view, workoutId) {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ view, workoutId: workoutId ?? null }))
  } catch (e) {
    console.warn('Konnte View nicht speichern:', e)
  }
}

function App() {
  const [view, setView] = useState('login')
  const [session, setSession] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)

  const [loadingFadeOut, setLoadingFadeOut] = useState(false)
  const [fadeState, setFadeState] = useState('in')

  const [userdata, setUserdata] = useState(null)
  const [loadingUserdata, setLoadingUserdata] = useState(false)

  const [activeWorkoutId, setActiveWorkoutId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)

      if (session) {
        const stored = loadStoredView()
        if (stored && (stored.view === 'dashboard' || stored.view === 'workout')) {
          setView(stored.view)
          if (stored.view === 'workout' && stored.workoutId) {
            setActiveWorkoutId(stored.workoutId)
          }
        } else {
          setView('dashboard')
        }
      }

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

  // userdata laden, sobald eine Session vorhanden ist
  useEffect(() => {
    fetchUserData()
  }, [session])

  function fetchUserData() {
    if (!session?.user?.email) return
    setLoadingUserdata(true)

    supabase
      .from('USERS')
      .select('*')
      .eq('login_mail', session.user.email)
      .single()
      .then(({ data, error }) => {
        setLoadingUserdata(false)

        if (error) {
          if (error.code === 'PGRST116') {
            createUserRecord()
          } else {
            console.error('Fehler [', error.code, '] beim Abrufen der Benutzerdaten:', error.message)
          }
        } else {
          setUserdata(data)
        }
      })
  }

  function createUserRecord() {
    supabase
      .from('USERS')
      .insert([{ login_mail: session.user.email, name: session.user.email }])
      .select()
      .single()
      .then(({ data, error }) => {
        setLoadingUserdata(false)

        if (error) {
          console.error('Fehler [', error.code, '] beim Anlegen eines neuen Nutzers:', error.message)
        } else {
          setUserdata(data)
        }
      })
  }

  function changeView(newView, payload = {}) {
    setFadeState('out')
    setTimeout(() => {
      const nextWorkoutId = payload.workoutId !== undefined ? payload.workoutId : activeWorkoutId
      if (payload.workoutId !== undefined) setActiveWorkoutId(payload.workoutId)
      setView(newView)
      setFadeState('in')

      if (newView === 'login') {
        localStorage.removeItem(VIEW_STORAGE_KEY)
      } else {
        persistView(newView, newView === 'workout' ? nextWorkoutId : null)
      }
    }, 200)
  }

  function renderView() {
    switch (view) {
      case 'dashboard':
        return (
          <Dashboard
            session={session}
            userdata={userdata}
            setUserdata={setUserdata}
            fetchUserData={fetchUserData}
            loadingUserdata={loadingUserdata}
            onLogout={() => changeView('login')}
            onStartWorkout={(workoutId) => changeView('workout', { workoutId })}
          />
        )

      case 'workout':
        return (
          <WorkoutView
            session={session}
            userdata={userdata}
            workoutId={activeWorkoutId}
            onExit={() => changeView('dashboard')}
          />
        )

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