import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import OptionModal from '../../modals/OptionModal'

function getSessionKey(headId, suffix) {
    return `wo_${headId}_${suffix}`
}

function formatTimeForDb(date) {
    // Postgres "time without time zone" -> "HH:MM:SS"
    return date.toTimeString().split(' ')[0]
}

function formatElapsed(ms) {
    const totalSeconds = Math.floor(ms / 1000)
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const s = (totalSeconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
}

async function getOrCreateConstantCounter(userId, exerciseId) {
    const { data, error } = await supabase
        .from('CONSTANT_USER_EXERCISE_COUNTER')
        .select('*')
        .eq('user', userId)
        .eq('exercise', exerciseId)
        .maybeSingle()

    if (error) throw error

    if (data) {
        const newValue = data.counter + 1
        const { error: updateError } = await supabase
            .from('CONSTANT_USER_EXERCISE_COUNTER')
            .update({ counter: newValue })
            .eq('id', data.id)
        if (updateError) throw updateError
        return newValue
    } else {
        const { error: insertError } = await supabase
            .from('CONSTANT_USER_EXERCISE_COUNTER')
            .insert([{ user: userId, exercise: exerciseId, counter: 1 }])
        if (insertError) throw insertError
        return 1
    }
}

function SetEntryView({ workoutId, userdata, exercise, onChangeExercise }) {
    const [sets, setSets] = useState([])
    const [loadingSets, setLoadingSets] = useState(true)

    const [reps, setReps] = useState('')
    const [weight, setWeight] = useState('')
    const [comment, setComment] = useState('')
    const [quality, setQuality] = useState(-1) // -1 = keine Angabe

    const [liveMode, setLiveMode] = useState(false)
    const [liveRunning, setLiveRunning] = useState(false)
    const [liveStart, setLiveStart] = useState(null) // Date
    const [liveEnd, setLiveEnd] = useState(null) // Date
    const [nowTick, setNowTick] = useState(Date.now())
    const tickRef = useRef(null)

    const [saving, setSaving] = useState(false)

    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        loadSets()
        // Bei Wechsel der Übung Eingabefelder zurücksetzen
        setReps('')
        setComment('')
        setQuality(-1)
        setLiveMode(false)
        setLiveRunning(false)
        setLiveStart(null)
        setLiveEnd(null)
    }, [exercise?.id])

    useEffect(() => {
        if (liveRunning) {
            tickRef.current = setInterval(() => setNowTick(Date.now()), 1000)
        } else if (tickRef.current) {
            clearInterval(tickRef.current)
        }
        return () => {
            if (tickRef.current) clearInterval(tickRef.current)
        }
    }, [liveRunning])

    function loadSets() {
        setLoadingSets(true)
        supabase
            .from('WORKOUT_DATA')
            .select('*')
            .eq('head', workoutId)
            .eq('exercise_id', exercise.id)
            .order('set', { ascending: true })
            .then(({ data, error }) => {
                setLoadingSets(false)
                if (error) {
                    handleError(error, 'Laden der bisherigen Sätze')
                } else {
                    setSets(data)
                    // Gewichtsvorschlag: letzter genutzter Wert, sonst beginner_weight der Übung
                    if (data.length > 0) {
                        setWeight(data[data.length - 1].set_weight ?? '')
                    } else if (exercise.beginner_weight != null) {
                        setWeight(exercise.beginner_weight.toString())
                    }
                }
            })
    }

    function handleError(error, actionLabel) {
        console.error(`Fehler [${error.code || '?'}] beim ${actionLabel}:`, error.message)
        setErrorMessage(`Fehler beim ${actionLabel}: ${error.message}`)
        setShowError(true)
    }

    function handleStartLive() {
        setLiveStart(new Date())
        setLiveEnd(null)
        setLiveRunning(true)
        setNowTick(Date.now())
    }

    function handleEndLive() {
        setLiveEnd(new Date())
        setLiveRunning(false)
    }

    async function handleSaveSet() {
        if (saving) return
        if (!reps || Number(reps) <= 0) {
            setErrorMessage('Bitte gib eine gültige Wiederholungszahl ein.')
            setShowError(true)
            return
        }

        setSaving(true)

        try {
            // 1. exercise_counter: erhöht sich, wenn sich die Übung ggü. dem letzten Satz der Session ändert
            const lastExerciseKey = getSessionKey(workoutId, 'last_exercise')
            const exerciseCounterKey = getSessionKey(workoutId, 'exercise_counter')

            const lastExerciseId = localStorage.getItem(lastExerciseKey)
            let exerciseCounter = parseInt(localStorage.getItem(exerciseCounterKey) || '0', 10)

            if (lastExerciseId === null || parseInt(lastExerciseId, 10) !== exercise.id) {
                exerciseCounter += 1
                localStorage.setItem(exerciseCounterKey, exerciseCounter.toString())
                localStorage.setItem(lastExerciseKey, exercise.id.toString())
            }

            // 2. constant_user_exercise_id_counter nur beim ersten Satz dieser Übung in dieser Session
            const countedKey = getSessionKey(workoutId, 'counted_exercises')
            const countedExercises = JSON.parse(localStorage.getItem(countedKey) || '[]')

            let constantCounterValue = null
            if (!countedExercises.includes(exercise.id)) {
                constantCounterValue = await getOrCreateConstantCounter(userdata.id, exercise.id)
                countedExercises.push(exercise.id)
                localStorage.setItem(countedKey, JSON.stringify(countedExercises))
            }

            // 3. Falls Live-Modus: rest_time des vorherigen Live-Satzes dieser Übung nachtragen
            if (liveMode && liveStart && sets.length > 0) {
                const prevSet = [...sets].reverse().find((s) => s.live_entry && s.end_time && s.rest_time == null)
                if (prevSet) {
                    const prevEndDate = new Date()
                    const [h, m, s2] = prevSet.end_time.split(':').map(Number)
                    prevEndDate.setHours(h, m, s2, 0)
                    const restSeconds = Math.max(0, Math.round((liveStart.getTime() - prevEndDate.getTime()) / 1000))

                    await supabase
                        .from('WORKOUT_DATA')
                        .update({ rest_time: restSeconds })
                        .eq('id', prevSet.id)
                }
            }

            // 4. Neuen Satz einfügen
            const setNumber = sets.length + 1

            const payload = {
                created_at: new Date().toISOString(),
                head: workoutId,
                owner: userdata.id,
                exercise_id: exercise.id,
                set: setNumber,
                reps: Number(reps),
                set_weight: weight === '' ? null : Number(weight),
                exercise_counter: exerciseCounter,
                constant_user_exercise_id_counter: constantCounterValue,
                type_wo: 1,
                comment: comment.trim() || null,
                quality: quality === -1 ? null : quality,
                live_entry: liveMode,
                start_time: liveMode && liveStart ? formatTimeForDb(liveStart) : null,
                end_time: liveMode && liveEnd ? formatTimeForDb(liveEnd) : null,
                rest_time: null,
            }

            const { data: newSet, error: insertError } = await supabase
                .from('WORKOUT_DATA')
                .insert([payload])
                .select()
                .single()

            if (insertError) throw insertError

            setSets((prev) => [...prev, newSet])
            setReps('')
            setComment('')
            setQuality(-1)
            setLiveStart(null)
            setLiveEnd(null)
        } catch (err) {
            handleError(err, 'Speichern des Satzes')
        } finally {
            setSaving(false)
        }
    }

    async function handleDeleteSet(setId) {
        const { error } = await supabase.from('WORKOUT_DATA').delete().eq('id', setId)
        if (error) {
            handleError(error, 'Löschen des Satzes')
        } else {
            setSets((prev) => prev.filter((s) => s.id !== setId))
        }
    }

    const liveElapsed = liveRunning && liveStart ? nowTick - liveStart.getTime() : liveEnd && liveStart ? liveEnd.getTime() - liveStart.getTime() : 0

    return (
        <div style={styles.wrapper}>
            <div style={styles.exerciseHeader}>
                <div>
                    <h2 style={styles.exerciseName}>{exercise.name}</h2>
                    <span style={styles.exerciseMeta}>Satz {sets.length + 1}</span>
                </div>
                <button onClick={onChangeExercise} style={styles.changeButton}>
                    Übung wechseln
                </button>
            </div>

            {sets.length > 0 && (
                <div style={styles.setList}>
                    {sets.map((s) => (
                        <div key={s.id} style={styles.setRow}>
                            <span style={styles.setRowText}>
                                #{s.set} · {s.reps} Wdh. {s.set_weight != null ? `× ${s.set_weight}kg` : ''}
                                {s.live_entry && s.rest_time != null ? ` · Pause ${s.rest_time}s` : ''}
                            </span>
                            <button onClick={() => handleDeleteSet(s.id)} style={styles.deleteButton} aria-label="Satz löschen">
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div style={styles.form}>
                <label style={styles.toggleRow} onClick={() => setLiveMode((v) => !v)}>
                    <div style={{ ...styles.toggleTrack, backgroundColor: liveMode ? '#7349c5' : 'transparent' }}>
                        <div style={{ ...styles.toggleThumb, transform: liveMode ? 'translateX(16px)' : 'translateX(0)' }} />
                    </div>
                    <span style={styles.toggleLabel}>Satz live timen</span>
                </label>

                {liveMode && (
                    <div style={styles.liveBox}>
                        <span style={styles.liveTimer}>{formatElapsed(liveElapsed)}</span>
                        {!liveRunning && !liveEnd && (
                            <button onClick={handleStartLive} style={styles.liveButton}>Satz starten</button>
                        )}
                        {liveRunning && (
                            <button onClick={handleEndLive} style={{ ...styles.liveButton, backgroundColor: '#c95a5a' }}>Satz beenden</button>
                        )}
                        {liveEnd && !liveRunning && (
                            <button onClick={handleStartLive} style={styles.liveButtonSecondary}>Neu starten</button>
                        )}
                    </div>
                )}

                <div style={styles.inputRow}>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Wiederholungen</label>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                    <div style={styles.inputGroup}>
                        <label style={styles.label}>Gewicht (kg)</label>
                        <input
                            type="number"
                            inputMode="decimal"
                            step="0.5"
                            value={weight}
                            onChange={(e) => setWeight(e.target.value)}
                            style={styles.input}
                        />
                    </div>
                </div>

                <label style={styles.label}>Qualität (optional)</label>
                <div style={styles.qualityRow}>
                    <button
                        onClick={() => setQuality(-1)}
                        style={{ ...styles.qualityChip, backgroundColor: quality === -1 ? '#7349c5' : 'transparent' }}
                    >
                        —
                    </button>
                    {Array.from({ length: 11 }, (_, i) => i).map((v) => (
                        <button
                            key={v}
                            onClick={() => setQuality(v)}
                            style={{ ...styles.qualityChip, backgroundColor: quality === v ? '#7349c5' : 'transparent' }}
                        >
                            {v}
                        </button>
                    ))}
                </div>

                <label style={styles.label}>Kommentar (optional)</label>
                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    style={styles.textarea}
                    rows={2}
                />

                <button onClick={handleSaveSet} style={styles.saveButton} disabled={saving}>
                    {saving ? 'Speichert...' : 'Satz speichern'}
                </button>
            </div>

            {showError && (
                <OptionModal
                    title="Fehler"
                    message={errorMessage}
                    buttons={[{ label: 'Okay', onClick: () => { } }]}
                    isError={true}
                    canCancel={true}
                    onClose={() => setShowError(false)}
                />
            )}
        </div>
    )
}

const styles = {
    wrapper: { padding: '24px' },
    exerciseHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '20px',
    },
    exerciseName: { fontSize: '1.3rem', margin: 0 },
    exerciseMeta: { color: '#88838d', fontSize: '0.85rem' },
    changeButton: {
        background: 'transparent', border: '1px solid #7349c5', color: '#f3f3f3',
        borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
    },
    setList: { marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' },
    setRow: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: 'rgba(115, 73, 197, 0.1)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '8px 12px',
    },
    setRowText: { fontSize: '0.85rem', color: '#f3f3f3' },
    deleteButton: {
        background: 'none', border: 'none', color: '#88838d', fontSize: '1.1rem',
        cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
    },
    form: { display: 'flex', flexDirection: 'column', gap: '10px' },
    toggleRow: { display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' },
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
    liveBox: {
        display: 'flex', alignItems: 'center', gap: '12px',
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid #7349c5',
        borderRadius: '10px', padding: '12px',
    },
    liveTimer: { fontSize: '1.4rem', fontVariantNumeric: 'tabular-nums', flex: 1 },
    liveButton: {
        backgroundColor: '#7349c5', color: '#f3f3f3', border: 'none',
        borderRadius: '6px', padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer',
    },
    liveButtonSecondary: {
        backgroundColor: 'transparent', color: '#f3f3f3', border: '1px solid #7349c5',
        borderRadius: '6px', padding: '8px 14px', fontSize: '0.85rem', cursor: 'pointer',
    },
    inputRow: { display: 'flex', gap: '10px' },
    inputGroup: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
    label: { color: '#88838d', fontSize: '0.8rem' },
    input: {
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '10px', color: '#f3f3f3', fontSize: '0.95rem', outline: 'none',
    },
    qualityRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    qualityChip: {
        width: '32px', height: '32px', borderRadius: '8px',
        border: '1px solid #7349c5', color: '#f3f3f3', fontSize: '0.8rem', cursor: 'pointer',
    },
    textarea: {
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '10px', color: '#f3f3f3', fontSize: '0.9rem', outline: 'none',
        resize: 'vertical', fontFamily: 'inherit',
    },
    saveButton: {
        backgroundColor: '#7349c5', color: '#f3f3f3', border: 'none',
        borderRadius: '8px', padding: '12px', fontSize: '1rem', cursor: 'pointer', marginTop: '6px',
    },
}

export default SetEntryView