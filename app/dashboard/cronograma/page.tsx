import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChecklistClient } from './ChecklistClient'
import type { Machine, MaintenanceCategory, MaintenanceItem, MaintenanceLog, Profile } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function CronogramaPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    // Buscar tudo em paralelo
    const [
        { data: profileData },
        { data: machines },
        { data: categories },
        { data: items },
        { data: logs },
    ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('machines').select('*').eq('active', true).order('number'),
        supabase.from('maintenance_categories').select('*').order('display_order'),
        supabase.from('maintenance_items').select('*, category:maintenance_categories(*)').eq('active', true).order('display_order'),
        supabase.from('maintenance_logs').select('*, user:profiles(id, full_name, email)').order('completed_at', { ascending: false }),
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
        <ChecklistClient
            profile={profile}
            machines={sortedMachines as Machine[]}
            categories={(categories || []) as MaintenanceCategory[]}
            items={(items || []) as MaintenanceItem[]}
            initialLogs={(logs || []) as MaintenanceLog[]}
        />
    )
}
