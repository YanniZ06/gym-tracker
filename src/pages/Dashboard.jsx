import { useState } from 'react'

import HamburgerMenu from '../menu/HamburgerMenu'
import OptionModal from '../modals/OptionModal'
import NewWorkoutModal from '../modals/NewWorkoutModal'

import { supabase } from '../supabaseClient'

function Dashboard({ session, userdata, setUserdata, fetchUserData, loadingUserdata, onLogout, onStartWorkout }) {
    const [menuOpen, setMenuOpen] = useState(false)

    const [showInfo, setShowInfo] = useState(0)
    const [info, setInfo] = useState("")

    const [checkingActiveWorkout, setCheckingActiveWorkout] = useState(false)
    const [showNewWorkoutModal, setShowNewWorkoutModal] = useState(false)
    const [openWorkout, setOpenWorkout] = useState(null)
    const [showOpenWorkoutModal, setShowOpenWorkoutModal] = useState(false)

    async function handleWorkoutMenuClick() {
        if (!userdata || checkingActiveWorkout) return
        setCheckingActiveWorkout(true)

        if (userdata.prev_wo_session) {
            const { data: lastWorkout, error } = await supabase
                .from('WORKOUTS')
                .select('id, title, finished_at')
                .eq('id', userdata.prev_wo_session)
                .single()

            setCheckingActiveWorkout(false)

            if (error) {
                console.error('Fehler [', error.code, '] beim Prüfen des letzten Workouts:', error.message)
                setInfo('Fehler [' + error.code + '] beim Prüfen des letzten Workouts: ' + error.message)
                setShowInfo(-1)
                return
            }

            if (lastWorkout.finished_at === null) {
                setOpenWorkout(lastWorkout)
                setShowOpenWorkoutModal(true)
                return
            }
        } else {
            setCheckingActiveWorkout(false)
        }

        setMenuOpen(false)
        setShowNewWorkoutModal(true)
    }

    async function handleCreateWorkout({ title, date }) {
        const { data: newWorkout, error: insertError } = await supabase
            .from('WORKOUTS')
            .insert([{
                user: userdata.id,
                previous_wo: userdata.prev_wo_session || null,
                title: title,
                date: date,
            }])
            .select()
            .single()

        if (insertError) {
            setShowNewWorkoutModal(false)
            console.error('Fehler [', insertError.code, '] beim Erstellen des Workouts:', insertError.message)
            setInfo('Fehler [' + insertError.code + '] beim Erstellen des Workouts: ' + insertError.message)
            setShowInfo(-1)
            return
        }

        if (userdata.prev_wo_session) {
            const { error: updatePrevError } = await supabase
                .from('WORKOUTS')
                .update({ next_wo: newWorkout.id })
                .eq('id', userdata.prev_wo_session)

            if (updatePrevError) {
                console.error('Fehler [', updatePrevError.code, '] beim Verketten des vorherigen Workouts:', updatePrevError.message)
                // bewusst kein Abbruch, der neue Workout existiert bereits
            }
        }

        const { data: updatedUser, error: updateUserError } = await supabase
            .from('USERS')
            .update({ prev_wo_session: newWorkout.id })
            .eq('id', userdata.id)
            .select()
            .single()

        if (updateUserError) {
            setShowNewWorkoutModal(false)
            console.error('Fehler [', updateUserError.code, '] beim Aktualisieren des Nutzers:', updateUserError.message)
            setInfo('Fehler [' + updateUserError.code + '] beim Aktualisieren des Nutzers: ' + updateUserError.message)
            setShowInfo(-1)
            return
        }

        setUserdata(updatedUser)
        setShowNewWorkoutModal(false)
        onStartWorkout(newWorkout.id)
    }

    const menuOptions = [
        { icon: './icons/person.png', label: 'Profil [Bald]', onClick: () => wipClick('Profil') },
        {
            icon: './icons/hantel.png',
            label: 'Workouts',
            onClick: () => { },
            children: [
                { icon: './icons/plus-symbol.png', label: 'Neues Workout', onClick: handleWorkoutMenuClick },
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
                    if (!loadingUserdata) setMenuOpen(true)
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

            {showNewWorkoutModal && (
                <NewWorkoutModal
                    onClose={() => setShowNewWorkoutModal(false)}
                    onConfirm={handleCreateWorkout}
                />
            )}

            {showOpenWorkoutModal && (
                <OptionModal
                    title="Offenes Workout gefunden"
                    message={`Du hast noch ein laufendes Workout ("${openWorkout?.title || 'Ohne Titel'}"). Bitte beende es zuerst, bevor du ein neues startest.`}
                    buttons={[{
                        label: 'Zum offenen Workout',
                        onClick: () => onStartWorkout(openWorkout.id)
                    }]}
                    isError={false}
                    canCancel={true}
                    onClose={() => setShowOpenWorkoutModal(false)}
                />
            )}

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
                        label: 'Zurück zum Login',
                        onClick: () => onLogout()
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
    page: { minHeight: '100vh', backgroundColor: '#110e22', color: '#f3f3f3' },
    header: {
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '20px 24px', borderBottom: '1px solid #7349c5',
    },
    hamburgerButton: {
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: '4px', background: 'none', border: 'none', cursor: 'pointer', padding: '6px',
    },
    bar: { width: '22px', height: '2px', backgroundColor: '#f3f3f3', borderRadius: '999px' },
    welcome: { fontSize: '1.4rem', margin: 0 },
}

export default Dashboard