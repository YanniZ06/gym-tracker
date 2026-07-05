import { useState, useEffect } from 'react'

import LoginModal from './LoginModal'
import OptionModal from './OptionModal'
import { supabase } from './supabaseClient'

import maggus from './assets/markus_low.png'
import './App.css'

function App() {
  const [showLogin, setShowLogin] = useState(false)
  const [showInfo, setShowInfo] = useState(0) // Counter welches Info-Modal gezeigt wird
  const [session, setSession] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
  }

  return (
    <>
      <section id="center">
        <div>
          <img src={maggus} className="base" width="170" height="179" alt="" />
        </div>
        <div>
          <h1>DER Gym Tracker</h1>
          <p>
            Beweis mal, dass du es bist
          </p>
        </div>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="login">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Einloggen</h2>
          <p>Log dich ein du Schlampe, tue es</p>
          <ul>
            <li>
              {session ? (
                <a onClick={handleLogout} className='btn_login'>Logout ({session.user.email})</a>
              ) : (
                <a onClick={() => setShowLogin(true)} className='btn_login'>Login</a>
              )}

              {showLogin && (
                <LoginModal
                  onClose={() => setShowLogin(false)}
                  onSuccess={(data) => {
                    setSession(data.session)
                    setShowInfo(2)
                  }}
                />
              )}

              {showInfo === 2 && ((<OptionModal
                title="Erfolgreich eingeloggt"
                message="Ab geht's"
                buttons={[{ label: 'Ok', onClick: () => {
                  
                 } }]}
                canCancel={true}
                onClose={() => setShowInfo(0)}
              />))}

            </li>
          </ul>
        </div>
        <div id="setpass">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Zugriff anfordern</h2>
          <p>Beantrage Zugriff auf die Seite</p>
          <ul>
            <li>
              <a onClick={() => setShowInfo(1)} className="btn_setpass">
                Zugriff anfordern
              </a>

              {showInfo === 1 && (
                <OptionModal
                  title="Ups!"
                  message="Dieser Button hat momentan keine Funktion! Wenns Probleme gibt geb einfach bescheid oder so."
                  buttons={[{ label: 'OK', onClick: () => {} }]}
                  canCancel={true}
                  isError={true}
                  onClose={() => setShowInfo(0)}
                />
              )}
            </li>

          </ul>
        </div>
      </section>

      <div className="ticks"></div>
      <section id="spacer"></section>
    </>
  )
}

export default App
