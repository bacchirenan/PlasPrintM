'use client'

import { createContext, useContext, useState, useCallback } from 'react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
    id: string
    message: string
    type: ToastType
}

interface ToastContextValue {
    showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
    showToast: () => { },
})

export function useToast() {
    return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([])

    const showToast = useCallback((message: string, type: ToastType = 'success') => {
        const id = Math.random().toString(36).substring(2)
        setToasts(prev => [...prev, { id, message, type }])
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id))
        }, 3500)
    }, [])

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }

    const icons: Record<ToastType, string> = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
    }

    const colors: Record<ToastType, { bg: string; border: string }> = {
        success: { bg: 'rgba(82, 183, 136, 0.15)', border: 'rgba(82, 183, 136, 0.4)' },
        error: { bg: 'rgba(230, 57, 70, 0.15)', border: 'rgba(230, 57, 70, 0.4)' },
        warning: { bg: 'rgba(244, 162, 97, 0.15)', border: 'rgba(244, 162, 97, 0.4)' },
        info: { bg: 'rgba(72, 149, 239, 0.15)', border: 'rgba(72, 149, 239, 0.4)' },
    }

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            {/* Container de toasts */}
            <div
                id="toast-container"
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxWidth: '380px',
                }}
                aria-live="polite"
                aria-atomic="true"
            >
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        role="alert"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            padding: '12px 16px',
                            background: colors[toast.type].bg,
                            border: `1px solid ${colors[toast.type].border}`,
                            borderRadius: '10px',
                            backdropFilter: 'blur(20px)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
                            animation: 'slideInRight 0.3s ease',
                            cursor: 'pointer',
                        }}
                        onClick={() => removeToast(toast.id)}
                    >
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{icons[toast.type]}</span>
                        <span style={{
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            fontWeight: 500,
                            lineHeight: 1.4,
                        }}>
                            {toast.message}
                        </span>
                        <button
                            style={{
                                marginLeft: 'auto',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '16px',
                                padding: '0',
                                lineHeight: 1,
                                flexShrink: 0,
                            }}
                            aria-label="Fechar notificação"
                            onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <style>{`
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `}</style>
        </ToastContext.Provider>
    )
}
