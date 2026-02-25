import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Profile } from '@/lib/types'
import { UsersClient } from './UsersClient'

export default async function UsuariosPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

    const profile: Profile = profileData || {
        id: user.id,
        email: user.email || '',
        full_name: null,
        role: 'user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }

    // Apenas master/admin podem acessar
    if (profile.role === 'user') redirect('/dashboard/cronograma')

    const { data: allProfiles } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at')

    return (
        <UsersClient
            currentProfile={profile}
            profiles={(allProfiles || []) as Profile[]}
        />
    )
}
