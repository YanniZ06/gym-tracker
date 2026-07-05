import { useState } from 'react'
import HamburgerMenu from '../menu/HamburgerMenu'
import { supabase } from '../supabaseClient'

function Dashboard({ session, onLogout }) {
    const [menuOpen, setMenuOpen] = useState(false)

    const menuOptions = [
        { icon: './icons/person.png', label: 'Profil', onClick: () => console.log('Profil geöffnet') },
        {
            icon: './icons/hantel.png',
            label: 'Workouts',
            onClick: () => { },
            children: [
                { icon: './icons/plus-symbol.png', label: 'Neues Workout', onClick: () => console.log('Neues Workout') },
                { icon: './icons/history.png', label: 'Historie', onClick: () => console.log('Historie') },
                { icon: './icons/bar-graph.png', label: 'Statistik', onClick: () => console.log('Statistik') },
            ],
        },
    ]

    async function handleLogout() {
        await supabase.auth.signOut()
        setMenuOpen(false)
        onLogout && onLogout()
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <button onClick={() => setMenuOpen(true)} style={styles.hamburgerButton} aria-label="Menü öffnen">
                    <span style={styles.bar} />
                    <span style={styles.bar} />
                    <span style={styles.bar} />
                </button>

                <h1 style={styles.welcome}>
                    Willkommen{session?.user?.email ? `, ${session.user.email.split('@')[0]}` : ''}
                </h1>
            </div>

            <HamburgerMenu
                options={menuOptions}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onLogout={handleLogout}
                userEmail={session?.user?.email}
            />

            {/* Restlicher Dashboard-Inhalt kommt hier hin */}
        </div>
    )
}

const styles = {
    page: {
        minHeight: '100vh',
        backgroundColor: '#110e22',
        color: '#f3f3f3',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '20px 24px',
        borderBottom: '1px solid #7349c5',
    },
    hamburgerButton: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: '4px',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '6px',
    },
    bar: {
        width: '22px',
        height: '2px',
        backgroundColor: '#f3f3f3',
        borderRadius: '999px',
    },
    welcome: {
        fontSize: '1.4rem',
        margin: 0,
    },
}

export default Dashboard