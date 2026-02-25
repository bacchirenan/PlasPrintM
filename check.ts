import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function run() {
    const { data, error } = await supabase.from('machines').insert([
        { name: 'Encabeçadora de Canudos', number: 'ENCAB_CANUDOS', type: 'machine', active: true }
    ]).select('*');

    if (error) {
        if (error.code === '23505') {
            console.log('Máquina já existe. Atualizando active=true...');
            const r = await supabase.from('machines').update({ active: true }).eq('number', 'ENCAB_CANUDOS').select('*');
            console.log(r.data);
        } else {
            console.log(error);
        }
    } else {
        console.log(data);
    }
}
run();
