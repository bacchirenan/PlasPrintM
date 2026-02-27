'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

interface SidebarProps {
    profile: Profile
}

const NAV_ITEMS = [
    {
        section: 'Principal',
        items: [
            {
                href: '/dashboard/geral',
                label: 'Dashboard',
                id: 'nav-dashboard',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="7" height="9" />
                        <rect x="14" y="3" width="7" height="5" />
                        <rect x="14" y="12" width="7" height="9" />
                        <rect x="3" y="16" width="7" height="5" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/cronograma',
                label: 'Cronograma de Limpeza',
                id: 'nav-cronograma',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                        <path d="m9 16 2 2 4-4" />
                    </svg>
                ),
            },
            {
                href: '/dashboard/historico',
                label: 'Manutenção',
                id: 'nav-historico',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v5h5" />
                        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
                        <path d="M12 7v5l4 2" />
                    </svg>
                ),
            },

            {
                href: '/dashboard/consumo-tintas',
                label: 'Consumo de Tintas',
                id: 'nav-consumo-tintas',
                icon: (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                    </svg>
                ),
            },
        ],
    },
]

export function Sidebar({ profile }: SidebarProps) {
    const pathname = usePathname()
    const router = useRouter()
    const supabase = createClient()

    const handleLogout = async () => {
        await supabase.auth.signOut()
        router.push('/login')
        router.refresh()
    }

    const initials = profile.full_name
        ? profile.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        : profile.email.substring(0, 2).toUpperCase()

    const roleLabel = profile.role === 'master'
        ? 'Master'
        : profile.role === 'admin'
            ? 'Administrador'
            : 'Usuário'

    return (
        <aside className="sidebar" id="sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-icon">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                    </svg>
                </div>
                <div className="sidebar-brand-text">
                    <h1>PlasPrint</h1>
                    <span>Manutenção</span>
                </div>
            </div>

            {/* Navegação */}
            <nav className="sidebar-nav" aria-label="Navegação principal">
                {NAV_ITEMS.map((section) => (
                    <div key={section.section}>
                        <div className="sidebar-section-title">{section.section}</div>
                        {section.items.map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                id={item.id}
                                className={`nav-item ${pathname === item.href || pathname.startsWith(item.href) ? 'active' : ''}`}
                                aria-current={pathname === item.href ? 'page' : undefined}
                            >
                                {item.icon}
                                {item.label}
                            </Link>
                        ))}
                    </div>
                ))}

                {/* Separador */}
                <div className="divider" />

                {/* Seção Admin/Master */}
                {(profile.role === 'master' || profile.role === 'admin') && (
                    <div>
                        <div className="sidebar-section-title">Administração</div>
                        <Link
                            href="/dashboard/usuarios"
                            id="nav-usuarios"
                            className={`nav-item ${pathname === '/dashboard/usuarios' ? 'active' : ''}`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                            Usuários
                        </Link>
                        <Link
                            href="/dashboard/tintas"
                            id="nav-tintas"
                            className={`nav-item ${pathname === '/dashboard/tintas' ? 'active' : ''}`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />
                            </svg>
                            Estoque de Tintas
                        </Link>
                        <Link
                            href="/dashboard/estoque"
                            id="nav-estoque"
                            className={`nav-item ${pathname === '/dashboard/estoque' ? 'active' : ''}`}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                                <path d="m3.3 7 8.7 5 8.7-5" />
                                <path d="M12 22V12" />
                            </svg>
                            Estoque de Peças
                        </Link>
                    </div>
                )}
            </nav>

            {/* Footer: Usuário logado */}
            <div className="sidebar-footer">
                <div className="user-card">
                    <div className="user-avatar" aria-hidden="true">{initials}</div>
                    <div className="user-info">
                        <div className="user-name">
                            {profile.full_name || profile.email.split('@')[0]}
                        </div>
                        <div className="user-role">{roleLabel}</div>
                    </div>
                    <button
                        id="logout-btn"
                        className="logout-btn"
                        onClick={handleLogout}
                        title="Sair do sistema"
                        aria-label="Sair do sistema"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                            <polyline points="16 17 21 12 16 7" />
                            <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
        </aside>
    )
}
