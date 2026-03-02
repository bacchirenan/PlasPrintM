import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Faltam variáveis de ambiente em .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

async function checkOverdue() {
    console.log('Consultando itens em atraso...')
    const { data, error } = await supabase
        .from('maintenance_status')
        .select('*')
        .eq('is_overdue', true)

    if (error) {
        console.error('Erro ao consultar view:', error)
        return
    }

    if (!data || data.length === 0) {
        console.log('Nenhum item em atraso encontrado no banco de dados.')
    } else {
        console.log(`${data.length} itens em atraso encontrados:`)
        data.forEach(item => {
            console.log(`- ${item.machine_name} (${item.machine_number}): ${item.item_name} [${item.category_name}]`)
        })
    }
}

checkOverdue()
