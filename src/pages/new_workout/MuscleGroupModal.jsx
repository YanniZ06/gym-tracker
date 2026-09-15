import { useState } from 'react'

function buildTree(groups) {
    const map = {}
    groups.forEach((g) => { map[g.id] = { ...g, children: [] } })
    const roots = []
    groups.forEach((g) => {
        if (g.parent_group && map[g.parent_group]) {
            map[g.parent_group].children.push(map[g.id])
        } else {
            roots.push(map[g.id])
        }
    })
    return roots
}

function GroupItem({ group, depth, onSelect }) {
    const [expanded, setExpanded] = useState(false)
    const hasChildren = group.children.length > 0

    return (
        <div>
            <div style={{ ...styles.row, paddingLeft: `${16 + depth * 18}px` }}>
                <button onClick={() => onSelect(group.id, group.name)} style={styles.rowButton}>
                    {group.name}
                </button>
                {hasChildren && (
                    <button
                        onClick={(e) => { e.stopPropagation(); setExpanded((prev) => !prev) }}
                        style={{ ...styles.chevron, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                    >
                        ›
                    </button>
                )}
            </div>

            {hasChildren && expanded && (
                <div>
                    {group.children.map((child) => (
                        <GroupItem key={child.id} group={child} depth={depth + 1} onSelect={onSelect} />
                    ))}
                </div>
            )}
        </div>
    )
}
function MuscleGroupModal({ muscleGroups, includeSecondary, includeTertiary, onCheckboxChange, onSelect, onClose }) {
    const [closing, setClosing] = useState(false)
    const tree = buildTree(muscleGroups)

    function handleClose() {
        setClosing(true)
        setTimeout(onClose, 250)
    }

    function handleSelect(id, name) {
        setClosing(true)
        setTimeout(() => {
            onSelect(id, name)
            onClose()
        }, 250)
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
      `}</style>

            <div
                style={{ ...styles.modal, animation: `${closing ? 'fadeOutModal' : 'fadeInModal'} 0.25s ease forwards` }}
                onClick={(e) => e.stopPropagation()}
            >
                <h2 style={styles.title}>Muskelgruppe wählen</h2>

                <div style={styles.checkboxRow}>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={includeSecondary}
                            onChange={(e) => onCheckboxChange('secondary', e.target.checked)}
                            style={styles.checkbox}
                        />
                        Sekundäre Muskelgruppen
                    </label>
                    <label style={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={includeTertiary}
                            onChange={(e) => onCheckboxChange('tertiary', e.target.checked)}
                            style={styles.checkbox}
                        />
                        Tertiäre Muskelgruppen
                    </label>
                </div>

                <div style={styles.divider} />

                <div style={styles.list}>
                    <button onClick={() => handleSelect(null, null)} style={styles.allButton}>
                        Alle anzeigen
                    </button>
                    <div style={styles.divider} />
                    {tree.map((group) => (
                        <GroupItem key={group.id} group={group} depth={0} onSelect={handleSelect} />
                    ))}
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
        padding: '1.5rem 0',
        width: '300px',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 0 20px rgba(115, 73, 197, 0.3)',
    },
    title: { color: '#f3f3f3', margin: '0 1.5rem 1rem', fontSize: '1.2rem' },
    checkboxRow: { display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 1.5rem 1rem' },
    checkboxLabel: { display: 'flex', alignItems: 'center', gap: '8px', color: '#88838d', fontSize: '0.85rem', cursor: 'pointer' },
    checkbox: { width: '15px', height: '15px', accentColor: '#7349c5', cursor: 'pointer' },
    list: { overflowY: 'auto' },
    row: { display: 'flex', alignItems: 'center' },
    rowButton: {
        flex: 1, textAlign: 'left', background: 'none', border: 'none',
        color: '#f3f3f3', padding: '10px 8px', fontSize: '0.95rem', cursor: 'pointer',
    },
    allButton: {
        display: 'block', width: '100%', textAlign: 'left', background: 'none', border: 'none',
        color: '#7349c5', padding: '10px 16px', fontSize: '0.95rem', fontWeight: 600, cursor: 'pointer',
    },
    chevron: {
        background: 'none', border: 'none', color: '#88838d', fontSize: '1rem',
        padding: '10px', cursor: 'pointer', transition: 'transform 0.2s ease',
    },
    divider: { height: '1px', backgroundColor: '#7349c5', opacity: 0.4, margin: '4px 0' },
}

export default MuscleGroupModal