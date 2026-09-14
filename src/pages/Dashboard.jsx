import { useState } from 'react'
import { useEffect } from 'react'

import HamburgerMenu from '../menu/HamburgerMenu'
import OptionModal from '../modals/OptionModal'

import { supabase } from '../supabaseClient'

function Dashboard({ session, onLogout }) {
    const [menuOpen, setMenuOpen] = useState(false)

    const [userdata, setUserdata] = useState(null)
    const [loadingUserdata, setLoadingUserdata] = useState(false)

    const [showInfo, setShowInfo] = useState(0)
    const [info, setInfo] = useState("")

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
                    // console.log('Fehler [', error.code, '] beim Abrufen der Benutzerdaten:', error.message)

                    if (error.code === 'PGRST116') { // Kein Eintrag gefunden
                        createUserRecord()
                    }
                    else {
                        console.error('Fehler [', error.code, '] beim Abrufen der Benutzerdaten:', error.message)
                        setInfo('Fehler [' + error.code + '] beim Abrufen der Benutzerdaten: ' + error.message)
                        setShowInfo(-1)
                    }
                } else {
                    setUserdata(data)
                }
            })
    }

    function createUserRecord() {
        supabase
            .from('USERS')
            .insert([{ login_mail: session.user.email, name: session.user.email}])
            .select()
            .single()
            .then(({ data, error }) => {
                setLoadingUserdata(false)
                if (error) {
                    console.error('Fehler [', error.code, '] beim Anlegen eines neuen Nutzers:', error.message)
                    setInfo('Fehler [' + error.code + '] beim Anlegen eines neuen Nutzers: ' + error.message)
                    setShowInfo(-1)
                } else {
                    setUserdata(data)
                }
            })
    }

    const menuOptions = [
        { icon: './icons/person.png', label: 'Profil [Bald]', onClick: () => wipClick('Profil') },
        {
            icon: './icons/hantel.png',
            label: 'Workouts',
            onClick: () => { },
            children: [
                { icon: './icons/plus-symbol.png', label: 'Neues Workout', onClick: () => wipClick('Neues Workout') },
                { icon: './icons/history.png', label: 'Historie [Bald]', onClick: () => wipClick('Historie') },
                { icon: './icons/bar-graph.png', label: 'Statistik [Bald]', onClick: () => wipClick('Statistik') },
            ],
        },
    ]
    function wipClick(menuItemName) {
        setInfo(menuItemName)
        setShowInfo(1)
    }

    async function handleLogout() {
        await supabase.auth.signOut()
        setMenuOpen(false)
        onLogout && onLogout()
    }
    
    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <button onClick={() => {
                    if(!loadingUserdata) setMenuOpen(true)
                }} style={styles.hamburgerButton} aria-label="Menü öffnen">
                    <span style={styles.bar} />
                    <span style={styles.bar} />
                    <span style={styles.bar} />
                </button>

                <h1 style={styles.welcome}>
                    Willkommen{userdata != null ? `, ${userdata['vorname']} ${userdata['name']}` : ''}
                </h1>
            </div>

            <HamburgerMenu
                options={menuOptions}
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                onLogout={handleLogout}
                userEmail={session?.user?.email}
            />

            {showInfo === -1 && (
                <OptionModal
                    title="Datenbankfehler"
                    message={info}
                    buttons={[{
                        label: 'Erneut versuchen',
                        onClick: () => {
                            fetchUserData()
                        }
                    },
                    {
                        label: 'Zurück zum Login'
                        // onClick: () => App.changeView('login')
                    }
                    ]}
                    isError={true}
                    canCancel={false}
                    onClose={() => setShowInfo(0)}
                />
            )}
            {showInfo === 1 && (
                <OptionModal
                    title="Bald verfügbar"
                    message={"Der Bereich \"" + info + "\" ist iwann bald verfügbar."}
                    buttons={[{
                        label: 'Okay'
                    }]}
                    isError={false}
                    canCancel={true}
                    onClose={() => setShowInfo(0)}
                />
            )}
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