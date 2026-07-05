import { useState } from 'react'
import { supabase } from '../supabaseClient'

import LoginModal from '../modals/LoginModal'
import OptionModal from '../modals/OptionModal'

import maggus from '../assets/markus_low.png'
import styles from './Login.module.css'

function Login({ session, setSession, onLoginSuccess }) {
    const [showLogin, setShowLogin] = useState(false)
    const [showInfo, setShowInfo] = useState(0)

    return (
        <>
            <section className={styles.center}>
                <div>
                    <img src={maggus} className={styles.base} width="170" height="179" alt="" />
                </div>
                <div>
                    <h1>DER Gym Tracker</h1>
                    <p>Beweis mal, dass du es bist</p>
                </div>
            </section>

            <div className={styles.ticks}></div>

            <section className={styles.nextSteps}>
                <div className={styles.login}>
                    <h2>Einloggen</h2>
                    <p>Log dich ein du Schlampe, tue es</p>
                    <ul>
                        <li>
                            {session ? (
                                <a onClick={() => {}} className={styles.btnLogin}>Weiterleitung..</a>
                            ) : (
                                <a onClick={() => setShowLogin(true)} className={styles.btnLogin}>Login</a>
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

                            {showInfo === 2 && (
                                <OptionModal
                                    title="Erfolgreich eingeloggt"
                                    message="Ab geht's"
                                    buttons={[{
                                        label: 'Ok',
                                        onClick: () => {
                                            onLoginSuccess && onLoginSuccess()
                                        }
                                    }]}
                                    canCancel={false}
                                    onClose={() => setShowInfo(0)}
                                />
                            )}
                        </li>
                    </ul>
                </div>

                <div className={styles.setpass}>
                    <h2>Zugriff anfordern</h2>
                    <p>Beantrage Zugriff auf die Seite</p>
                    <ul>
                        <li>
                            <a onClick={() => setShowInfo(1)} className={styles.btnSetpass}>
                                Zugriff anfordern
                            </a>

                            {showInfo === 1 && (
                                <OptionModal
                                    title="Ups!"
                                    message="Dieser Button hat momentan keine Funktion! Wenns Probleme gibt geb einfach bescheid oder so."
                                    buttons={[{ label: 'OK', onClick: () => { } }]}
                                    canCancel={true}
                                    isError={true}
                                    onClose={() => setShowInfo(0)}
                                />
                            )}
                        </li>
                    </ul>
                </div>
            </section>

            <div className={styles.ticks}></div>
            <section className={styles.spacer}></section>
        </>
    )
}

export default Login