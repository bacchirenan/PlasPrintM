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

    return (
        <div className="page-container">
            <header className="page-header">
                <div className="page-header-title">
                    <h1>Dashboard Geral</h1>
                    <p>Visão consolidada da manutenção e estoque.</p>
                </div>
            </header>

            <DashboardClient
                machines={(machines as Machine[]) || []}
                items={(items as MaintenanceItem[]) || []}
                logs={(logs as MaintenanceLog[]) || []}
                inventory={(inventory as InventoryItem[]) || []}
            />
        </div>
    )
}
