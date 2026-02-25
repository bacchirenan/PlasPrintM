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
        title: 'Histórico de Manutenção',
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

    const now = new Date()
    const dateStr = now.toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
    })

    return (
        <header className="header" id="main-header">
            <div className="header-left">
                <h2>{pageInfo.title}</h2>
                <p>{pageInfo.subtitle}</p>
            </div>
            <div className="header-right">
                {/* Badge de role do usuário */}
                {(profile.role === 'master' || profile.role === 'admin') && (
                    <span style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: 'rgba(82, 183, 136, 0.15)',
                        color: 'var(--primary-accent)',
                        border: '1px solid rgba(82, 183, 136, 0.3)',
                        letterSpacing: '0.5px',
                        textTransform: 'uppercase',
                    }}>
                        {profile.role === 'master' ? '⭐ Master' : '🔧 Admin'}
                    </span>
                )}
                <div className="header-date" aria-label="Data atual">
                    📅 {dateStr}
                </div>
            </div>
        </header>
    )
}
