import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../supabaseClient'
import OptionModal from '../../modals/OptionModal'

function getSessionKey(headId, suffix) {
    return `wo_${headId}_${suffix}`
}

function formatTimeForDb(date) {
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
    const [quality, setQuality] = useState(-1)
    const [restInput, setRestInput] = useState('')

    const [liveMode, setLiveMode] = useState(false)
    const [liveRunning, setLiveRunning] = useState(false)
    const [liveStart, setLiveStart] = useState(null)
    const [liveEnd, setLiveEnd] = useState(null)
    const [nowTick, setNowTick] = useState(Date.now())
    const tickRef = useRef(null)

    const [editingSet, setEditingSet] = useState(null)
    const [draggingIndex, setDraggingIndex] = useState(null)
    const [dragOverIndex, setDragOverIndex] = useState(null)

    const [saving, setSaving] = useState(false)

    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        loadSets()
        resetFormForNewSet([])
        setEditingSet(null)
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
                    resetFormForNewSet(data)
                }
            })
    }

    function resetFormForNewSet(currentSets) {
        setReps('')
        setComment('')
        setQuality(-1)
        setLiveMode(false)
        setLiveRunning(false)
        setLiveStart(null)
        setLiveEnd(null)

        const lastSet = currentSets.length > 0 ? currentSets[currentSets.length - 1] : null
        setWeight(lastSet ? (lastSet.set_weight ?? '').toString() : (exercise.beginner_weight != null ? exercise.beginner_weight.toString() : ''))
        setRestInput(lastSet && lastSet.rest_time != null ? lastSet.rest_time.toString() : '')
    }

    function handleError(error, actionLabel) {
        console.error(`Fehler [${error?.code || '?'}] beim ${actionLabel}:`, error.message)
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
        const end = new Date()
        setLiveEnd(end)
        setLiveRunning(false)

        // Rest-Vorschlag berechnen, falls es einen vorherigen Live-Satz mit Endzeit gibt
        const lastSet = sets.length > 0 ? sets[sets.length - 1] : null
        if (lastSet && lastSet.live_entry && lastSet.end_time && liveStart) {
            const prevEndDate = new Date()
            const [h, m, s2] = lastSet.end_time.split(':').map(Number)
            prevEndDate.setHours(h, m, s2, 0)
            const restSeconds = Math.max(0, Math.round((liveStart.getTime() - prevEndDate.getTime()) / 1000))
            setRestInput(restSeconds.toString())
        }
    }

    function handleStartEdit(set, idx) {
        setEditingSet(set)
        setReps(set.reps != null ? set.reps.toString() : '')
        setWeight(set.set_weight != null ? set.set_weight.toString() : '')
        setComment(set.comment || '')
        setQuality(set.quality != null ? set.quality : -1)
        setLiveMode(false)
        setLiveRunning(false)

        const prevSet = idx > 0 ? sets[idx - 1] : null
        setRestInput(prevSet && prevSet.rest_time != null ? prevSet.rest_time.toString() : '')
    }

    function handleCancelEdit() {
        setEditingSet(null)
        resetFormForNewSet(sets)
    }

    async function handleSaveNewSet() {
        if (saving) return
        if (!reps || Number(reps) <= 0) {
            setErrorMessage('Bitte gib eine gültige Wiederholungszahl ein.')
            setShowError(true)
            return
        }

        setSaving(true)

        try {
            const lastExerciseKey = getSessionKey(workoutId, 'last_exercise')
            const exerciseCounterKey = getSessionKey(workoutId, 'exercise_counter')

            const lastExerciseId = localStorage.getItem(lastExerciseKey)
            let exerciseCounter = parseInt(localStorage.getItem(exerciseCounterKey) || '0', 10)

            if (lastExerciseId === null || parseInt(lastExerciseId, 10) !== exercise.id) {
                exerciseCounter += 1
                localStorage.setItem(exerciseCounterKey, exerciseCounter.toString())
                localStorage.setItem(lastExerciseKey, exercise.id.toString())
            }

            const countedKey = getSessionKey(workoutId, 'counted_exercises')
            const countedExercises = JSON.parse(localStorage.getItem(countedKey) || '[]')

            let constantCounterValue = null
            if (!countedExercises.includes(exercise.id)) {
                constantCounterValue = await getOrCreateConstantCounter(userdata.id, exercise.id)
                countedExercises.push(exercise.id)
                localStorage.setItem(countedKey, JSON.stringify(countedExercises))
            }

            const lastSet = sets.length > 0 ? sets[sets.length - 1] : null
            if (lastSet && restInput !== '' && Number(restInput) !== lastSet.rest_time) {
                const { error: restError } = await supabase
                    .from('WORKOUT_DATA')
                    .update({ rest_time: Number(restInput) })
                    .eq('id', lastSet.id)
                if (restError) throw restError
            }

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

            const updatedSets = [...sets]
            if (lastSet && restInput !== '') {
                updatedSets[updatedSets.length - 1] = { ...lastSet, rest_time: Number(restInput) }
            }
            updatedSets.push(newSet)

            setSets(updatedSets)
            resetFormForNewSet(updatedSets)
        } catch (err) {
            handleError(err, 'Speichern des Satzes')
        } finally {
            setSaving(false)
        }
    }

    async function handleSaveEdit() {
        if (saving || !editingSet) return
        if (!reps || Number(reps) <= 0) {
            setErrorMessage('Bitte gib eine gültige Wiederholungszahl ein.')
            setShowError(true)
            return
        }

        setSaving(true)

        try {
            const idx = sets.findIndex((s) => s.id === editingSet.id)
            const prevSet = idx > 0 ? sets[idx - 1] : null

            const updates = {
                reps: Number(reps),
                set_weight: weight === '' ? null : Number(weight),
                comment: comment.trim() || null,
                quality: quality === -1 ? null : quality,
            }

            const { error: updateError } = await supabase
                .from('WORKOUT_DATA')
                .update(updates)
                .eq('id', editingSet.id)
            if (updateError) throw updateError

            if (prevSet) {
                const newRest = restInput === '' ? null : Number(restInput)
                if (newRest !== prevSet.rest_time) {
                    const { error: restError } = await supabase
                        .from('WORKOUT_DATA')
                        .update({ rest_time: newRest })
                        .eq('id', prevSet.id)
                    if (restError) throw restError
                }
            }

            const updatedSets = sets.map((s) => {
                if (s.id === editingSet.id) return { ...s, ...updates }
                if (prevSet && s.id === prevSet.id) return { ...s, rest_time: restInput === '' ? null : Number(restInput) }
                return s
            })

            setSets(updatedSets)
            setEditingSet(null)
            resetFormForNewSet(updatedSets)
        } catch (err) {
            handleError(err, 'Speichern der Änderungen')
        } finally {
            setSaving(false)
        }
    }

    async function renumberAndPersist(orderedSets) {
        const renumbered = orderedSets.map((s, i) => ({ ...s, set: i + 1 }))
        const changed = renumbered.filter((s, i) => s.set !== orderedSets[i].set)

        if (changed.length > 0) {
            const { error } = await Promise.all(
                changed.map((s) => supabase.from('WORKOUT_DATA').update({ set: s.set }).eq('id', s.id))
            ).then(() => ({ error: null })).catch((err) => ({ error: err }))

            if (error) {
                handleError(error, 'Aktualisieren der Satz-Reihenfolge')
                return
            }
        }

        setSets(renumbered)
    }

    async function handleDeleteSet(setToDelete) {
        const { error } = await supabase.from('WORKOUT_DATA').delete().eq('id', setToDelete.id)
        if (error) {
            handleError(error, 'Löschen des Satzes')
            return
        }

        const remaining = sets.filter((s) => s.id !== setToDelete.id)
        await renumberAndPersist(remaining)

        if (editingSet?.id === setToDelete.id) {
            setEditingSet(null)
        }
        resetFormForNewSet(remaining.map((s, i) => ({ ...s, set: i + 1 })))
    }

    function handleDragStart(idx) {
        setDraggingIndex(idx)
    }

    function handleDragOver(e, idx) {
        e.preventDefault()
        setDragOverIndex(idx)
    }

    async function handleDrop(idx) {
        if (draggingIndex === null || draggingIndex === idx) {
            setDraggingIndex(null)
            setDragOverIndex(null)
            return
        }

        const reordered = [...sets]
        const [moved] = reordered.splice(draggingIndex, 1)
        reordered.splice(idx, 0, moved)

        setDraggingIndex(null)
        setDragOverIndex(null)
        await renumberAndPersist(reordered)
    }

    const isEditing = editingSet !== null
    const liveElapsed = liveRunning && liveStart ? nowTick - liveStart.getTime() : liveEnd && liveStart ? liveEnd.getTime() - liveStart.getTime() : 0

    const editingIdx = isEditing ? sets.findIndex((s) => s.id === editingSet.id) : -1
    const showRestField = isEditing ? editingIdx > 0 : sets.length > 0

    return (
        <div style={styles.wrapper}>
            <style>{`
        @keyframes rowFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes formFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes chipPop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes liveBoxIn { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 100px; } }

        .set-row { animation: rowFadeIn 0.2s ease; transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease; cursor: grab; }
        .set-row:active { cursor: grabbing; }
        .set-row-editing { background-color: rgba(201, 122, 58, 0.18) !important; border-color: #c97a3a !important; }
        .set-row-dragover { border-color: #8a63d6 !important; }
        .set-delete-btn { transition: color 0.15s ease, transform 0.15s ease; }
        .set-delete-btn:hover { color: #e57373; transform: rotate(90deg); }

        .set-form { animation: formFadeIn 0.2s ease; transition: background-color 0.2s ease, border-color 0.2s ease; }
        .set-form-editing { background-color: rgba(201, 122, 58, 0.08); border: 1px solid #c97a3a; border-radius: 12px; padding: 16px; }

        .big-input { transition: border-color 0.2s ease, background-color 0.2s ease; }
        .big-input:focus { border-color: #7349c5 !important; background-color: rgba(115, 73, 197, 0.2) !important; }

        .quality-chip { transition: background-color 0.15s ease, transform 0.1s ease; }
        .quality-chip:active { animation: chipPop 0.2s ease; }

        .change-exercise-btn, .cancel-edit-btn { transition: background-color 0.2s ease, transform 0.15s ease; }
        .change-exercise-btn:hover, .cancel-edit-btn:hover { background-color: rgba(115, 73, 197, 0.2); }
        .change-exercise-btn:active, .cancel-edit-btn:active { transform: scale(0.95); }

        .save-btn { transition: background-color 0.2s ease, transform 0.1s ease; }
        .save-btn:active { transform: scale(0.98); }
      `}</style>

            <div style={styles.exerciseHeader}>
                <div>
                    <h2 style={{ ...styles.exerciseName, color: isEditing ? '#e8a05f' : '#f3f3f3' }}>
                        {isEditing ? `Bearbeiten von: ${exercise.name} Satz ${editingSet.set}` : exercise.name}
                    </h2>
                    {!isEditing && <span style={styles.exerciseMeta}>Satz {sets.length + 1}</span>}
                </div>
                {isEditing ? (
                    <button onClick={handleCancelEdit} className="cancel-edit-btn" style={styles.changeButton}>
                        Abbrechen
                    </button>
                ) : (
                    <button onClick={onChangeExercise} className="change-exercise-btn" style={styles.changeButton}>
                        Übung wechseln
                    </button>
                )}
            </div>

            {sets.length > 0 && (
                <div style={styles.setList}>
                    {sets.map((s, idx) => (
                        <div
                            key={s.id}
                            draggable
                            onDragStart={() => handleDragStart(idx)}
                            onDragOver={(e) => handleDragOver(e, idx)}
                            onDrop={() => handleDrop(idx)}
                            onClick={() => handleStartEdit(s, idx)}
                            className={`set-row ${editingSet?.id === s.id ? 'set-row-editing' : ''} ${dragOverIndex === idx ? 'set-row-dragover' : ''}`}
                            style={{ ...styles.setRow, opacity: draggingIndex === idx ? 0.4 : 1 }}
                        >
                            <span style={styles.dragHandle}>⠿</span>
                            <span style={styles.setRowText}>
                                #{s.set} · {s.reps} Wdh. {s.set_weight != null ? `× ${s.set_weight}kg` : ''}
                                {s.rest_time != null ? ` · Rest danach ${s.rest_time}s` : ''}
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSet(s) }}
                                className="set-delete-btn"
                                style={styles.deleteButton}
                                aria-label="Satz löschen"
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div key={isEditing ? editingSet.id : 'new'} className={`set-form ${isEditing ? 'set-form-editing' : ''}`} style={styles.form}>
                {!isEditing && (
                    <label style={styles.toggleRow} onClick={() => setLiveMode((v) => !v)}>
                        <div style={{ ...styles.toggleTrack, backgroundColor: liveMode ? '#7349c5' : 'transparent' }}>
                            <div style={{ ...styles.toggleThumb, transform: liveMode ? 'translateX(16px)' : 'translateX(0)' }} />
                        </div>
                        <span style={styles.toggleLabel}>Satz live timen</span>
                    </label>
                )}

                {!isEditing && liveMode && (
                    <div style={{ ...styles.liveBox, animation: 'liveBoxIn 0.2s ease' }}>
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

                <div style={styles.bigInputRow}>
                    <input
                        type="number"
                        inputMode="numeric"
                        value={reps}
                        onChange={(e) => setReps(e.target.value)}
                        className="big-input"
                        style={styles.bigInput}
                    />
                    <span style={styles.bigInputLabel}>Wiederholungen</span>
                </div>

                <div style={styles.bigInputRow}>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="0.5"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="big-input"
                        style={styles.bigInput}
                    />
                    <span style={styles.bigInputLabel}>Gewicht (kg)</span>
                </div>

                {showRestField && (
                    <div style={styles.bigInputRow}>
                        <input
                            type="number"
                            inputMode="numeric"
                            value={restInput}
                            onChange={(e) => setRestInput(e.target.value)}
                            className="big-input"
                            style={styles.bigInput}
                        />
                        <span style={styles.bigInputLabel}>Rest seit letztem Satz</span>
                    </div>
                )}

                <label style={styles.label}>Qualität (optional)</label>
                <div style={styles.qualityRow}>
                    <button
                        onClick={() => setQuality(-1)}
                        className="quality-chip"
                        style={{ ...styles.qualityChip, backgroundColor: quality === -1 ? '#7349c5' : 'transparent' }}
                    >
                        —
                    </button>
                    {Array.from({ length: 11 }, (_, i) => i).map((v) => (
                        <button
                            key={v}
                            onClick={() => setQuality(v)}
                            className="quality-chip"
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

                <button
                    onClick={isEditing ? handleSaveEdit : handleSaveNewSet}
                    className="save-btn"
                    style={{ ...styles.saveButton, backgroundColor: isEditing ? '#c97a3a' : '#7349c5' }}
                    disabled={saving}
                >
                    {saving ? 'Speichert...' : isEditing ? 'Änderungen speichern' : 'Satz speichern'}
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
        marginBottom: '20px', gap: '12px',
    },
    exerciseName: { fontSize: '1.2rem', margin: 0, transition: 'color 0.2s ease' },
    exerciseMeta: { color: '#88838d', fontSize: '0.85rem' },
    changeButton: {
        background: 'transparent', border: '1px solid #7349c5', color: '#f3f3f3',
        borderRadius: '8px', padding: '8px 12px', fontSize: '0.8rem', cursor: 'pointer', flexShrink: 0,
    },
    setList: { marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' },
    setRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: 'rgba(115, 73, 197, 0.1)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '8px 12px',
    },
    dragHandle: { color: '#88838d', fontSize: '1rem', flexShrink: 0 },
    setRowText: { fontSize: '0.85rem', color: '#f3f3f3', flex: 1 },
    deleteButton: {
        background: 'none', border: 'none', color: '#88838d', fontSize: '1.1rem',
        cursor: 'pointer', lineHeight: 1, padding: '2px 6px', flexShrink: 0,
    },
    form: { display: 'flex', flexDirection: 'column', gap: '12px' },
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
        display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden',
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
    bigInputRow: { display: 'flex', alignItems: 'center', gap: '14px' },
    bigInput: {
        flex: 1,
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '10px', padding: '16px', color: '#f3f3f3', fontSize: '1.3rem', outline: 'none',
    },
    bigInputLabel: { color: '#88838d', fontSize: '0.85rem', width: '110px', flexShrink: 0 },
    label: { color: '#88838d', fontSize: '0.8rem' },
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
        color: '#f3f3f3', border: 'none',
        borderRadius: '8px', padding: '14px', fontSize: '1rem', cursor: 'pointer', marginTop: '6px',
    },
}

export default SetEntryView