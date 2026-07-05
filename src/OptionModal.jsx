import { useState } from 'react'

function OptionModal({ title, message, buttons = [{ label: 'OK', onClick: () => {} }], canCancel = true, isError = false, onClose }) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    if (!canCancel) return
    triggerClose(onClose)
  }

  function triggerClose(afterClose) {
    setClosing(true)
    setTimeout(() => {
      afterClose && afterClose()
    }, 250)
  }

  function handleButtonClick(callback) {
    triggerClose(() => {
      callback && callback()
      onClose && onClose()
    })
  }

  // Fade-Animation immer, Shake+Flash nur zusätzlich beim Öffnen, wenn isError
  const modalAnimation = closing
    ? 'fadeOutModal 0.25s ease forwards'
    : isError
      ? 'fadeInModal 0.25s ease forwards, errorShake 0.4s ease, errorFlash 0.6s ease'
      : 'fadeInModal 0.25s ease forwards'

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

        @keyframes errorShake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(7px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(4px); }
        }
        @keyframes errorFlash {
          0% { background-color: #110e22; border-color: #7349c5; }
          25% { background-color: #3a1620; border-color: #e05a5a; }
          100% { background-color: #110e22; border-color: #7349c5; }
        }
      `}</style>

      <div
        style={{ ...styles.modal, animation: modalAnimation }}
        onClick={(e) => e.stopPropagation()}
      >
        {canCancel && (
          <button onClick={handleClose} style={styles.xButton} aria-label="Schließen">
            ×
          </button>
        )}

        <h2 style={styles.title}>{title}</h2>
        <p style={styles.message}>{message}</p>

        <div style={styles.buttonRow}>
          {buttons.map((btn, i) => (
            <button
              key={i}
              onClick={() => handleButtonClick(btn.onClick)}
              style={i === 0 ? styles.primaryButton : styles.secondaryButton}
            >
              {btn.label}
            </button>
          ))}
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    position: 'relative',
    backgroundColor: '#110e22',
    border: '1px solid #7349c5',
    borderRadius: '10px',
    padding: '2rem',
    width: '300px',
    boxShadow: '0 0 20px rgba(115, 73, 197, 0.3)',
  },
  xButton: {
    position: 'absolute',
    top: '10px',
    right: '14px',
    background: 'none',
    border: 'none',
    color: '#88838d',
    fontSize: '1.4rem',
    lineHeight: 1,
    cursor: 'pointer',
  },
  title: {
    color: '#f3f3f3',
    marginTop: 0,
    marginBottom: '0.6rem',
    fontSize: '1.3rem',
  },
  message: {
    color: '#88838d',
    fontSize: '0.9rem',
    marginBottom: '1.5rem',
    lineHeight: 1.4,
  },
  buttonRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  primaryButton: {
    backgroundColor: '#7349c5',
    color: '#f3f3f3',
    border: 'none',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: '#f3f3f3',
    border: '1px solid #7349c5',
    borderRadius: '6px',
    padding: '10px',
    fontSize: '0.95rem',
    cursor: 'pointer',
  },
}

export default OptionModal