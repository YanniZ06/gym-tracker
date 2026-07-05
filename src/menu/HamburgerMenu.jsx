import { useState } from 'react'
import MenuItem from './MenuItem'

function HamburgerMenu({ options, isOpen, onClose, onLogout, userEmail }) {
    const [closing, setClosing] = useState(false)

    function handleClose() {
        setClosing(true)
        setTimeout(() => {
            setClosing(false)
            onClose()
        }, 250)
    }

    if (!isOpen && !closing) return null

    return (
        <div
            style={{
                ...styles.overlay,
                animation: `${closing ? 'fadeOutOverlay' : 'fadeInOverlay'} 0.25s ease forwards`,
            }}
            onClick={handleClose}
        >
            <style>{`
        @keyframes fadeInOverlay { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOutOverlay { from { opacity: 1; } to { opacity: 0; } }
        @keyframes slideInPanel { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes slideOutPanel { from { transform: translateX(0); } to { transform: translateX(-100%); } }

        .menu-scroll::-webkit-scrollbar { width: 8px; }
        .menu-scroll::-webkit-scrollbar-track { background: transparent; }
        .menu-scroll::-webkit-scrollbar-thumb { background-color: #7349c5; border-radius: 10px; }
        .menu-scroll { scrollbar-width: thin; scrollbar-color: #7349c5 transparent; }
      `}</style>

            <div
                style={{
                    ...styles.panel,
                    animation: `${closing ? 'slideOutPanel' : 'slideInPanel'} 0.25s ease forwards`,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="menu-scroll" style={styles.scrollArea}>
                    {options.map((option, i) => (
                        <div key={i}>
                            <MenuItem option={option} closeMenu={handleClose} />
                            {i < options.length - 1 && <div style={styles.divider} />}
                        </div>
                    ))}
                </div>

                <div style={styles.logoutSection}>
                    <button onClick={onLogout} style={styles.logoutButton}>
                        <span style={styles.logoutLabel}>Logout</span>
                        {userEmail && <span style={styles.logoutEmail}>{userEmail}</span>}
                    </button>
                </div>
            </div>
        </div>
    )
}

const styles = {
    overlay: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 1000,
    },
    panel: {
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: '280px',
        maxWidth: '80vw',
        backgroundColor: '#110e22',
        borderRight: '1px solid #7349c5',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1001,
    },
    scrollArea: {
        flex: 1,
        overflowY: 'auto',
        padding: '12px 0',
    },
    divider: {
        height: '1px',
        backgroundColor: '#7349c5',
        borderRadius: '999px',
        margin: '0 20px',
        opacity: 0.4,
    },
    logoutSection: {
        position: 'relative',
        zIndex: 2,
        backgroundColor: '#110e22',
        borderTop: '1px solid #7349c5',
        boxShadow: '0 -10px 16px rgba(0, 0, 0, 0.45)',
        padding: '8px 0',
    },
    logoutButton: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        background: 'none',
        border: 'none',
        color: '#e57373',
        padding: '14px 20px',
        fontSize: '0.95rem',
        textAlign: 'left',
        cursor: 'pointer',
    },
    logoutLabel: {
        fontWeight: 'bold',
    },
    logoutEmail: {
        color: '#88838d',
        fontSize: '0.75rem',
        marginTop: '2px',
    },
}

export default HamburgerMenu