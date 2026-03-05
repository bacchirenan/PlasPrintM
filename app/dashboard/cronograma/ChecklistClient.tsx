'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Machine, MaintenanceCategory, MaintenanceItem, MaintenanceLog, Profile, Rating } from '@/lib/types'
import { FREQUENCY_LABELS, RATING_LABELS } from '@/lib/types'

interface ChecklistClientProps {
    profile: Profile
    machines: Machine[]
    categories: MaintenanceCategory[]
    items: MaintenanceItem[]
    initialLogs: MaintenanceLog[]
}

/**
 * Verifica se o item está em atraso.
 * Só entra em atraso após `frequencyDays` dias desde a última conclusão.
 * Itens nunca realizados (lastLog = null) ficam em atraso imediatamente.
 */
/**
 * Verifica se o item está em atraso.
 */
function isItemOverdue(lastLog: MaintenanceLog | null, frequencyDays: number, frequency: string): boolean {
    if (!lastLog) return true

    const lastDate = new Date(lastLog.completed_at)
    const now = new Date()

    if (frequency === 'weekly' || frequency === 'biweekly') {
        const day = now.getDay() // 0-6
        const hour = now.getHours()

        if (frequency === 'weekly') {
            const lastFriday22h = new Date(now)
            const diff = day === 5 ? (hour >= 22 ? 0 : 7) : (day === 6 ? 1 : day + 2)
            lastFriday22h.setDate(now.getDate() - diff)
            lastFriday22h.setHours(22, 0, 0, 0)
            return lastDate < lastFriday22h
        }

        if (frequency === 'biweekly') {
            // A cada 1º e 3º sábado. Reinicia na sexta anterior às 22h.
            // Precisamos encontrar a sexta anterior mais próxima que precede o 1º ou 3º sábado.
            const getRefFridays = (date: Date) => {
                const year = date.getFullYear()
                const month = date.getMonth()
                const fridays = []
                // Buscar todas as sextas do mês
                for (let d = 1; d <= 31; d++) {
                    const temp = new Date(year, month, d, 22, 0, 0)
                    if (temp.getMonth() !== month) break
                    if (temp.getDay() === 5) { // Sexta
                        const sat = new Date(temp)
                        sat.setDate(sat.getDate() + 1)
                        // Verificamos se o sábado seguinte é o 1º ou 3º do mês
                        const dayOfMonth = sat.getDate()
                        const nthSat = Math.ceil(dayOfMonth / 7)
                        if (nthSat === 1 || nthSat === 3) fridays.push(new Date(temp))
                    }
                }
                return fridays
            }

            const currentMonthFridays = getRefFridays(now)
            const prevMonthDate = new Date(now); prevMonthDate.setMonth(now.getMonth() - 1)
            const prevMonthFridays = getRefFridays(prevMonthDate)
            const allFridays = [...prevMonthFridays, ...currentMonthFridays].sort((a, b) => b.getTime() - a.getTime())

            // A sexta de referência é a mais recente que já passou (ou é agora se for sexta > 22h)
            const refFriday = allFridays.find(f => f <= now)
            return refFriday ? lastDate < refFriday : true
        }

        if (frequency === 'quarterly') {
            // 1º Sábado de Março (3), Junho (6) e Novembro (11). Reinicia na sexta anterior às 22h.
            const getQuarterlyFridays = (date: Date) => {
                const year = date.getFullYear()
                const targetMonths = [2, 5, 10] // Meses 0-indexed: Março(2), Junho(5), Novembro(10)
                const fridays = []

                for (const month of targetMonths) {
                    // Verificamos o ano atual e o anterior para garantir que pegamos a última referência
                    for (const offsetYear of [year - 1, year]) {
                        for (let d = 1; d <= 7; d++) {
                            const temp = new Date(offsetYear, month, d, 22, 0, 0)
                            if (temp.getDay() === 5) { // Sexta
                                const sat = new Date(temp)
                                sat.setDate(sat.getDate() + 1)
                                if (sat.getDate() <= 7) { // Certifica que é o 1º sábado
                                    fridays.push(new Date(temp))
                                }
                            }
                        }
                    }
                }
                return fridays.sort((a, b) => b.getTime() - a.getTime())
            }

            const quarterlyFridays = getQuarterlyFridays(now)
            const refFriday = quarterlyFridays.find(f => f <= now)
            return refFriday ? lastDate < refFriday : true
        }

        if (frequency === 'semiannual') {
            // 1º Sábado de Fevereiro (2) e Agosto (8). Reinicia na sexta anterior às 22h.
            const getSemiannualFridays = (date: Date) => {
                const year = date.getFullYear()
                const targetMonths = [1, 7] // Meses 0-indexed: Fevereiro(1), Agosto(7)
                const fridays = []

                for (const month of targetMonths) {
                    for (const offsetYear of [year - 1, year]) {
                        for (let d = 1; d <= 7; d++) {
                            const temp = new Date(offsetYear, month, d, 22, 0, 0)
                            if (temp.getDay() === 5) { // Sexta
                                const sat = new Date(temp)
                                sat.setDate(sat.getDate() + 1)
                                if (sat.getDate() <= 7) { // 1º sábado
                                    fridays.push(new Date(temp))
                                }
                            }
                        }
                    }
                }
                return fridays.sort((a, b) => b.getTime() - a.getTime())
            }

            const semiannualFridays = getSemiannualFridays(now)
            const refFriday = semiannualFridays.find(f => f <= now)
            return refFriday ? lastDate < refFriday : true
        }
    }

    const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    return diffDays > frequencyDays
}

function formatTimeSince(log: MaintenanceLog | null): string {
    if (!log) return 'Nunca realizado'
    return formatDistanceToNow(new Date(log.completed_at), { addSuffix: true, locale: ptBR })
}

export function ChecklistClient({
    profile,
    machines,
    categories,
    items,
    initialLogs,
}: ChecklistClientProps) {
    const supabase = createClient()
    const { showToast } = useToast()
    const supabaseRef = useRef(supabase)

    const searchParams = useSearchParams()
    const machineIdFromUrl = searchParams.get('machineId')

    const [activeMachine, setActiveMachine] = useState<string>(machineIdFromUrl || machines[0]?.id || '')
    const [logs, setLogs] = useState<MaintenanceLog[]>(initialLogs)
    const [loadingItem, setLoadingItem] = useState<string | null>(null)
    const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

    const [pendingRatings, setPendingRatings] = useState<Record<string, Rating>>({})
    const [pendingObs, setPendingObs] = useState<Record<string, string>>({})

    // Atualizar máquina ativa se o parâmetro na URL mudar
    useEffect(() => {
        if (machineIdFromUrl && machineIdFromUrl !== activeMachine) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setActiveMachine(machineIdFromUrl)
        }
    }, [machineIdFromUrl, activeMachine])

    const isMaster = profile.role === 'master' || profile.role === 'admin'

    const toggleCategory = (categoryId: string) => {
        setExpandedCategories(prev => ({
            ...prev,
            [categoryId]: !prev[categoryId]
        }))
    }

    // ─── Supabase Realtime: escuta novos logs de QUALQUER usuário ────────────
    useEffect(() => {
        const client = supabaseRef.current

        const channel = client
            .channel('maintenance_logs_realtime')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'maintenance_logs' },
                async (payload) => {
                    // 1. Tentar buscar o log completo com Join
                    const { data, error } = await client
                        .from('maintenance_logs')
                        .select('*, user:profiles(id, full_name, email)')
                        .eq('id', payload.new.id)
                        .single()

                    if (error) {
                        // Fallback: Gerar um log "local" usando os dados do payload
                        const fallbackLog = {
                            ...(payload.new as MaintenanceLog),
                            user: { id: payload.new.user_id, full_name: 'Equipe', email: '' } as Profile
                        }

                        setLogs(prev => {
                            if (prev.some(l => l.id === fallbackLog.id)) return prev
                            return [fallbackLog, ...prev]
                        })
                        return
                    }

                    if (data) {
                        setLogs(prev => {
                            const newLog = data as MaintenanceLog
                            if (prev.some(l => l.id === newLog.id)) return prev
                            return [newLog, ...prev]
                        })
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'maintenance_logs' },
                (payload) => {
                    setLogs(prev => prev.map(l =>
                        l.id === payload.new.id ? { ...l, ...payload.new } : l
                    ))
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'maintenance_logs' },
                (payload) => {
                    setLogs(prev => prev.filter(l => l.id !== payload.old.id))
                }
            )
            .subscribe()

        return () => {
            client.removeChannel(channel)
        }
    }, [])

    // ─── Índice: último log por machine_id + item_id ─────────────────────────
    const latestLogs = useMemo(() => {
        const map: Record<string, MaintenanceLog> = {}
        // logs já vem ordenado por completed_at DESC
        for (const log of logs) {
            const key = `${log.machine_id}__${log.item_id}`
            if (!map[key]) map[key] = log
        }
        return map
    }, [logs])

    const getLatestLog = useCallback((machineId: string, itemId: string): MaintenanceLog | null => {
        return latestLogs[`${machineId}__${itemId}`] || null
    }, [latestLogs])

    // ─── Marcar item como concluído ──────────────────────────────────────────
    const handleCheck = useCallback(async (item: MaintenanceItem, machine: Machine) => {
        const key = `${machine.id}__${item.id}`
        const existingLog = getLatestLog(machine.id, item.id)
        const category = categories.find(c => c.id === item.category_id)

        // Se já foi concluído e ainda está no período, bloqueia nova marcação
        if (existingLog && category && !isItemOverdue(existingLog, category.frequency_days, category.frequency)) {
            const diasRestantes = Math.ceil(
                category.frequency_days - (Date.now() - new Date(existingLog.completed_at).getTime()) / (1000 * 60 * 60 * 24)
            )
            showToast(
                `Já concluído! Próxima limpeza em ${diasRestantes} dia(s).`,
                'info'
            )
            return
        }

        setLoadingItem(key)

        // INSERT
        const { error: insertError } = await supabase
            .from('maintenance_logs')
            .insert({
                machine_id: machine.id,
                item_id: item.id,
                user_id: profile.id,
                completed_at: new Date().toISOString(),
                rating: isMaster ? (pendingRatings[key] || null) : null,
                observation: isMaster ? (pendingObs[key] || null) : null,
            })

        if (insertError) {
            console.error('Erro Supabase INSERT:', insertError.code, insertError.message, insertError.details)
            setLoadingItem(null)
            showToast(`Erro ao registrar: ${insertError.message || 'Verifique permissões RLS'}`, 'error')
            return
        }

        // Buscar o log recém inserido com dados do usuário
        const { data, error: selectError } = await supabase
            .from('maintenance_logs')
            .select('*, user:profiles(id, full_name, email)')
            .eq('machine_id', machine.id)
            .eq('item_id', item.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .single()

        setLoadingItem(null)

        if (selectError || !data) {
            // Fallback local se o SELECT falhar (RLS pode bloquear retorno)
            const localLog: MaintenanceLog = {
                id: crypto.randomUUID(),
                machine_id: machine.id,
                item_id: item.id,
                user_id: profile.id,
                completed_at: new Date().toISOString(),
                rating: isMaster ? (pendingRatings[key] || null) : null,
                observation: isMaster ? (pendingObs[key] || null) : null,
                created_at: new Date().toISOString(),
                user: profile,
            }
            setLogs(prev => [localLog, ...prev])
        } else {
            setLogs(prev => {
                const newLog = data as MaintenanceLog
                if (prev.some(l => l.id === newLog.id)) return prev
                return [newLog, ...prev]
            })
        }

        showToast(`✓ ${item.name} concluído!`, 'success')

        // Limpa os campos master após conclusão
        if (isMaster) {
            setPendingRatings(prev => { const n = { ...prev }; delete n[key]; return n })
            setPendingObs(prev => { const n = { ...prev }; delete n[key]; return n })
        }
    }, [supabase, profile, categories, getLatestLog, isMaster, pendingRatings, pendingObs, showToast])

    // ─── Desmarcar item (Uncheck) ────────────────────────────────────────────
    const handleUncheck = useCallback(async (item: MaintenanceItem, machine: Machine) => {
        const key = `${machine.id}__${item.id}`
        const lastLog = getLatestLog(machine.id, item.id)

        if (!lastLog) return

        // Só permite desmarcar se for Master/Admin ou se foi o próprio usuário que marcou
        if (!isMaster && lastLog.user_id !== profile.id) {
            showToast('Você não tem permissão para desmarcar este item.', 'error')
            return
        }

        if (!confirm(`Deseja realmente desmarcar "${item.name}"?\nIsso removerá o registro feito por ${lastLog.user?.full_name || 'um usuário'}.`)) {
            return
        }

        setLoadingItem(key)

        // Tenta deletar pelo ID específico. Se falhar por ser um ID local/fantasma,
        // o Supabase retornará sucesso mas 0 linhas afetadas.
        const { error, count } = await supabase
            .from('maintenance_logs')
            .delete({ count: 'exact' })
            .eq('id', lastLog.id)

        if (error) {
            console.error('Erro ao deletar log:', error)
            showToast('Erro de permissão no banco de dados.', 'error')
            setLoadingItem(null)
            return
        }

        // Se o banco de dados não encontrou o item pelo ID (talvez ID local), 
        // tentamos uma limpeza geral do registro mais recente para essa máquina/item
        if (count === 0) {
            const { error: secondTryError } = await supabase
                .from('maintenance_logs')
                .delete()
                .eq('machine_id', machine.id)
                .eq('item_id', item.id)
                .eq('user_id', lastLog.user_id)
                .order('completed_at', { ascending: false })
                .limit(1)

            if (secondTryError) {
                showToast('Falha crítica ao remover registro.', 'error')
                setLoadingItem(null)
                return
            }
        }

        // Atualiza a tela imediatamente removendo TODOS os logs desse item para esta máquina
        // Isso evita que registros redundantes (cliques duplos) mantenham o item como "check"
        setLogs(prev => prev.filter(l => !(l.machine_id === machine.id && l.item_id === item.id)))

        setLoadingItem(null)
        showToast(`✓ Registro de ${item.name} removido com sucesso.`, 'success')
    }, [supabase, profile, isMaster, getLatestLog, showToast])

    // ─── Salvar avaliação em log já existente (somente master) ───────────────
    const handleUpdateLog = useCallback(async (logId: string, itemKey: string) => {
        const rating = pendingRatings[itemKey] || null
        const observation = pendingObs[itemKey] || null

        if (!rating && !observation) {
            showToast('Informe avaliação ou observação antes de salvar.', 'warning')
            return
        }

        const { error } = await supabase
            .from('maintenance_logs')
            .update({ rating, observation })
            .eq('id', logId)

        if (error) {
            showToast('Erro ao salvar avaliação.', 'error')
            return
        }

        setLogs(prev => prev.map(l =>
            l.id === logId ? { ...l, rating: rating as Rating | null, observation } : l
        ))
        showToast('Avaliação salva!', 'success')
    }, [supabase, pendingRatings, pendingObs, showToast])

    const currentMachine = machines.find(m => m.id === activeMachine)


    return (
        <div>


            {/* Tabs de máquinas */}
            <div className="machines-tabs" role="tablist" aria-label="Selecionar máquina">
                {machines.map(machine => {
                    return (
                        <button
                            key={machine.id}
                            role="tab"
                            aria-selected={activeMachine === machine.id}
                            className={`machine-tab ${activeMachine === machine.id ? 'active' : ''}`}
                            onClick={() => setActiveMachine(machine.id)}
                            id={`tab-machine-${machine.number}`}
                        >
                            {machine.type === 'room' || isNaN(Number(machine.number)) ? machine.name : `Máquina ${machine.number}`}
                        </button>
                    )
                })}
            </div>

            {/* Checklist por categoria */}
            {currentMachine && categories
                .filter(cat => {
                    // Remover frequências desnecessárias para máquinas específicas
                    if (currentMachine.number === 'ENCAB_CANUDOS' || currentMachine.number === 'TRANSFER_CANUDO') {
                        return cat.frequency === 'weekly' || (currentMachine.number === 'ENCAB_CANUDOS' && cat.frequency === 'quarterly')
                    }
                    return true
                })
                .map(category => {
                    const categoryItems = items.filter(i => {
                        const isCorrectCategory = i.category_id === category.id
                        const isCorrectTarget = i.target_type === 'both' || i.target_type === currentMachine.type
                        if (!isCorrectCategory || !isCorrectTarget) return false

                        // Lógica específica para a Encabeçadora e Transfer Canudo na categoria Semanal
                        if (category.frequency === 'weekly') {
                            if (currentMachine.number === 'ENCAB_CANUDOS') {
                                return i.name === 'Limpeza da Máquina' || i.name === 'Verificar Mangueira de Ar'
                            }
                            if (currentMachine.number === 'TRANSFER_CANUDO') {
                                return i.name === 'Limpeza da Máquina' || i.name === 'Verificar Rolo de Silicone'
                            }
                        }

                        // Lógica específica para a Encabeçadora na categoria Trimestral
                        if (currentMachine.number === 'ENCAB_CANUDOS' && category.frequency === 'quarterly') {
                            // Mostrar apenas o item de lubrificação (que será renomeado na tela)
                            return i.name === 'Lubrificar Trilho do Carro'
                        }

                        // Esconder itens específicos de outras máquinas
                        if (currentMachine.number !== 'ENCAB_CANUDOS' && i.name === 'Verificar Mangueira de Ar') {
                            return false
                        }
                        if (currentMachine.number !== 'TRANSFER_CANUDO' && i.name === 'Verificar Rolo de Silicone') {
                            return false
                        }

                        // Lógica para Limpeza dos Sensores de Material (Apenas máquinas 28, 29, 180, 181, 182)
                        const isMainMachine = ['28', '29', '180', '181', '182'].includes(currentMachine.number)
                        if (i.name === 'Limpeza dos Sensores de Material' && !isMainMachine) {
                            return false
                        }

                        return true
                    })
                    // Remover duplicatas caso o banco ainda as tenha (Garantia extra no Frontend)
                    const uniqueItems = Array.from(new Map(categoryItems.map(item => [item.name, item])).values())

                    if (uniqueItems.length === 0) return null

                    const isExpanded = expandedCategories[category.id] || false

                    // Cálculo do progresso
                    const totalItems = uniqueItems.length
                    const completedItems = uniqueItems.filter(item => {
                        const lastLog = getLatestLog(currentMachine.id, item.id)
                        return !isItemOverdue(lastLog, category.frequency_days, category.frequency)
                    }).length
                    const percent = Math.round((completedItems / totalItems) * 100)

                    return (
                        <div key={category.id} className={`checklist-section card ${isExpanded ? 'is-expanded' : 'is-collapsed'}`} style={{ marginBottom: '16px', padding: 0 }}>
                            <div
                                className="checklist-section-header"
                                onClick={() => toggleCategory(category.id)}
                                style={{ cursor: 'pointer', padding: '16px 20px', userSelect: 'none' }}
                            >
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '120px' }}>
                                    <span className={`frequency-badge ${category.frequency}`}>
                                        {FREQUENCY_LABELS[category.frequency]}
                                    </span>
                                    {/* Mini Barra de Status */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                            {percent}% Concluído
                                        </span>
                                        <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${percent}%`,
                                                height: '100%',
                                                background: percent > 80 ? 'var(--success)' : percent > 50 ? 'var(--warning)' : 'var(--danger)',
                                                transition: 'width 0.5s ease'
                                            }} />
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        A cada {category.frequency_days} dias
                                    </span>
                                    <span className="expand-icon" style={{
                                        transition: 'transform 0.3s ease',
                                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                        opacity: 0.6
                                    }}>
                                        ▼
                                    </span>
                                </div>
                            </div>

                            <div className="checklist-collapsible-wrapper" style={{
                                maxHeight: isExpanded ? '2000px' : '0',
                                overflow: 'hidden',
                                transition: 'max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease',
                                opacity: isExpanded ? 1 : 0
                            }}>
                                <div className="checklist-items" role="list" style={{ padding: '0 20px 20px 20px' }}>
                                    {uniqueItems.map(item => {
                                        const lastLog = getLatestLog(currentMachine.id, item.id)
                                        const overdue = isItemOverdue(lastLog, category.frequency_days, category.frequency)
                                        const isCompleted = !overdue
                                        const itemKey = `${currentMachine.id}__${item.id}`
                                        const isLoading = loadingItem === itemKey

                                        // Alterar nomes especificamente para a Encabeçadora e máquinas principais
                                        let displayName = item.name;
                                        const isMainMachine = ['28', '29', '180', '181', '182'].includes(currentMachine.number);
                                        const isEncab = currentMachine.number === 'ENCAB_CANUDOS';

                                        if ((isMainMachine || isEncab) && item.name === 'Lubrificar Trilho do Carro') {
                                            displayName = 'Lubrificar pontos de Graxa';
                                        }

                                        return (
                                            <div
                                                key={item.id}
                                                className={`checklist-item ${isCompleted ? 'completed' : ''} ${overdue ? 'overdue' : ''}`}
                                                role="listitem"
                                                id={`item-${item.id}`}
                                            >
                                                {/* Checkbox */}
                                                <div className="custom-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        id={`chk-${currentMachine.id}-${item.id}`}
                                                        checked={isCompleted}
                                                        onChange={() => {
                                                            if (isCompleted) {
                                                                handleUncheck(item, currentMachine)
                                                            } else {
                                                                handleCheck(item, currentMachine)
                                                            }
                                                        }}
                                                        disabled={isLoading}
                                                        aria-label={`Marcar ${displayName} como concluído`}
                                                    />
                                                    <div className="checkbox-visual">
                                                        {isLoading ? (
                                                            <span className="spinner" style={{ width: '10px', height: '10px' }} />
                                                        ) : (
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Conteúdo */}
                                                <div className="checklist-item-content">
                                                    <div className="checklist-item-name">{displayName}</div>
                                                    <div className="checklist-item-meta">
                                                        <span>🕐 {formatTimeSince(lastLog)}</span>
                                                        {lastLog && (
                                                            <span className="user-tag">
                                                                👤 {(lastLog.user as Profile | undefined)?.full_name
                                                                    || (lastLog.user as Profile | undefined)?.email?.split('@')[0]
                                                                    || 'Usuário'}
                                                            </span>
                                                        )}
                                                        {overdue && (
                                                            <span className="overdue-tag">Em atraso</span>
                                                        )}
                                                        {isCompleted && (lastLog?.rating || lastLog?.observation) && (
                                                            <div style={{
                                                                marginTop: '6px',
                                                                padding: '8px 12px',
                                                                background: 'rgba(255,255,255,0.03)',
                                                                borderRadius: '6px',
                                                                borderLeft: `3px solid ${lastLog.rating === 'otimo' ? 'var(--success)' :
                                                                    lastLog.rating === 'bom' ? 'var(--warning)' :
                                                                        lastLog.rating === 'ruim' ? 'var(--danger)' : 'var(--border)'}`
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: lastLog.observation ? '4px' : '0' }}>
                                                                    {lastLog.rating && (
                                                                        <span style={{
                                                                            fontSize: '11px',
                                                                            fontWeight: 700,
                                                                            color: lastLog.rating === 'otimo' ? 'var(--success)' :
                                                                                lastLog.rating === 'bom' ? 'var(--warning)' : 'var(--danger)',
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            ⭐ {RATING_LABELS[lastLog.rating]}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {lastLog.observation && (
                                                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                                                        &quot; {lastLog.observation} &quot;
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Campos master */}
                                                    {isMaster && (
                                                        <div className="master-fields">
                                                            <div className="rating-group" role="group" aria-label="Avaliação">
                                                                {(['ruim', 'bom', 'otimo'] as Rating[]).map(r => (
                                                                    <button
                                                                        key={r}
                                                                        className={`rating-btn ${r} ${pendingRatings[itemKey] === r ? 'selected' : ''}`}
                                                                        onClick={() => setPendingRatings(prev => ({
                                                                            ...prev,
                                                                            [itemKey]: prev[itemKey] === r ? '' as Rating : r,
                                                                        }))}
                                                                        aria-pressed={pendingRatings[itemKey] === r}
                                                                        title={RATING_LABELS[r]}
                                                                    >
                                                                        {RATING_LABELS[r]}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                className="observation-input"
                                                                placeholder="Observação (opcional)"
                                                                value={pendingObs[itemKey] || ''}
                                                                onChange={e => setPendingObs(prev => ({ ...prev, [itemKey]: e.target.value }))}
                                                                aria-label="Observação"
                                                            />
                                                            {lastLog && (pendingRatings[itemKey] || pendingObs[itemKey]) && (
                                                                <button
                                                                    className="btn btn-sm btn-secondary"
                                                                    onClick={() => handleUpdateLog(lastLog.id, itemKey)}
                                                                >
                                                                    Salvar avaliação
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )
                })}
        </div>
    )
}

