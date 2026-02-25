'use client'

import { InventoryClient } from '../estoque/InventoryClient'
import { createClient } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import type { InventoryItem, Profile } from '@/lib/types'
import { useRouter } from 'next/navigation'

export default function ConsumoTintasPage() {
    const supabase = createClient()
    const router = useRouter()
    const [items, setItems] = useState<InventoryItem[]>([])
    const [profile, setProfile] = useState<Profile | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                router.push('/login')
                return
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single()

            const { data: items } = await supabase
                .from('inventory_items')
                .select('*')
                .eq('category', 'tinta')
                .order('name')

            setProfile(profile)
            setItems(items || [])
            setLoading(false)
        }
        fetchData()
    }, [supabase, router])

    if (loading) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-primary)' }}>
                Carregando consumo de tintas...
            </div>
        )
    }

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Consumo de Tintas
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                    Registre as retiradas de tinta e acompanhe o histórico de uso.
                </p>
            </div>

            <InventoryClient
                initialItems={items}
                category="tinta"
                userRole={profile?.role}
                viewMode="withdrawals"
            />
        </div>
    )
}
