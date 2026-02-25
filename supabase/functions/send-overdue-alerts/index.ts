import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer'

// Configurações de Ambiente
const GMAIL_USER = Deno.env.get('GMAIL_USER')
const GMAIL_PASS = Deno.env.get('GMAIL_PASS')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const ALERT_RECIPIENT = Deno.env.get('ALERT_EMAIL') || 'renan.projeto@plasutil.com.br'

Deno.serve(async (req) => {
    console.log('--- Iniciando execução da função de Alerta ---')

    try {
        // Validação de Segredos
        if (!GMAIL_USER || !GMAIL_PASS) {
            console.error('ERRO: GMAIL_USER ou GMAIL_PASS não configurados nos Secrets.')
            throw new Error('Configuração de e-mail incompleta no servidor.')
        }
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            console.error('ERRO: SUPABASE_URL ou SERVICE_ROLE não configurados.')
            throw new Error('Configuração do Supabase incompleta.')
        }

        const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)

        // 1. Buscar itens em atraso da View maintenance_status
        console.log('Buscando itens em atraso na view...')
        const { data: overdueItems, error: overdueError } = await supabase
            .from('maintenance_status')
            .select('*')
            .eq('is_overdue', true)

        if (overdueError) {
            console.error('Erro ao consultar view maintenance_status:', overdueError)
            throw overdueError
        }

        if (!overdueItems || overdueItems.length === 0) {
            console.log('Sucesso: Nenhum item em atraso encontrado.')
            return new Response(JSON.stringify({ message: 'Nenhum item em atraso.' }), {
                headers: { 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        console.log(`${overdueItems.length} itens em atraso encontrados.`)

        // 2. Agrupar itens por máquina
        const groupedByMachine = overdueItems.reduce((acc: any, item: any) => {
            const machine = item.machine_name || `Máquina ${item.machine_number}`
            if (!acc[machine]) acc[machine] = []
            acc[machine].push(item)
            return acc
        }, {})

        // 3. Montar o corpo do e-mail (HTML)
        let emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937; background: #ffffff; padding: 20px; border-radius: 12px; border: 1px solid #e5e7eb;">
        <h1 style="color: #e63946; border-bottom: 2px solid #e63946; padding-bottom: 10px; margin-top: 0;">⚠️ Alerta de Manutenção em Atraso</h1>
        <p>Olá, os seguintes itens de manutenção estão fora do prazo e precisam de atenção:</p>
    `

        for (const [machine, items] of Object.entries(groupedByMachine)) {
            emailHtml += `
        <div style="margin-top: 20px; padding: 15px; background: #fef2f2; border-radius: 8px; border: 1px solid #fee2e2;">
          <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #991b1b;">🏙️ ${machine}</h2>
          <ul style="margin: 0; padding-left: 20px;">
      `
            // @ts-ignore
            items.forEach((item: any) => {
                emailHtml += `
          <li style="margin-bottom: 8px; color: #4b5563;">
            <strong style="color: #111827;">${item.item_name}</strong><br>
            <span style="font-size: 12px; color: #6b7280;">Frequência: ${item.category_name} | Última: ${item.completed_at ? new Date(item.completed_at).toLocaleDateString('pt-BR') : 'Nunca'}</span>
          </li>
        `
            })
            emailHtml += `</ul></div>`
        }

        emailHtml += `
        <div style="margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center;">
          Este é um e-mail automático do sistema <strong>PlasPrint Manutenção</strong>.
        </div>
      </div>
    `

        // 4. Configurar Transporter e Enviar e-mail
        console.log('Configurando SMTP do Gmail...')
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: GMAIL_USER,
                pass: GMAIL_PASS,
            },
        })

        console.log('Enviando e-mail...')
        const info = await transporter.sendMail({
            from: `"PlasPrint Manutenção" <${GMAIL_USER}>`,
            to: ALERT_RECIPIENT,
            subject: `🚨 [URGENTE] ${overdueItems.length} Itens em Atraso - PlasPrint`,
            html: emailHtml,
        })

        console.log('E-mail enviado com sucesso. MessageID:', info.messageId)

        return new Response(JSON.stringify({
            message: 'Sucesso',
            items_alerted: overdueItems.length,
            message_id: info.messageId
        }), {
            headers: { 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('ERRO FATAL NA EXECUÇÃO:', error.message)
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
