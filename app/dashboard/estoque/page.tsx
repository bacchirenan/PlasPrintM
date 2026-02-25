import { createClient } from '@/lib/supabase/server'
import { InventoryClient } from './InventoryClient'
import type { InventoryItem } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function EstoquePage() {
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .single()

    const { data: items } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('category', 'peca')
        .order('name', { ascending: true })

    return (
        <div className="page-container">
            <header className="page-header">
                <div className="page-header-title">
                    <h1>Estoque de Peças</h1>
                    <p>Gerencie o inventário de peças e componentes de reposição.</p>
                </div>
            </header>

            <InventoryClient
                initialItems={(items as InventoryItem[]) || []}
                category="peca"
                userRole={profile?.role}
            />
        </div>
    )
}
