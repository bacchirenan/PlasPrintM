import { createClient } from '@/lib/supabase/server'
import { DashboardClient } from './DashboardClient'
import type { Machine, MaintenanceItem, MaintenanceLog, InventoryItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function GeralDashboardPage() {
    const supabase = await createClient()

    // Buscar dados para o dashboard
    const [
        { data: machines },
        { data: items },
        { data: logs },
        { data: inventory }
    ] = await Promise.all([
        supabase.from('machines').select('*').eq('active', true).order('number', { ascending: true }),
        supabase.from('maintenance_items').select('*, category:maintenance_categories(*)').eq('active', true),
        supabase.from('maintenance_logs').select('*, user:profiles(full_name, email)').order('completed_at', { ascending: false }),
        supabase.from('inventory_items').select('*')
    ])

    const sortedMachines = ((machines as Machine[]) || []).sort((a, b) => {
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
        <div className="page-container">
            <DashboardClient
                machines={sortedMachines}
                items={(items as MaintenanceItem[]) || []}
                logs={(logs as MaintenanceLog[]) || []}
                inventory={(inventory as InventoryItem[]) || []}
            />
        </div>
    )
}
