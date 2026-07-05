import { useState, useRef } from 'react'

function MenuItem({ option, depth = 0, closeMenu }) {
    const [expanded, setExpanded] = useState(false)
    const contentRef = useRef(null)
    const isParent = Array.isArray(option.children) && option.children.length > 0

    function handleClick() {
        if (isParent) {
            setExpanded((prev) => !prev)
        } else {
            option.onClick && option.onClick()
            closeMenu && closeMenu()
        }
    }

    return (
        <div>
            <button
                onClick={handleClick}
                style={{ ...styles.item, paddingLeft: `${20 + depth * 18}px` }}
            >
                {option.icon && <img src={option.icon} alt="" style={styles.icon} />}
                <span style={styles.label}>{option.label}</span>
                {isParent && (
                    <span
                        style={{
                            ...styles.chevron,
                            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        }}
                    >
                        ›
                    </span>
                )}
            </button>

            {isParent && (
                <div
                    ref={contentRef}
                    style={{
                        overflow: 'hidden',
                        maxHeight: expanded ? `${contentRef.current ? contentRef.current.scrollHeight : 500}px` : '0px',
                        transition: 'max-height 0.25s ease',
                    }}
                >
                    {option.children.map((child, i) => (
                        <div key={i}>
                            <div style={styles.divider} />
                            <MenuItem option={child} depth={depth + 1} closeMenu={closeMenu} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

const styles = {
    item: {
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        background: 'none',
        border: 'none',
        color: '#f3f3f3',
        padding: '14px 20px',
        fontSize: '0.95rem',
        textAlign: 'left',
        cursor: 'pointer',
        gap: '12px',
    },
    icon: {
        width: '18px',
        height: '18px',
        objectFit: 'contain',
    },
    label: {
        flex: 1,
    },
    chevron: {
        color: '#88838d',
        fontSize: '1rem',
        transition: 'transform 0.2s ease',
    },
    divider: {
        height: '1px',
        backgroundColor: '#7349c5',
        borderRadius: '999px',
        margin: '0 20px',
        opacity: 0.4,
    },
}

export default MenuItem