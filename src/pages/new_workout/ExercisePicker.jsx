import { useState, useEffect } from 'react'
import { supabase } from '../../supabaseClient'
import MuscleGroupModal from './MuscleGroupModal'
import OptionModal from '../../modals/OptionModal'

const SETTINGS_KEY = 'exercise_picker_settings'

function loadStoredSettings() {
    try {
        const stored = localStorage.getItem(SETTINGS_KEY)
        if (stored) return JSON.parse(stored)
    } catch (e) {
        console.warn('Konnte gespeicherte Filter-Einstellungen nicht lesen:', e)
    }
    return { includeSecondary: true, includeTertiary: true }
}

function getDescendantIds(groupId, allGroups) {
    const ids = [groupId]
    const children = allGroups.filter((g) => g.parent_group === groupId)
    children.forEach((child) => {
        ids.push(...getDescendantIds(child.id, allGroups))
    })
    return ids
}

function ExercisePicker({ onSelectExercise, onClose }) {
    const [exercises, setExercises] = useState([])
    const [muscleGroups, setMuscleGroups] = useState([])
    const [loading, setLoading] = useState(true)

    const [search, setSearch] = useState('')
    const [selectedGroupId, setSelectedGroupId] = useState(null)
    const [selectedGroupName, setSelectedGroupName] = useState(null)
    const [showGroupModal, setShowGroupModal] = useState(false)
    const [bodyFilter, setBodyFilter] = useState('all') // 'all' | 'upper' | 'lower'

    const storedSettings = loadStoredSettings()
    const [includeSecondary, setIncludeSecondary] = useState(storedSettings.includeSecondary)
    const [includeTertiary, setIncludeTertiary] = useState(storedSettings.includeTertiary)

    const [showError, setShowError] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const [closing, setClosing] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    function loadData() {
        setLoading(true)
        Promise.all([
            supabase.from('EXERCISES').select('*'),
            supabase.from('MUSCLEGROUPS').select('*'),
        ]).then(([exResult, groupResult]) => {
            setLoading(false)

            if (exResult.error) {
                handleError(exResult.error, 'Laden der Übungen')
                return
            }
            if (groupResult.error) {
                handleError(groupResult.error, 'Laden der Muskelgruppen')
                return
            }

            setExercises(exResult.data)
            setMuscleGroups(groupResult.data)
        })
    }

    function handleError(error, actionLabel) {
        console.error(`Fehler [${error.code}] beim ${actionLabel}:`, error.message)
        setErrorMessage(`Fehler [${error.code}] beim ${actionLabel}: ${error.message}`)
        setShowError(true)
    }

    function handleCheckboxChange(which, value) {
        const next = {
            includeSecondary: which === 'secondary' ? value : includeSecondary,
            includeTertiary: which === 'tertiary' ? value : includeTertiary,
        }
        setIncludeSecondary(next.includeSecondary)
        setIncludeTertiary(next.includeTertiary)
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
    }

    function handleClose() {
        setClosing(true)
        setTimeout(onClose, 220)
    }

    function handleSelectExercise(exercise) {
        setClosing(true)
        setTimeout(() => onSelectExercise(exercise), 220)
    }

    const filteredExercises = exercises.filter((ex) => {
        if (search.trim() && !ex.name?.toLowerCase().includes(search.trim().toLowerCase())) {
            return false
        }

        if (selectedGroupId !== null) {
            const allowedIds = getDescendantIds(selectedGroupId, muscleGroups)
            const relevantGroups = [ex.musclegroup]
            if (includeSecondary) relevantGroups.push(ex.sec_musclegroup)
            if (includeTertiary) relevantGroups.push(ex.ter_musclegroup)

            if (!relevantGroups.some((g) => allowedIds.includes(g))) return false
        }

        if (bodyFilter !== 'all') {
            const primaryGroup = muscleGroups.find((g) => g.id === ex.musclegroup)
            if (!primaryGroup) return false
            if (bodyFilter === 'upper' && !primaryGroup.upper_body) return false
            if (bodyFilter === 'lower' && primaryGroup.upper_body) return false
        }

        return true
    })

    return (
        <div
            style={{
                ...styles.page,
                animation: `${closing ? 'pickerSlideOut' : 'pickerSlideIn'} 0.22s ease forwards`,
            }}
        >
            <style>{`
        @keyframes pickerSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pickerSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(10px); }
        }
        @keyframes tileFadeIn {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes tagPop {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }

        .exercise-tile {
          animation: tileFadeIn 0.25s ease backwards;
          transition: transform 0.15s ease, background-color 0.15s ease, border-color 0.15s ease;
        }
        .exercise-tile:hover {
          background-color: rgba(115, 73, 197, 0.22) !important;
          border-color: #8a63d6 !important;
          transform: translateY(-2px);
        }
        .exercise-tile:active {
          transform: translateY(0) scale(0.97);
          background-color: rgba(115, 73, 197, 0.3) !important;
        }

        .exercise-search-input {
          transition: border-color 0.2s ease, background-color 0.2s ease;
        }
        .exercise-search-input:focus {
          border-color: #7349c5 !important;
          background-color: rgba(115, 73, 197, 0.2) !important;
        }

        .exercise-round-button {
          transition: background-color 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease;
        }
        .exercise-round-button:hover {
          box-shadow: 0 0 0 4px rgba(115, 73, 197, 0.2);
        }
        .exercise-round-button:active {
          transform: scale(0.92);
        }

        .exercise-segment-button {
          transition: background-color 0.2s ease, color 0.2s ease;
        }

        .exercise-back-button {
          transition: background-color 0.2s ease, transform 0.15s ease;
        }
        .exercise-back-button:hover {
          background-color: rgba(115, 73, 197, 0.2);
        }
        .exercise-back-button:active {
          transform: scale(0.9);
        }

        .exercise-remove-filter {
          transition: color 0.15s ease, transform 0.15s ease;
        }
        .exercise-remove-filter:hover {
          color: #e57373;
          transform: rotate(90deg);
        }
      `}</style>

            <div style={styles.header}>
                <button onClick={handleClose} className="exercise-back-button" style={styles.backButton} aria-label="Zurück">
                    ‹
                </button>
                <h1 style={styles.title}>Übung wählen</h1>
            </div>

            <div style={styles.controls}>
                <input
                    type="text"
                    placeholder="Übung suchen..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="exercise-search-input"
                    style={styles.searchInput}
                />

                <button
                    onClick={() => setShowGroupModal(true)}
                    className="exercise-round-button"
                    style={{
                        ...styles.roundButton,
                        backgroundColor: selectedGroupId !== null ? '#7349c5' : 'transparent',
                    }}
                    aria-label="Nach Muskelgruppe filtern"
                    title={selectedGroupName || 'Alle Muskelgruppen'}
                >
                    ⚙
                </button>

                <div style={styles.segmented}>
                    {[
                        { key: 'all', label: 'Alle' },
                        { key: 'upper', label: 'Oben' },
                        { key: 'lower', label: 'Unten' },
                    ].map((opt) => (
                        <button
                            key={opt.key}
                            onClick={() => setBodyFilter(opt.key)}
                            className="exercise-segment-button"
                            style={{
                                ...styles.segmentButton,
                                backgroundColor: bodyFilter === opt.key ? '#7349c5' : 'transparent',
                                color: bodyFilter === opt.key ? '#f3f3f3' : '#88838d',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {selectedGroupId !== null && (
                <div style={styles.activeFilterRow}>
                    <span style={{ ...styles.activeFilterTag, animation: 'tagPop 0.2s ease' }}>
                        {selectedGroupName}
                        <button
                            onClick={() => { setSelectedGroupId(null); setSelectedGroupName(null) }}
                            className="exercise-remove-filter"
                            style={styles.removeFilterButton}
                            aria-label="Filter entfernen"
                        >
                            ×
                        </button>
                    </span>
                </div>
            )}

            {loading ? (
                <p style={styles.statusText}>Lädt...</p>
            ) : filteredExercises.length === 0 ? (
                <p style={styles.statusText}>Keine Übungen gefunden.</p>
            ) : (
                <div style={styles.grid}>
                    {filteredExercises.map((ex, i) => (
                        <button
                            key={ex.id}
                            onClick={() => handleSelectExercise(ex)}
                            className="exercise-tile"
                            style={{ ...styles.tile, animationDelay: `${Math.min(i, 20) * 0.03}s` }}
                        >
                            <span style={styles.tileName}>{ex.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {showGroupModal && (
                <MuscleGroupModal
                    muscleGroups={muscleGroups}
                    includeSecondary={includeSecondary}
                    includeTertiary={includeTertiary}
                    onCheckboxChange={handleCheckboxChange}
                    onSelect={(id, name) => { setSelectedGroupId(id); setSelectedGroupName(name) }}
                    onClose={() => setShowGroupModal(false)}
                />
            )}

            {showError && (
                <OptionModal
                    title="Datenbankfehler"
                    message={errorMessage}
                    buttons={[
                        { label: 'Erneut versuchen', onClick: () => loadData() },
                        { label: 'Schließen', onClick: () => { } },
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
    page: { minHeight: '100vh', backgroundColor: '#110e22', color: '#f3f3f3', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box' },
    header: {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: 'clamp(16px, 4vw, 20px) clamp(16px, 5vw, 24px)', borderBottom: '1px solid #7349c5',
    },
    backButton: {
        background: 'none', border: '1px solid #7349c5', borderRadius: '8px',
        color: '#f3f3f3', width: '32px', height: '32px', flexShrink: 0,
        fontSize: '1.2rem', lineHeight: 1, cursor: 'pointer',
    },
    title: { fontSize: 'clamp(1.1rem, 4.5vw, 1.3rem)', margin: 0 },
    controls: {
        display: 'flex', alignItems: 'center', gap: 'clamp(6px, 2vw, 10px)',
        padding: '16px clamp(16px, 5vw, 24px)',
        boxSizing: 'border-box',
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        background: 'rgba(115, 73, 197, 0.12)', border: '1px solid rgba(115, 73, 197, 0.35)',
        borderRadius: '8px',
        padding: 'clamp(8px, 2.5vw, 10px) clamp(10px, 3vw, 12px)',
        color: '#f3f3f3', fontSize: 'clamp(0.85rem, 3.5vw, 0.95rem)', outline: 'none',
        boxSizing: 'border-box',
    },
    roundButton: {
        width: 'clamp(34px, 9vw, 40px)', height: 'clamp(34px, 9vw, 40px)', borderRadius: '50%',
        border: '1px solid #7349c5', color: '#f3f3f3', fontSize: '1rem',
        cursor: 'pointer', flexShrink: 0,
    },
    segmented: {
        display: 'flex', border: '1px solid #7349c5', borderRadius: '8px',
        overflow: 'hidden', flexShrink: 0,
    },
    segmentButton: {
        border: 'none', padding: 'clamp(6px, 2vw, 10px) clamp(7px, 2.2vw, 12px)',
        fontSize: 'clamp(0.68rem, 2.8vw, 0.8rem)', cursor: 'pointer', whiteSpace: 'nowrap',
    },
    activeFilterRow: { padding: '0 clamp(16px, 5vw, 24px) 12px' },
    activeFilterTag: {
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        backgroundColor: 'rgba(115, 73, 197, 0.2)', border: '1px solid #7349c5',
        borderRadius: '999px', padding: '4px 6px 4px 12px', fontSize: '0.8rem',
    },
    removeFilterButton: {
        background: 'none', border: 'none', color: '#f3f3f3', fontSize: '1rem',
        cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
    },
    statusText: { color: '#88838d', textAlign: 'center', padding: '32px 24px' },
    grid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(110px, 38vw, 140px), 1fr))',
        gap: '12px',
        padding: '0 clamp(16px, 5vw, 24px) 32px',
        boxSizing: 'border-box',
    },
    tile: {
        backgroundColor: 'rgba(115, 73, 197, 0.1)',
        border: '1px solid #7349c5',
        borderRadius: '12px',
        padding: '20px 12px',
        minHeight: '90px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        cursor: 'pointer',
    },
    tileName: { color: '#f3f3f3', fontSize: '0.95rem', fontWeight: 500 },
}

export default ExercisePicker