import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import OptionModal from '../../modals/OptionModal'
import ExercisePicker from './ExercisePicker'
import SetEntryView from './SetEntryView'

function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })
}

function currentExerciseKey(workoutId) {
    return `wo_${workoutId}_current_exercise_id`
}

function WorkoutView({ session, userdata, workoutId, onExit }) {
    const [workout, setWorkout] = useState(null)
    const [title, setTitle] = useState('')
    const [loading, setLoading] = useState(true)

    const [pickingExercise, setPickingExercise] = useState(false)
    const [currentExercise, setCurrentExercise] = useState(null)

    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')
    const [retryAction, setRetryAction] = useState(null)

    useEffect(() => {
        loadWorkout()
        restoreCurrentExercise()
    }, [workoutId])

    function loadWorkout() {
        if (!workoutId) return
        setLoading(true)

        supabase
            .from('WORKOUTS')
            .select('*')
            .eq('id', workoutId)
            .single()
            .then(({ data, error }) => {
                setLoading(false)
                if (error) {
                    handleDbError(error, 'Laden des Workouts', loadWorkout)
                } else {
                    setWorkout(data)
                    setTitle(data.title || '')
                }
            })
    }

    function restoreCurrentExercise() {
        if (!workoutId) return
        const storedId = localStorage.getItem(currentExerciseKey(workoutId))
        if (!storedId) return

        supabase
            .from('EXERCISES')
            .select('*')
            .eq('id', parseInt(storedId, 10))
            .single()
            .then(({ data, error }) => {
                if (!error && data) {
                    setCurrentExercise(data)
                }
            })
    }

    function handleSelectExercise(exercise) {
        setCurrentExercise(exercise)
        setPickingExercise(false)
        localStorage.setItem(currentExerciseKey(workoutId), exercise.id.toString())
    }

    function handleDbError(error, actionLabel, retryFn) {
        console.error(`Fehler [${error.code}] beim ${actionLabel}:`, error.message)
        setErrorMessage(`Fehler [${error.code}] beim ${actionLabel}: ${error.message}`)
        setRetryAction(() => retryFn)
        setShowError(true)
    }

    function handleTitleBlur() {
        const trimmed = title.trim()
        if (trimmed === (workout?.title || '')) return
        saveTitle(trimmed)
    }

    function saveTitle(trimmed) {
        supabase
            .from('WORKOUTS')
            .update({ title: trimmed })
            .eq('id', workoutId)
            .then(({ error }) => {
                if (error) {
                    handleDbError(error, 'Speichern des Titels', () => saveTitle(trimmed))
                } else {
                    setWorkout((prev) => ({ ...prev, title: trimmed }))
                }
            })
    }

    return (
        <div style={styles.page}>
            <div style={styles.header}>
                <button onClick={onExit} style={styles.backButton} aria-label="Zurück zum Dashboard">
                    ‹
                </button>

                <input
                    type="text"
                    className="workout-title-input"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onBlur={handleTitleBlur}
                    placeholder="Workout-Titel"
                    style={styles.titleInput}
                    disabled={loading}
                />

                <span style={styles.date}>
                    {workout ? formatDate(workout.date) : ''}
                </span>
            </div>

            <div style={styles.divider} />

            {currentExercise ? (
                <SetEntryView
                    workoutId={workoutId}
                    userdata={userdata}
                    exercise={currentExercise}
                    onChangeExercise={() => {
                        setCurrentExercise(null)
                        setPickingExercise(true)
                    }}
                />
            ) : (
                <section style={styles.promptSection}>
                    <h2 style={styles.promptTitle}>Los geht's</h2>
                    <p style={styles.promptText}>
                        Wähle deine erste Übung, um mit dem Tracken zu beginnen.
                    </p>

                    <button style={styles.primaryButton} onClick={() => setPickingExercise(true)}>
                        Übung auswählen
                    </button>
                </section>
            )}

            {pickingExercise && (
                <ExercisePicker
                    onSelectExercise={handleSelectExercise}
                    onClose={() => setPickingExercise(false)}
                />
            )}

            {showError && (
                <OptionModal
                    title="Datenbankfehler"
                    message={errorMessage}
                    buttons={[
                        {
                            label: 'Erneut versuchen',
                            onClick: () => {
                                if (retryAction) retryAction()
                            }
                        },
                        {
                            label: 'Schließen',
                            onClick: () => { }
                        }
                    ]}
                    isError={true}
                    canCancel={false}
                    onClose={() => setShowError(false)}
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
        overflowX: 'hidden',
        maxWidth: '100vw',
        boxSizing: 'border-box',
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(8px, 2.5vw, 12px)',
        padding: 'clamp(14px, 4vw, 20px) clamp(16px, 5vw, 24px)',
        borderBottom: '1px solid #7349c5',
        boxSizing: 'border-box',
    },
    backButton: {
        background: 'none',
        border: '1px solid #7349c5',
        borderRadius: '8px',
        color: '#f3f3f3',
        width: '32px',
        height: '32px',
        flexShrink: 0,
        fontSize: '1.2rem',
        lineHeight: 1,
        cursor: 'pointer',
    },
    titleInput: {
        flex: 1,
        minWidth: 0,
        background: 'rgba(115, 73, 197, 0.12)',
        border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px',
        color: '#f3f3f3',
        fontSize: 'clamp(1.05rem, 5vw, 1.4rem)',
        fontWeight: 500,
        padding: 'clamp(4px, 1.5vw, 6px) clamp(8px, 3vw, 12px)',
        outline: 'none',
        boxSizing: 'border-box',
        transition: 'background-color 0.2s ease, border-color 0.2s ease',
    },
    date: {
        color: '#88838d',
        fontSize: 'clamp(0.68rem, 2.8vw, 0.85rem)',
        flexShrink: 0,
        whiteSpace: 'nowrap',
    },
    divider: {
        height: '1px',
        backgroundColor: '#7349c5',
        opacity: 0.4,
    },
    promptSection: {
        padding: '32px 24px',
        textAlign: 'center',
    },
    promptTitle: {
        fontSize: '1.2rem',
        marginBottom: '8px',
    },
    promptText: {
        color: '#88838d',
        fontSize: '0.95rem',
        marginBottom: '24px',
    },
    primaryButton: {
        backgroundColor: '#7349c5',
        color: '#f3f3f3',
        border: 'none',
        borderRadius: '8px',
        padding: '12px 24px',
        fontSize: '1rem',
        cursor: 'pointer',
    },
}

export default WorkoutView