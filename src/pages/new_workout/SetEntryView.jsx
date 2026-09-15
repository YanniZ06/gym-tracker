import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import OptionModal from '../../modals/OptionModal'

function getSessionKey(headId, suffix) {
    return `wo_${headId}_${suffix}`
}

function qualityLabel(quality) {
    return quality != null ? quality : 'keine Angegeben'
}

function formatSetSummary(s) {
    const parts = [`#${s.set}`, `${s.reps} Wdh.`]
    if (s.set_weight != null) parts.push(`× ${s.set_weight}kg`)
    if (s.rest_time != null) parts.push(`Rest danach ${s.rest_time}s`)
    parts.push(`Quali => ${qualityLabel(s.quality)}`)
    return parts.join(' · ')
}

function formatDate(dateStr) {
    if (!dateStr) return ''
    const d = dateStr.includes('T') ? new Date(dateStr) : new Date(dateStr + 'T00:00:00')
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
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

    const [reps, setReps] = useState('')
    const [weight, setWeight] = useState('')
    const [comment, setComment] = useState('')
    const [quality, setQuality] = useState(-1)
    const [restInput, setRestInput] = useState('')

    const [editingSet, setEditingSet] = useState(null)
    const [reordering, setReordering] = useState(false)

    const [saving, setSaving] = useState(false)

    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    // "Letzte Sätze"-Vergleichsansicht
    const [lastTimeStatus, setLastTimeStatus] = useState('loading') // 'loading' | 'none' | 'error' | 'ready'
    const [lastTimeSets, setLastTimeSets] = useState([])
    const [lastTimeDate, setLastTimeDate] = useState(null)
    const [lastTimeErrorMsg, setLastTimeErrorMsg] = useState('')
    const [detailSet, setDetailSet] = useState(null)

    useEffect(() => {
        loadSets()
        loadLastTime()
        resetFormForNewSet([])
        setEditingSet(null)
    }, [exercise?.id])

    function loadSets() {
        supabase
            .from('WORKOUT_DATA')
            .select('*')
            .eq('head', workoutId)
            .eq('exercise_id', exercise.id)
            .order('set', { ascending: true })
            .then(({ data, error }) => {
                if (error) {
                    handleError(error, 'Laden der bisherigen Sätze')
                } else {
                    setSets(data)
                    resetFormForNewSet(data)
                }
            })
    }

    async function loadLastTime() {
        setLastTimeStatus('loading')

        const baselineKey = getSessionKey(workoutId, `baseline_counter_${exercise.id}`)
        let baseline = localStorage.getItem(baselineKey)

        try {
            if (baseline === null) {
                const { data: counterRow, error: counterError } = await supabase
                    .from('CONSTANT_USER_EXERCISE_COUNTER')
                    .select('*')
                    .eq('user', userdata.id)
                    .eq('exercise', exercise.id)
                    .maybeSingle()

                if (counterError) throw counterError

                baseline = counterRow ? counterRow.counter : 0
                localStorage.setItem(baselineKey, baseline.toString())
            } else {
                baseline = parseInt(baseline, 10)
            }

            if (baseline < 1) {
                setLastTimeStatus('none')
                return
            }

            const { data: pastSets, error: pastError } = await supabase
                .from('WORKOUT_DATA')
                .select('*')
                .eq('owner', userdata.id)
                .eq('exercise_id', exercise.id)
                .eq('constant_user_exercise_id_counter', baseline)
                .order('set', { ascending: true })

            if (pastError) throw pastError

            if (!pastSets || pastSets.length === 0) {
                setLastTimeStatus('none')
                return
            }

            const headId = pastSets[0].head
            const { data: pastWorkout, error: woError } = await supabase
                .from('WORKOUTS')
                .select('date')
                .eq('id', headId)
                .single()

            setLastTimeSets(pastSets)
            setLastTimeDate(woError ? null : pastWorkout.date)
            setLastTimeStatus('ready')
        } catch (err) {
            console.error('Fehler beim Laden der Vergleichswerte:', err.message)
            setLastTimeErrorMsg(err.message)
            setLastTimeStatus('error')
        }
    }

    function resetFormForNewSet(currentSets) {
        setReps('')
        setComment('')
        setQuality(-1)

        const lastSet = currentSets.length > 0 ? currentSets[currentSets.length - 1] : null
        setWeight(lastSet ? (lastSet.set_weight ?? '').toString() : (exercise.beginner_weight != null ? exercise.beginner_weight.toString() : ''))
        setRestInput(lastSet && lastSet.rest_time != null ? lastSet.rest_time.toString() : '')
    }

    function handleError(error, actionLabel) {
        console.error(`Fehler [${error?.code || '?'}] beim ${actionLabel}:`, error.message)
        setErrorMessage(`Fehler beim ${actionLabel}: ${error.message}`)
        setShowError(true)
    }

    function handleStartEdit(set, idx) {
        if (reordering) return
        setEditingSet(set)
        setReps(set.reps != null ? set.reps.toString() : '')
        setWeight(set.set_weight != null ? set.set_weight.toString() : '')
        setComment(set.comment || '')
        setQuality(set.quality != null ? set.quality : -1)

        const prevSet = idx > 0 ? sets[idx - 1] : null
        setRestInput(prevSet && prevSet.rest_time != null ? prevSet.rest_time.toString() : '')
    }

    function handleCancelEdit() {
        setEditingSet(null)
        resetFormForNewSet(sets)
    }

    async function resolveConstantCounter() {
        const key = getSessionKey(workoutId, `const_counter_${exercise.id}`)
        const cached = localStorage.getItem(key)
        if (cached !== null) return parseInt(cached, 10)

        const value = await getOrCreateConstantCounter(userdata.id, exercise.id)
        localStorage.setItem(key, value.toString())
        return value
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

            const constantCounterValue = await resolveConstantCounter()

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
                live_entry: false,
                start_time: null,
                end_time: null,
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
            try {
                await Promise.all(
                    changed.map((s) => supabase.from('WORKOUT_DATA').update({ set: s.set }).eq('id', s.id))
                )
            } catch (err) {
                handleError(err, 'Aktualisieren der Satz-Reihenfolge')
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

    async function handleMoveSet(idx, direction) {
        const targetIdx = idx + direction
        if (targetIdx < 0 || targetIdx >= sets.length) return

        const reordered = [...sets]
        const [moved] = reordered.splice(idx, 1)
        reordered.splice(targetIdx, 0, moved)

        await renumberAndPersist(reordered)
    }

    const isEditing = editingSet !== null
    const editingIdx = isEditing ? sets.findIndex((s) => s.id === editingSet.id) : -1
    const showRestField = isEditing ? editingIdx > 0 : sets.length > 0
    const currentSetNumber = isEditing ? editingSet.set : sets.length + 1

    return (
        <div style={styles.wrapper}>
            <style>{`
        @keyframes rowFadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes formFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes chipPop { 0% { transform: scale(1); } 50% { transform: scale(1.15); } 100% { transform: scale(1); } }
        @keyframes panelFadeIn { from { opacity: 0; } to { opacity: 1; } }

        .set-row { animation: rowFadeIn 0.2s ease; transition: background-color 0.15s ease, border-color 0.15s ease; }
        .set-row-editing { background-color: rgba(201, 122, 58, 0.18) !important; border-color: #c97a3a !important; }

        .last-time-row { animation: rowFadeIn 0.2s ease; transition: background-color 0.15s ease, border-color 0.15s ease; cursor: pointer; }
        .last-time-row:hover { background-color: rgba(115, 73, 197, 0.18) !important; }

        .set-form { animation: formFadeIn 0.2s ease; transition: background-color 0.2s ease, border-color 0.2s ease; }
        .set-form-editing { background-color: rgba(201, 122, 58, 0.08); border: 1px solid #c97a3a; border-radius: 12px; padding: clamp(12px, 4vw, 16px); }

        .big-input { transition: border-color 0.2s ease, background-color 0.2s ease; }
        .big-input:focus { border-color: #7349c5 !important; background-color: rgba(115, 73, 197, 0.2) !important; }

        .quality-chip { transition: background-color 0.15s ease, transform 0.1s ease; }
        .quality-chip:active { animation: chipPop 0.2s ease; }

        .change-exercise-btn, .cancel-edit-btn, .move-btn, .set-delete-btn { transition: background-color 0.2s ease, transform 0.15s ease, color 0.15s ease; }
        .change-exercise-btn:hover, .cancel-edit-btn:hover, .move-btn:hover:not(:disabled) { background-color: rgba(115, 73, 197, 0.2); }
        .change-exercise-btn:active, .cancel-edit-btn:active, .move-btn:active:not(:disabled) { transform: scale(0.92); }
        .move-btn:disabled { opacity: 0.25; cursor: default; }
        .set-delete-btn:hover { color: #e57373; transform: rotate(90deg); }

        .save-btn { transition: background-color 0.2s ease, transform 0.1s ease; }
        .save-btn:active { transform: scale(0.98); }
      `}</style>

            <div style={styles.exerciseHeader}>
                <h2 style={{ ...styles.exerciseName, color: isEditing ? '#e8a05f' : '#f3f3f3' }}>
                    {isEditing ? `Bearbeiten von: ${exercise.name} Satz ${editingSet.set}` : exercise.name}
                </h2>
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

            <div style={styles.sectionHeadingRow}>
                <h3 style={styles.sectionHeading}>Durchgeführte Sätze</h3>
                {sets.length > 1 && !isEditing && (
                    <button
                        onClick={() => setReordering((v) => !v)}
                        className="change-exercise-btn"
                        style={styles.reorderToggle}
                    >
                        {reordering ? 'Fertig' : 'Reihenfolge ändern'}
                    </button>
                )}
            </div>

            {sets.length > 0 ? (
                <div style={styles.setList}>
                    {sets.map((s, idx) => (
                        <div
                            key={s.id}
                            onClick={() => !reordering && handleStartEdit(s, idx)}
                            className={`set-row ${editingSet?.id === s.id ? 'set-row-editing' : ''}`}
                            style={{ ...styles.setRow, cursor: reordering ? 'default' : 'pointer' }}
                        >
                            {reordering && (
                                <div style={styles.moveButtons}>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveSet(idx, -1) }}
                                        className="move-btn"
                                        style={styles.moveBtn}
                                        disabled={idx === 0}
                                        aria-label="Nach oben verschieben"
                                    >
                                        ▲
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMoveSet(idx, 1) }}
                                        className="move-btn"
                                        style={styles.moveBtn}
                                        disabled={idx === sets.length - 1}
                                        aria-label="Nach unten verschieben"
                                    >
                                        ▼
                                    </button>
                                </div>
                            )}
                            <span style={styles.setRowText}>{formatSetSummary(s)}</span>
                            {!reordering && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDeleteSet(s) }}
                                    className="set-delete-btn"
                                    style={styles.deleteButton}
                                    aria-label="Satz löschen"
                                >
                                    ×
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <p style={styles.emptyText}>Noch keine Sätze für diese Übung erfasst.</p>
            )}

            {!isEditing && (
                <div style={{ ...styles.lastTimePanel, animation: 'panelFadeIn 0.2s ease' }}>
                    <h3 style={styles.sectionHeading}>
                        {lastTimeStatus === 'ready'
                            ? `Letzte Sätze (vom Workout am ${formatDate(lastTimeDate)})`
                            : 'Letzte Sätze'}
                    </h3>

                    {lastTimeStatus === 'loading' && <p style={styles.emptyText}>Lädt...</p>}
                    {lastTimeStatus === 'none' && <p style={styles.emptyText}>Noch keine Vergleichswerte verfügbar.</p>}
                    {lastTimeStatus === 'error' && <p style={styles.errorText}>Fehler beim Laden der Vergleichswerte: {lastTimeErrorMsg}</p>}

                    {lastTimeStatus === 'ready' && (
                        <div style={styles.setList}>
                            {lastTimeSets.map((s) => (
                                <div
                                    key={s.id}
                                    onClick={() => setDetailSet(s)}
                                    className="last-time-row"
                                    style={styles.lastTimeRow}
                                >
                                    <span style={styles.setRowText}>{formatSetSummary(s)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <h2 style={styles.bigSetHeading}>Satz {currentSetNumber}</h2>

            <div style={{ ...styles.toggleRow, opacity: 0.4, cursor: 'not-allowed' }}>
                <div style={styles.toggleTrack}>
                    <div style={styles.toggleThumb} />
                </div>
                <span style={styles.toggleLabel}>Satz live timen (bald verfügbar)</span>
            </div>

            <div key={isEditing ? editingSet.id : 'new'} className={`set-form ${isEditing ? 'set-form-editing' : ''}`} style={styles.form}>
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
                        <span style={styles.bigInputLabel}>Rest seit letztem Satz (s)</span>
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

            {detailSet && (
                <OptionModal
                    title={`Satz #${detailSet.set} Details`}
                    message={`Wiederholungen: ${detailSet.reps} · Gewicht: ${detailSet.set_weight ?? '-'} kg · Rest danach: ${detailSet.rest_time ?? '-'} s · Qualität: ${qualityLabel(detailSet.quality)}`}
                    buttons={[{ label: 'Schließen', onClick: () => { } }]}
                    isError={false}
                    canCancel={true}
                    onClose={() => setDetailSet(null)}
                />
            )}

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
    wrapper: { padding: 'clamp(16px, 5vw, 24px)', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box' },
    exerciseHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: '20px', gap: '12px',
    },
    exerciseName: { fontSize: 'clamp(1rem, 4.5vw, 1.2rem)', margin: 0, transition: 'color 0.2s ease' },
    changeButton: {
        background: 'transparent', border: '1px solid #7349c5', color: '#f3f3f3',
        borderRadius: '8px', padding: 'clamp(6px, 2vw, 8px) clamp(8px, 2.5vw, 12px)',
        fontSize: 'clamp(0.72rem, 3vw, 0.8rem)', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
    },
    sectionHeadingRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' },
    sectionHeading: { fontSize: '0.95rem', color: '#88838d', margin: '0 0 10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' },
    reorderToggle: {
        background: 'transparent', border: '1px solid #7349c5', color: '#f3f3f3',
        borderRadius: '8px', padding: '5px 10px', fontSize: '0.72rem', cursor: 'pointer', marginBottom: '10px',
    },
    setList: { marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '6px' },
    emptyText: { color: '#88838d', fontSize: '0.85rem', marginBottom: '20px' },
    errorText: { color: '#e57373', fontSize: '0.85rem', marginBottom: '20px' },
    setRow: {
        display: 'flex', alignItems: 'center', gap: '10px',
        backgroundColor: 'rgba(115, 73, 197, 0.1)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '8px 12px',
    },
    moveButtons: { display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 },
    moveBtn: {
        background: 'none', border: '1px solid #7349c5', borderRadius: '4px', color: '#f3f3f3',
        fontSize: '0.6rem', width: '22px', height: '18px', cursor: 'pointer', padding: 0, lineHeight: 1,
    },
    lastTimePanel: { marginBottom: '20px' },
    lastTimeRow: {
        display: 'flex', alignItems: 'center',
        backgroundColor: 'rgba(115, 73, 197, 0.06)', border: '1px solid rgba(115, 73, 197, 0.25)',
        borderRadius: '8px', padding: '8px 12px',
    },
    setRowText: { fontSize: 'clamp(0.78rem, 3.2vw, 0.85rem)', color: '#f3f3f3', flex: 1, minWidth: 0 },
    deleteButton: {
        background: 'none', border: 'none', color: '#88838d', fontSize: '1.1rem',
        cursor: 'pointer', lineHeight: 1, padding: '2px 6px', flexShrink: 0,
    },
    bigSetHeading: { fontSize: 'clamp(1.25rem, 6vw, 1.6rem)', margin: '4px 0 14px' },
    form: { display: 'flex', flexDirection: 'column', gap: '12px' },
    toggleRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' },
    toggleTrack: {
        width: '36px', height: '20px', borderRadius: '999px',
        border: '1px solid #7349c5', position: 'relative', flexShrink: 0,
    },
    toggleThumb: {
        width: '14px', height: '14px', borderRadius: '50%',
        backgroundColor: '#f3f3f3', position: 'absolute', top: '2px', left: '2px',
    },
    toggleLabel: { color: '#f3f3f3', fontSize: 'clamp(0.8rem, 3.2vw, 0.9rem)' },
    bigInputRow: { display: 'flex', alignItems: 'center', gap: 'clamp(8px, 3vw, 14px)' },
    bigInput: {
        flex: 1,
        minWidth: 0,
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '10px',
        padding: 'clamp(11px, 3.5vw, 16px)',
        color: '#f3f3f3', fontSize: 'clamp(1rem, 4.5vw, 1.3rem)', outline: 'none',
        boxSizing: 'border-box',
    },
    bigInputLabel: {
        color: '#88838d', fontSize: 'clamp(0.68rem, 2.8vw, 0.85rem)',
        width: 'clamp(80px, 26vw, 140px)', flexShrink: 0,
    },
    label: { color: '#88838d', fontSize: '0.8rem' },
    qualityRow: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
    qualityChip: {
        width: 'clamp(28px, 8vw, 32px)', height: 'clamp(28px, 8vw, 32px)', borderRadius: '8px',
        border: '1px solid #7349c5', color: '#f3f3f3', fontSize: '0.8rem', cursor: 'pointer',
    },
    textarea: {
        backgroundColor: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px', padding: '10px', color: '#f3f3f3', fontSize: '0.9rem', outline: 'none',
        resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%',
    },
    saveButton: {
        color: '#f3f3f3', border: 'none',
        borderRadius: '8px', padding: 'clamp(12px, 3.5vw, 14px)', fontSize: 'clamp(0.9rem, 3.8vw, 1rem)',
        cursor: 'pointer', marginTop: '6px',
    },
}

export default SetEntryView