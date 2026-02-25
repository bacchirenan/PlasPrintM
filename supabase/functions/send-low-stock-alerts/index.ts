import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer'

const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_PASS = Deno.env.get('GMAIL_PASS')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ALERT_RECIPIENT = Deno.env.get('ALERT_EMAIL') || 'renan.projeto@plasutil.com.br'

Deno.serve(async (req) => {
  console.log('--- LOG: Iniciando send-low-stock-alerts ---')

  try {
    if (!GMAIL_USER || !GMAIL_PASS) throw new Error('Credenciais de e-mail ausentes.')

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

    // 1. Buscar itens no banco
    const { data: allItems, error: itemsError } = await supabase
      .from('inventory_items')
      .select('id, name, quantity, min_quantity, code')

    if (itemsError) throw itemsError

    // 2. Filtrar itens com estoque baixo
    const lowStock = (allItems || []).filter((item: any) => {
      const min = item.min_quantity || 0
      return item.quantity <= min
    })

    if (lowStock.length === 0) {
      return new Response(JSON.stringify({ status: 'ok', message: 'Nenhum item em nível crítico.' }), { headers: { 'Content-Type': 'application/json' } })
    }

    // 3. Montar e Enviar E-mail (Simplificado para evitar SPAM)
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_PASS },
    })

    let emailHtml = `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Alerta de Reposicao de Estoque</h2>
            <p>Os itens abaixo atingiram o nivel minimo:</p>
            <ul>`

    lowStock.forEach(item => {
      emailHtml += `<li><strong>${item.name}</strong>: Atual ${item.quantity} (Limite: ${item.min_quantity || 0})</li>`
    })

    emailHtml += `</ul>
            <p>Por favor, verifique o sistema PlasPrint Manutencao.</p>
        </div>`

    const info = await transporter.sendMail({
      from: `"PlasPrint Manutencao" <${GMAIL_USER}>`,
      to: ALERT_RECIPIENT,
      subject: `PlasPrint - Reposicao Necessaria - ${lowStock.length} Itens`,
      html: emailHtml,
    })

    console.log('LOG: E-mail enviado com sucesso! ID:', info.messageId)

    return new Response(JSON.stringify({ status: 'success', items_found: lowStock.length }), { headers: { 'Content-Type': 'application/json' } })

  } catch (error: any) {
    console.error('ERRO FATAL:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
