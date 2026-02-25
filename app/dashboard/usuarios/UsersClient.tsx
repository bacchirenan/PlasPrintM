'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { Profile, UserRole } from '@/lib/types'

interface UsersClientProps {
    currentProfile: Profile
    profiles: Profile[]
}

const ROLE_LABELS: Record<UserRole, string> = {
    user: 'Usuário',
    master: 'Master',
    admin: 'Administrador',
}

export function UsersClient({ currentProfile, profiles: initialProfiles }: UsersClientProps) {
    const supabase = createClient()
    const { showToast } = useToast()
    const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
    const [loadingId, setLoadingId] = useState<string | null>(null)

    const handleRoleChange = async (profileId: string, newRole: UserRole) => {
        if (profileId === currentProfile.id) {
            showToast('Você não pode alterar seu próprio papel.', 'warning')
            return
        }

        setLoadingId(profileId)

        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole, updated_at: new Date().toISOString() })
            .eq('id', profileId)

        setLoadingId(null)

        if (error) {
            showToast('Erro ao atualizar papel do usuário.', 'error')
            return
        }

        setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, role: newRole } : p))
        showToast(`Papel atualizado para ${ROLE_LABELS[newRole]}!`, 'success')
    }

    const initials = (p: Profile) => {
        if (p.full_name) return p.full_name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
        return p.email.substring(0, 2).toUpperCase()
    }

    return (
        <div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-card)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <div className="card-title">👥 Lista de Usuários</div>
                        <div className="card-subtitle">{profiles.length} usuário(s) cadastrado(s)</div>
                    </div>
                </div>

                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-card)', background: 'rgba(82,183,136,0.04)' }}>
                                {['Usuário', 'Email', 'Papel', 'Cadastrado em', 'Ações'].map(h => (
                                    <th key={h} style={{
                                        padding: '12px 16px',
                                        textAlign: 'left',
                                        fontSize: '11px',
                                        fontWeight: 700,
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {profiles.map((p, idx) => (
                                <tr
                                    key={p.id}
                                    style={{
                                        borderBottom: '1px solid var(--border-card)',
                                        background: idx % 2 === 0 ? 'transparent' : 'rgba(82,183,136,0.02)',
                                    }}
                                >
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="user-avatar" style={{ fontSize: '12px', width: '32px', height: '32px' }}>
                                                {initials(p)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                    {p.full_name || p.email.split('@')[0]}
                                                    {p.id === currentProfile.id && (
                                                        <span style={{ fontSize: '10px', marginLeft: '6px', color: 'var(--primary-accent)' }}>
                                                            (você)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.email}</td>
                                    <td style={{ padding: '12px 16px' }}>
                                        <span style={{
                                            fontSize: '11px',
                                            fontWeight: 700,
                                            padding: '3px 8px',
                                            borderRadius: '20px',
                                            background: p.role === 'admin' ? 'rgba(230,57,70,0.15)' :
                                                p.role === 'master' ? 'rgba(82,183,136,0.15)' : 'rgba(255,255,255,0.05)',
                                            color: p.role === 'admin' ? 'var(--danger)' :
                                                p.role === 'master' ? 'var(--primary-accent)' : 'var(--text-muted)',
                                            border: `1px solid ${p.role === 'admin' ? 'rgba(230,57,70,0.3)' :
                                                p.role === 'master' ? 'rgba(82,183,136,0.3)' : 'var(--border-card)'}`,
                                        }}>
                                            {ROLE_LABELS[p.role]}
                                        </span>
                                    </td>
                                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px' }}>
                                        {new Date(p.created_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td style={{ padding: '12px 16px' }}>
                                        {p.id !== currentProfile.id ? (
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                {(['user', 'master', 'admin'] as UserRole[]).map(role => (
                                                    <button
                                                        key={role}
                                                        disabled={loadingId === p.id || p.role === role}
                                                        onClick={() => handleRoleChange(p.id, role)}
                                                        title={`Definir como ${ROLE_LABELS[role]}`}
                                                        style={{
                                                            padding: '4px 10px',
                                                            fontSize: '11px',
                                                            fontWeight: 600,
                                                            borderRadius: '6px',
                                                            cursor: p.role === role ? 'default' : 'pointer',
                                                            border: '1px solid var(--border-card)',
                                                            background: p.role === role ? 'rgba(82,183,136,0.15)' : 'var(--bg-input)',
                                                            color: p.role === role ? 'var(--primary-accent)' : 'var(--text-muted)',
                                                            transition: 'all 0.2s',
                                                            opacity: loadingId === p.id ? 0.5 : 1,
                                                        }}
                                                    >
                                                        {ROLE_LABELS[role]}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: 'var(--text-disabled)' }}>—</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
