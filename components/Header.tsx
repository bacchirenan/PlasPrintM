'use client'

import { usePathname } from 'next/navigation'
import type { Profile } from '@/lib/types'

interface HeaderProps {
    profile: Profile
}

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
    '/dashboard/cronograma': {
        title: 'Cronograma de Limpeza',
        subtitle: 'Gerencie as manutenções preventivas das máquinas',
    },
    '/dashboard/historico': {
        title: 'Manutenção',
        subtitle: 'Consulte o registro completo de manutenções realizadas',
    },
    '/dashboard/usuarios': {
        title: 'Gerenciamento de Usuários',
        subtitle: 'Administre os usuários e permissões do sistema',
    },
}

export function Header({ profile }: HeaderProps) {
    const pathname = usePathname()
    const pageInfo = PAGE_TITLES[pathname] || {
        title: 'Dashboard',
        subtitle: 'PlasPrint Manutenção',
    }



    return (
        <header className="header" id="main-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button
                    className="mobile-menu-toggle"
                    onClick={() => {
                        const sidebar = document.getElementById('sidebar')
                        if (sidebar) sidebar.classList.toggle('open')
                    }}
                    aria-label="Abrir menu"
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'none', // Hidden by default, shown via CSS on mobile
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                <div className="header-left">
                    <h2>{pageInfo.title}</h2>
                    <p>{pageInfo.subtitle}</p>
                </div>
            </div>
            <div className="header-right">


            </div>
        </header>
    )
}
