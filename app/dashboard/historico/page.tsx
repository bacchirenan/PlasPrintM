import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HistoricoClient } from './HistoricoClient'
import type { MaintenanceLog, Machine, Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function HistoricoPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const [
        { data: profileData },
        { data: machines },
        { data: events },
    ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('machines').select('*').eq('active', true).order('number'),
        supabase
            .from('machine_events')
            .select(`
                *,
                machine:machines(id, name, number),
                user:profiles(id, full_name, email)
            `)
            .order('created_at', { ascending: false })
            .limit(500),
    ])

    const profile: Profile = profileData || {
        id: user.id,
        email: user.email || '',
        full_name: user.user_metadata?.full_name || null,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    const sortedMachines = (machines || []).sort((a, b) => {
        if (a.type === 'room') return 1
        if (b.type === 'room') return -1
        const valA = parseInt(a.number)
        const valB = parseInt(b.number)

        if (isNaN(valA) && isNaN(valB)) return a.name.localeCompare(b.name)
        if (isNaN(valA)) return 1
        if (isNaN(valB)) return -1

        return valA - valB
    })

    return (
        <HistoricoClient
            profile={profile}
            machines={sortedMachines as Machine[]}
            events={(events || []) as any[]}
        />
    )
}
