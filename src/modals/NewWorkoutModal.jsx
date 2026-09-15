import { useState, useEffect } from 'react'

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag']

function toDateInputValue(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getWeekdayTitle(dateStr) {
    const d = new Date(dateStr + 'T00:00:00')
    return `${WEEKDAYS[d.getDay()]}'s Workout`
}

function NewWorkoutModal({ onClose, onConfirm }) {
    const today = toDateInputValue(new Date())

    const [selectedDate, setSelectedDate] = useState(today)
    const [otherDay, setOtherDay] = useState(false)
    const [title, setTitle] = useState(getWeekdayTitle(today))
    const [titleTouched, setTitleTouched] = useState(false)
    const [closing, setClosing] = useState(false)
    const [creating, setCreating] = useState(false)

    useEffect(() => {
        if (!titleTouched) {
            setTitle(getWeekdayTitle(selectedDate))
        }
    }, [selectedDate])

    function handleClose() {
        setClosing(true)
        setTimeout(onClose, 250)
    }

    function handleToggleOtherDay() {
        const next = !otherDay
        setOtherDay(next)
        if (!next) {
            setSelectedDate(today) // zurück auf heute, falls Toggle wieder ausgeschaltet wird
        }
    }

    function handleConfirm() {
        if (creating) return
        setCreating(true)
        onConfirm({
            title: title.trim() || getWeekdayTitle(selectedDate),
            date: otherDay ? selectedDate : today,
        })
    }

    function handleOverlayClick() {
        // bewusst leer - Modal soll sich nicht per Außenklick schließen lassen
    }


    return (
        <div
            style={{ ...styles.overlay, animation: `${closing ? 'fadeOutOverlay' : 'fadeInOverlay'} 0.25s ease forwards` }}
            onClick={handleOverlayClick}
        >
            <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOutOverlay { from { opacity: 1; } to { opacity: 0; } }
        @keyframes fadeInModal { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeOutModal { from { opacity: 1; transform: scale(1); } to { opacity: 0; transform: scale(0.95); } }
      `}</style>

            <div
                style={{ ...styles.modal, animation: `${closing ? 'fadeOutModal' : 'fadeInModal'} 0.25s ease forwards` }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 style={styles.title}>Neues Workout</h2>

                <label style={styles.label}>Titel</label>
                <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                        setTitle(e.target.value)
                        setTitleTouched(true)
                    }}
                    style={styles.input}
                />

                <div style={styles.toggleRow} onClick={handleToggleOtherDay}>
                    <div style={{ ...styles.toggleTrack, backgroundColor: otherDay ? '#7349c5' : 'transparent' }}>
                        <div style={{ ...styles.toggleThumb, transform: otherDay ? 'translateX(16px)' : 'translateX(0)' }} />
                    </div>
                    <span style={styles.toggleLabel}>Für einen anderen Tag erfassen</span>
                </div>

                {otherDay && (
                    <>
                        <p style={styles.warning}>
                            Diese Funktion ist nicht dafür gedacht, alte Workouts nachträglich vollständig zu digitalisieren –
                            nutz sie nur, um kurz vergessene Einträge von einem der letzten Tage nachzutragen.
                        </p>
                        <input
                            type="date"
                            value={selectedDate}
                            max={today}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            style={styles.input}
                        />
                    </>
                )}

                <div style={styles.buttonRow}>
                    <button onClick={handleConfirm} style={styles.primaryButton} disabled={creating}>
                        {creating ? 'Wird erstellt...' : 'Workout starten'}
                    </button>
                    <button onClick={handleClose} style={styles.secondaryButton}>
                        Abbrechen
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    },
    modal: {
        backgroundColor: '#110e22',
        border: '1px solid #7349c5',
        borderRadius: '10px',
        padding: '2rem',
        width: '320px',
        boxShadow: '0 0 20px rgba(115, 73, 197, 0.3)',
    },
    title: { color: '#f3f3f3', marginTop: 0, marginBottom: '1.2rem', fontSize: '1.3rem' },
    label: { color: '#88838d', fontSize: '0.8rem', marginBottom: '4px', display: 'block' },
    input: {
        backgroundColor: 'transparent',
        border: '1px solid #7349c5',
        borderRadius: '6px',
        padding: '10px',
        color: '#f3f3f3',
        fontSize: '0.95rem',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        marginBottom: '14px',
    },
    toggleRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
        cursor: 'pointer', marginBottom: '10px',
    },
    toggleTrack: {
        width: '36px', height: '20px', borderRadius: '999px',
        border: '1px solid #7349c5', position: 'relative', transition: 'background-color 0.2s ease',
    },
    toggleThumb: {
        width: '14px', height: '14px', borderRadius: '50%',
        backgroundColor: '#f3f3f3', position: 'absolute', top: '2px', left: '2px',
        transition: 'transform 0.2s ease',
    },
    toggleLabel: { color: '#f3f3f3', fontSize: '0.9rem' },
    warning: {
        color: '#c99a4a', fontSize: '0.8rem', lineHeight: 1.4,
        marginBottom: '10px', marginTop: '4px',
    },
    buttonRow: { display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' },
    primaryButton: {
        backgroundColor: '#7349c5', color: '#f3f3f3', border: 'none',
        borderRadius: '6px', padding: '10px', fontSize: '0.95rem', cursor: 'pointer',
    },
    secondaryButton: {
        backgroundColor: 'transparent', color: '#f3f3f3', border: '1px solid #7349c5',
        borderRadius: '6px', padding: '10px', fontSize: '0.95rem', cursor: 'pointer',
    },
}

export default NewWorkoutModal