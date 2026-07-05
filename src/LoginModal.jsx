import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

function LoginModal({ onClose, onSuccess }) {
    const [cooldown, setCooldown] = useState(0) // Sperrungscooldown
    const [failedAttempts, setFailedAttempts] = useState(0)


    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const [closing, setClosing] = useState(false)
    const [shakeKey, setShakeKey] = useState(0) // force neustart

    const COOLDOWN_KEY = 'login_cooldown_until'
    const ATTEMPTS_KEY = 'login_failed_attempts'

    function handleClose() {
        setClosing(true)
        setTimeout(() => {
        onClose()
        }, 250)
    }

    function startCooldown(seconds) {
        const until = Date.now() + seconds * 1000
        localStorage.setItem(COOLDOWN_KEY, until.toString())
        runCooldownTimer(until)
    }

    function runCooldownTimer(until) {
        const update = () => {
            const remaining = Math.ceil((until - Date.now()) / 1000)
            if (remaining <= 0) {
                setCooldown(0)
                localStorage.removeItem(COOLDOWN_KEY)
            } else {
                setCooldown(remaining)
            }
        }

        update() // sofort einmal ausführen, nicht erst nach 1 Sekunde
        const interval = setInterval(() => {
            update()
            if (Date.now() >= until) clearInterval(interval)
        }, 1000)
    }

    useEffect(() => {
        const stored = localStorage.getItem(COOLDOWN_KEY)
        if (stored) {
            const until = parseInt(stored, 10)
            if (until > Date.now()) {
                runCooldownTimer(until)
            } else {
                localStorage.removeItem(COOLDOWN_KEY)
            }
        }

        const storedAttempts = localStorage.getItem(ATTEMPTS_KEY)
        if (storedAttempts) {
            setFailedAttempts(parseInt(storedAttempts, 10))
        }
    }, [])


    async function handleLogin(e) {
        e.preventDefault()
        setError('')
        setLoading(true)

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        setLoading(false)

        if (error) {
            if (error.status === 429) {
                setError('Server-Seitig: Zu viele Versuche. Bitte kurz warten.')
                startCooldown(15)
            } else if (error.message === 'Invalid login credentials') {
                setError('Login fehlgeschlagen. E-Mail oder Passwort falsch.')
            } else {
                setError('Login fehlgeschlagen. ' + error.message)
            }
            
            setShakeKey((prev) => prev + 1)

            const newCount = failedAttempts + 1
            setFailedAttempts(newCount)
            localStorage.setItem(ATTEMPTS_KEY, newCount.toString())

            if (failedAttempts >= 3) {
                startCooldown(5 * (failedAttempts - 2)) // will hier kein bruteforce avoiden, einfach umgehen dass man zu viele requests schickt
            }
        } else {
            // setFailedAttempts(0)
            localStorage.removeItem(ATTEMPTS_KEY)
            onSuccess(data)
            handleClose()
        }
    }

    return (
        <div
            style={{ ...styles.overlay, animation: `${closing ? 'fadeOutOverlay' : 'fadeInOverlay'} 0.25s ease forwards` }}
            onClick={handleClose}
        >
        <style>{`
            @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
            @keyframes fadeOutOverlay { from { opacity: 1; } to { opacity: 0; } }
            @keyframes fadeInModal { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            @keyframes fadeOutModal { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }

            @keyframes errorShake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-8px); }
            40% { transform: translateX(7px); }
            60% { transform: translateX(-5px); }
            80% { transform: translateX(4px); }
            }
            @keyframes errorFlash {
            0% { background-color: #110e22; border-color: #7349c5; }
            25% { background-color: #3a1620; border-color: #e05a5a; }
            100% { background-color: #110e22; border-color: #7349c5; }
            }
        `}</style>

        <div
            key={shakeKey}
            style={{
            ...styles.modal,
            animation: closing
                ? 'fadeOutModal 0.25s ease forwards'
                : shakeKey > 0
                ? 'fadeInModal 0.25s ease forwards, errorShake 0.4s ease, errorFlash 0.6s ease'
                : 'fadeInModal 0.25s ease forwards',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <h2 style={styles.title}>Login</h2>

            <form onSubmit={handleLogin} style={styles.form}>
            <input
                type="email"
                placeholder="E-Mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                required
            />
            <input
                type="password"
                placeholder="Passwort"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
            />

            {error && <p style={styles.error}>{error}</p>}

            <button type="submit" style={styles.button} disabled={loading || cooldown > 0}>
                {loading ? 'Wird geprüft...' : cooldown > 0 ? `Zu viele Fehlversuche (${cooldown}s)` : 'Einloggen'}
            </button>
            </form>

            <button onClick={handleClose} style={styles.closeButton}>
            Abbrechen
            </button>
        </div>
        </div>
    )
    }

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#110e22',
    border: '1px solid #7349c5',
    borderRadius: '10px',
    padding: '2rem',
    width: '300px',
    boxShadow: '0 0 20px rgba(115, 73, 197, 0.3)',
  },
  title: {
    color: '#f3f3f3',
    marginTop: 0,
    marginBottom: '1.5rem',
    fontSize: '1.4rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  input: {
    backgroundColor: 'transparent',
    border: '1px solid #7349c5',
    borderRadius: '6px',
    padding: '10px',
    color: '#f3f3f3',
    fontSize: '0.95rem',
    outline: 'none',
  },
  button: {
    backgroundColor: '#7349c5',
    color: '#f3f3f3',
    border: 'none',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '6px',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: '#88838d',
    fontSize: '0.85rem',
    marginTop: '12px',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'center',
  },
  error: {
    color: '#e57373',
    fontSize: '0.85rem',
    margin: 0,
  },
}

export default LoginModal