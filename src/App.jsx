import { useState } from 'react'
import maggus from './assets/markus_low.png'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

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
              <a href="https://vite.dev/" target="_blank" className="btn_login">
                Login
              </a>
            </li>
          </ul>
        </div>
        <div id="setpass">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Passwort setzen</h2>
          <p>Setz dein eigenes privates Passwort für deinen Account</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank" className="btn_setpass">
                Zur Passwort Setzung
              </a>
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
