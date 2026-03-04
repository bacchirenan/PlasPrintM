'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { Machine, Profile, MachineEvent, InventoryItem } from '@/lib/types'

interface HistoricoClientProps {
    profile: Profile
    machines: Machine[]
    events: MachineEvent[]
}

const EVENT_TYPES = ['occurrence', 'maintenance', 'error'] as const
type EventType = typeof EVENT_TYPES[number]

const TYPE_CONFIG: Record<EventType | 'part_change', { label: string; icon: string; color: string; bg: string }> = {
    occurrence: { label: 'Ocorrência', icon: '📝', color: 'var(--primary-accent)', bg: 'rgba(58, 134, 255, 0.1)' },
    maintenance: { label: 'Manutenção', icon: '🔧', color: '#ff9f1c', bg: 'rgba(255, 159, 28, 0.1)' },
    error: { label: 'Erro', icon: '🚨', color: 'var(--danger)', bg: 'rgba(230, 57, 70, 0.1)' },
    part_change: { label: 'Troca de Peça', icon: '⚙️', color: 'var(--success)', bg: 'rgba(16, 185, 129, 0.1)' },
}

export function HistoricoClient({ profile, machines, events: initialEvents }: HistoricoClientProps) {
    const supabase = createClient()
    const { showToast } = useToast()

    const [activeTab, setActiveTab] = useState<string>(machines[0]?.id || '')
    const [localEvents, setLocalEvents] = useState<MachineEvent[]>(initialEvents)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [description, setDescription] = useState('')
    const [modalEventType, setModalEventType] = useState<'occurrence' | 'maintenance' | 'error'>('occurrence')
    const [isSaving, setIsSaving] = useState(false)
    const [searchText, setSearchText] = useState('')

    // Estados para Edição e Imagens
    const [editingId, setEditingId] = useState<string | null>(null)
    const [imageUrl, setImageUrl] = useState<string>('')
    const [uploading, setUploading] = useState(false)

    // Estados para Troca de Peça
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([])
    const [selectedParts, setSelectedParts] = useState<{ id: string; quantity: number }[]>([])
    const [isSelectingPiece, setIsSelectingPiece] = useState(false)
    const [pieceSearch, setPieceSearch] = useState('')

    const currentMachine = machines.find(m => m.id === activeTab)
    const isMaster = profile.role === 'master' || profile.role === 'admin'

    const machineName = currentMachine
        ? (currentMachine.type === 'room' || isNaN(Number(currentMachine.number))
            ? currentMachine.name
            : `Máquina ${currentMachine.number}`)
        : ''

    const pieceItems = useMemo(() => {
        const itemsToFilter = inventoryItems.filter(item => {
            const machineNum = currentMachine?.number
            const isNumericMachine = machineNum && ['28', '29', '180', '181', '182'].includes(machineNum)
            if (isNumericMachine) {
                const loc = (item.location || '').toLowerCase()
                const name = (item.name || '').toLowerCase()
                return loc.includes('dacen') || name.includes('dacen')
            } else {
                const loc = (item.location || '').toLowerCase()
                const machineName = (currentMachine?.name || '').toLowerCase()
                return loc.includes(machineName)
            }
        })
        if (!pieceSearch) return itemsToFilter
        return itemsToFilter.filter(item =>
            item.name.toLowerCase().includes(pieceSearch.toLowerCase()) ||
            (item.code && item.code.toLowerCase().includes(pieceSearch.toLowerCase()))
        )
    }, [inventoryItems, pieceSearch, currentMachine])

    const fetchInventory = useCallback(async () => {
        const { data, error } = await supabase
            .from('inventory_items')
            .select('*')
            .eq('category', 'peca')
            .order('name')
        if (!error && data) setInventoryItems(data)
    }, [supabase])

    useEffect(() => { fetchInventory() }, [fetchInventory])

    // Agrupa os eventos da máquina ativa por tipo
    const eventsByType = useMemo(() => {
        const machineEvents = localEvents.filter(e => e.machine_id === activeTab)

        const parentEvents = machineEvents.filter(e => !e.description?.startsWith('[LinkedTo:') && !e.description?.includes('Peça adicional vinculada ao registro acima.'))
        const groupedEvents: (MachineEvent & { extraParts?: MachineEvent[] })[] = [];

        for (const parent of parentEvents) {
            const extraParts = machineEvents.filter(e =>
                e.description?.includes(`[LinkedTo:${parent.id}]`) ||
                (e.description?.includes('Peça adicional vinculada ao registro acima.') &&
                    e.event_type === parent.event_type && e.user_id === parent.user_id &&
                    Math.abs(new Date(e.created_at).getTime() - new Date(parent.created_at).getTime()) < 10000)
            );
            groupedEvents.push({ ...parent, extraParts });
        }

        const result: Record<string, typeof groupedEvents> = {
            occurrence: [],
            maintenance: [],
            error: [],
        }

        for (const e of groupedEvents) {
            const mapped = e.event_type === 'part_change' ? 'occurrence' : e.event_type
            if (result[mapped]) result[mapped].push(e)
        }

        // Aplica filtro de busca e ordena por data desc
        const term = searchText.toLowerCase()
        for (const key of Object.keys(result)) {
            result[key] = result[key]
                .filter(e => {
                    if (!term) return true
                    const desc = (e.description || '').toLowerCase()
                    const type = (e.event_type || '').toLowerCase()
                    const user = ((e.user as { full_name?: string })?.full_name || '').toLowerCase()
                    return desc.includes(term) || type.includes(term) || user.includes(term)
                })
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        }
        return result
    }, [localEvents, activeTab, searchText])

    const handleOpenModal = (item?: MachineEvent & { extraParts?: MachineEvent[] }, defaultType?: EventType) => {
        if (item) {
            setEditingId(item.id)
            setDescription(item.description || '')
            setImageUrl(item.image_url || '')
            const parts: { id: string; quantity: number }[] = []
            if (item.inventory_item_id) parts.push({ id: item.inventory_item_id, quantity: item.quantity_used || 1 })
            if (item.extraParts) {
                for (const xp of item.extraParts) {
                    if (xp.inventory_item_id) parts.push({ id: xp.inventory_item_id, quantity: xp.quantity_used || 1 })
                }
            }
            setSelectedParts(parts)
            setModalEventType(item.event_type === 'part_change' ? 'occurrence' : item.event_type || 'occurrence')
        } else {
            setEditingId(null)
            setDescription('')
            setImageUrl('')
            setSelectedParts([])
            setModalEventType(defaultType || 'occurrence')
        }
        setIsSelectingPiece(false)
        setIsModalOpen(true)
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const filePath = `events/${Math.random()}.${fileExt}`
            const { error: uploadError } = await supabase.storage.from('attachments').upload(filePath, file)
            if (uploadError) throw uploadError
            const { data: { publicUrl } } = supabase.storage.from('attachments').getPublicUrl(filePath)
            setImageUrl(publicUrl)
            showToast('Imagem carregada!', 'success')
        } catch (error: unknown) {
            const err = error as Error
            showToast('Erro ao carregar imagem: ' + err.message, 'error')
        } finally {
            setUploading(false)
        }
    }

    const handleDeleteOccurrence = async (id: string, extraParts?: MachineEvent[]) => {
        if (!confirm('Tem certeza que deseja apagar este registro? Se houver troca de peça vinculada, as peças serão estornadas para o estoque.')) return
        try {
            const eventToDelete = localEvents.find(e => e.id === id)
            if (!eventToDelete) return;
            // Acha dependências se não passadas (caso chamado de outro local)
            let deps = extraParts
            if (!deps) {
                deps = localEvents.filter(e =>
                    e.description?.includes(`[LinkedTo:${id}]`) ||
                    (e.description?.includes('Peça adicional vinculada ao registro acima.') &&
                        e.event_type === eventToDelete.event_type && e.user_id === eventToDelete.user_id &&
                        Math.abs(new Date(e.created_at).getTime() - new Date(eventToDelete.created_at).getTime()) < 10000)
                )
            }

            const eventsToDel = [eventToDelete, ...(deps || [])]
            for (const ev of eventsToDel) {
                if (ev.inventory_item_id && (ev.quantity_used || 0) > 0) {
                    const { data: currentItem, error: fetchError } = await supabase
                        .from('inventory_items').select('quantity').eq('id', ev.inventory_item_id).single()
                    if (!fetchError && currentItem) {
                        const newQuantity = currentItem.quantity + (ev.quantity_used || 0)
                        await supabase.from('inventory_items').update({ quantity: newQuantity }).eq('id', ev.inventory_item_id)
                        setInventoryItems(prev => prev.map(i =>
                            i.id === ev.inventory_item_id ? { ...i, quantity: newQuantity } : i
                        ))
                    }
                }
                const { error } = await supabase.from('machine_events').delete().eq('id', ev.id)
                if (error) throw error
            }
            setLocalEvents(prev => prev.filter(e => !eventsToDel.find(del => del.id === e.id)))
            showToast('Registro removido com sucesso!', 'success')
        } catch (error: unknown) {
            const err = error as Error
            showToast('Erro ao excluir: ' + err.message, 'error')
        }
    }

    const handleSaveOccurrence = async () => {
        if (!description.trim()) {
            showToast('Por favor, descreva o registro. A descrição é obrigatória.', 'warning')
            return
        }
        setIsSaving(true)
        try {
            const deltas = new Map<string, number>(); // ID -> Delta (increment/decrement)

            // 1. Calculate Old Quantities (if editing)
            const existingParent = editingId ? localEvents.find(e => e.id === editingId) : null;
            const existingExtras = editingId ? localEvents.filter(e =>
                e.description?.includes(`[LinkedTo:${editingId}]`) ||
                (e.description?.includes('Peça adicional vinculada ao registro acima.') &&
                    e.event_type === existingParent?.event_type && e.user_id === existingParent?.user_id &&
                    Math.abs(new Date(e.created_at).getTime() - new Date(existingParent!.created_at).getTime()) < 10000)
            ) : [];

            if (existingParent?.inventory_item_id) {
                const id = existingParent.inventory_item_id;
                deltas.set(id, (deltas.get(id) || 0) + (existingParent.quantity_used || 0));
            }
            for (const ex of existingExtras) {
                if (ex.inventory_item_id) {
                    const id = ex.inventory_item_id;
                    deltas.set(id, (deltas.get(id) || 0) + (ex.quantity_used || 0));
                }
            }

            // 2. Calculate New Quantities
            for (const part of selectedParts) {
                deltas.set(part.id, (deltas.get(part.id) || 0) - part.quantity);
            }

            // 3. Stock Check (Fresh check against DB + what we are releasing)
            for (const [itemId, delta] of deltas.entries()) {
                if (delta < 0) { // We are using more than we had
                    const { data: dbItem } = await supabase.from('inventory_items').select('name, quantity').eq('id', itemId).single();
                    if (dbItem) {
                        if (dbItem.quantity + delta < 0) {
                            showToast(`Quantidade insuficiente em estoque para ${dbItem.name}. Disponível: ${dbItem.quantity}, Necessário adicional: ${Math.abs(delta)}`, 'error');
                            setIsSaving(false);
                            return;
                        }
                    }
                }
            }

            const eventType = modalEventType

            if (editingId) {
                // Delete existing extras FIRST before inserting new ones
                for (const ex of existingExtras) {
                    await supabase.from('machine_events').delete().eq('id', ex.id)
                }

                const part = selectedParts[0]
                const { data, error } = await supabase
                    .from('machine_events')
                    .update({
                        description: description.trim(),
                        image_url: imageUrl,
                        inventory_item_id: part?.id || null,
                        quantity_used: part ? part.quantity : 0,
                        event_type: eventType
                    })
                    .eq('id', editingId)
                    .select('*, user:profiles(id, full_name, email)').single()
                if (error) throw error

                let newEvents: MachineEvent[] = []
                for (let i = 1; i < selectedParts.length; i++) {
                    const extraPart = selectedParts[i]
                    const { data: newData, error: newError } = await supabase
                        .from('machine_events')
                        .insert({
                            machine_id: activeTab,
                            user_id: profile.id,
                            event_type: eventType,
                            description: `[LinkedTo:${editingId}] Peça adicional vinculada ao registro acima.`,
                            image_url: '',
                            inventory_item_id: extraPart.id,
                            quantity_used: extraPart.quantity
                        })
                        .select('*, user:profiles(id, full_name, email)').single()
                    if (newError) throw newError
                    newEvents.push(newData as MachineEvent)
                }

                // Apply deltas to DB
                for (const [itemId, delta] of deltas.entries()) {
                    if (delta === 0) continue;
                    const { data: item } = await supabase.from('inventory_items').select('quantity').eq('id', itemId).single();
                    if (item) {
                        await supabase.from('inventory_items').update({ quantity: item.quantity + delta }).eq('id', itemId);
                    }
                }

                await fetchInventory()
                setLocalEvents(prev => {
                    const clean = prev.filter(e => e.id !== editingId && !existingExtras.find(ex => ex.id === e.id))
                    return [data as MachineEvent, ...newEvents, ...clean]
                })
                showToast('Registro atualizado com sucesso!', 'success')
            } else {
                const newEvents: MachineEvent[] = []
                let rootId = '';

                if (selectedParts.length === 0) {
                    const { data, error } = await supabase
                        .from('machine_events')
                        .insert({
                            machine_id: activeTab,
                            user_id: profile.id,
                            event_type: eventType,
                            description: description.trim(),
                            image_url: imageUrl,
                            inventory_item_id: null,
                            quantity_used: 0
                        })
                        .select('*, user:profiles(id, full_name, email)').single()
                    if (error) throw error
                    newEvents.push(data as MachineEvent)
                } else {
                    for (let i = 0; i < selectedParts.length; i++) {
                        const part = selectedParts[i]
                        const isFirst = i === 0

                        const { data, error } = await supabase
                            .from('machine_events')
                            .insert({
                                machine_id: activeTab,
                                user_id: profile.id,
                                event_type: eventType,
                                description: isFirst ? description.trim() : `[LinkedTo:${rootId}] Peça adicional vinculada ao registro acima.`,
                                image_url: isFirst ? imageUrl : '',
                                inventory_item_id: part.id,
                                quantity_used: part.quantity
                            })
                            .select('*, user:profiles(id, full_name, email)').single()
                        if (error) throw error
                        if (isFirst) rootId = data.id;
                        newEvents.push(data as MachineEvent)
                    }
                }

                // Apply deltas to DB
                for (const [itemId, delta] of deltas.entries()) {
                    if (delta === 0) continue;
                    const { data: item } = await supabase.from('inventory_items').select('quantity').eq('id', itemId).single();
                    if (item) {
                        await supabase.from('inventory_items').update({ quantity: item.quantity + delta }).eq('id', itemId);
                    }
                }

                await fetchInventory() // sync total
                setLocalEvents(prev => [...newEvents, ...prev])
                showToast('Registro realizado com sucesso!', 'success')
            }
            setDescription(''); setImageUrl(''); setSelectedParts([]); setEditingId(null); setIsModalOpen(false)
        } catch (error: unknown) {
            const err = error as { message?: string }
            const errorMsg = err?.message || JSON.stringify(err)
            showToast('Erro ao salvar: ' + errorMsg, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="historico-container">
            {/* Abas das Máquinas */}
            <div className="machines-tabs" style={{ marginBottom: '20px' }}>
                {machines.map(machine => (
                    <button
                        key={machine.id}
                        className={`machine-tab ${activeTab === machine.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(machine.id)}
                    >
                        {machine.type === 'room' || isNaN(Number(machine.number)) ? machine.name : `Máquina ${machine.number}`}
                    </button>
                ))}
            </div>

            {/* Barra de ações */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <div style={{ position: 'relative', flex: '1', maxWidth: '360px' }}>
                    <input
                        type="text"
                        placeholder="Buscar no histórico..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{
                            width: '100%', padding: '10px 16px',
                            background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-card)',
                            borderRadius: '30px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Grid com 3 colunas — uma por categoria */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '20px',
                alignItems: 'start'
            }}>
                {(EVENT_TYPES).map(type => {
                    const cfg = TYPE_CONFIG[type]
                    const events = eventsByType[type] || []
                    return (
                        <div key={type} className="card" style={{ padding: '0', overflow: 'hidden' }}>
                            {/* Cabeçalho da coluna */}
                            <div style={{
                                padding: '14px 20px',
                                borderBottom: '1px solid var(--border-card)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                background: cfg.bg
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '18px' }}>{cfg.icon}</span>
                                    <span style={{ fontWeight: 700, fontSize: '14px', color: cfg.color }}>{cfg.label}</span>
                                </div>
                                <span style={{
                                    background: cfg.bg, color: cfg.color,
                                    border: `1px solid ${cfg.color}`,
                                    borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                                    padding: '2px 9px'
                                }}>{events.length}</span>
                            </div>

                            {/* Botão rápido Adicionar */}
                            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-card)' }}>
                                <button
                                    onClick={() => handleOpenModal(undefined, type)}
                                    style={{
                                        width: '100%', padding: '7px', fontSize: '12px',
                                        background: 'transparent', border: `1px dashed ${cfg.color}`,
                                        borderRadius: '6px', color: cfg.color, cursor: 'pointer',
                                        fontWeight: 600, transition: 'var(--transition)'
                                    }}
                                >
                                    + Adicionar {cfg.label}
                                </button>
                            </div>

                            {/* Lista de eventos */}
                            <div style={{ maxHeight: '520px', overflowY: 'auto', padding: events.length === 0 ? '0' : '12px 16px' }}>
                                {events.length === 0 ? (
                                    <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                                        <div style={{ fontSize: '28px', marginBottom: '8px' }}>📂</div>
                                        Nenhum registro de {cfg.label.toLowerCase()}
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {events.map((e) => {
                                            const piece = e.inventory_item_id ? inventoryItems.find(i => i.id === e.inventory_item_id) : null
                                            const isPartChange = e.event_type === 'part_change'
                                            const user = (e.user as { full_name?: string })?.full_name || 'Usuário'

                                            const allPiecesOfEvent = piece ? [{ item: piece, qty: e.quantity_used }] : [];
                                            if (e.extraParts) {
                                                for (const xp of e.extraParts) {
                                                    const xpPiece = xp.inventory_item_id ? inventoryItems.find(i => i.id === xp.inventory_item_id) : null;
                                                    if (xpPiece) allPiecesOfEvent.push({ item: xpPiece, qty: xp.quantity_used });
                                                }
                                            }

                                            return (
                                                <div key={e.id} style={{
                                                    background: 'rgba(255,255,255,0.02)',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    borderRadius: 'var(--radius-md)',
                                                    padding: '12px 14px',
                                                }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            {isPartChange && (
                                                                <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                                                    ⚙️ Troca de Peça
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                                {format(new Date(e.created_at), 'dd/MM/yy HH:mm')}
                                                            </span>
                                                            <button
                                                                onClick={() => handleOpenModal(e)}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: 0.6, padding: '2px' }}
                                                                title="Editar"
                                                            >✏️</button>
                                                            {isMaster && (
                                                                <button
                                                                    onClick={() => handleDeleteOccurrence(e.id, e.extraParts)}
                                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', opacity: 0.6, padding: '2px' }}
                                                                    title="Apagar"
                                                                >🗑️</button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div style={{ fontSize: '11px', color: cfg.color, fontWeight: 600, marginBottom: '6px' }}>
                                                        👤 {user}
                                                    </div>

                                                    {e.description && (
                                                        <div style={{
                                                            fontSize: '13px', lineHeight: '1.5',
                                                            color: 'var(--text-secondary)',
                                                            whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                                                        }}>
                                                            {e.description}
                                                        </div>
                                                    )}

                                                    {allPiecesOfEvent.length > 0 && (
                                                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            {allPiecesOfEvent.map((p, idx) => (
                                                                <div key={idx} style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                                                                    ⚙️ {p.item.name} ({p.qty} un)
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {e.image_url && (
                                                        <div style={{ marginTop: '8px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-card)', width: 'fit-content', maxWidth: '100%' }}>
                                                            <img src={e.image_url} alt="Anexo" style={{ maxWidth: '100%', maxHeight: '180px', display: 'block', objectFit: 'contain' }} />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Modal de Incluir/Editar */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">{editingId ? 'Editar Registro' : 'Registrar Informação'}</h3>
                            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                {editingId ? 'Atualize os detalhes do registro.' : `Selecione o tipo e descreva o que aconteceu na ${machineName}.`}
                            </p>

                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                                Tipo de Informação
                            </label>
                            <select
                                value={modalEventType}
                                onChange={e => {
                                    const val = e.target.value as EventType
                                    setModalEventType(val)
                                    if (val !== 'maintenance') { setSelectedParts([]); setIsSelectingPiece(false) }
                                }}
                                style={{
                                    width: '100%', padding: '10px 12px',
                                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)', color: 'var(--text-primary)',
                                    fontSize: '14px', outline: 'none', marginBottom: '16px', cursor: 'pointer'
                                }}
                                disabled={selectedParts.length > 0}
                            >
                                <option value="occurrence">Ocorrência</option>
                                <option value="maintenance">Manutenção de Máquina</option>
                                <option value="error">Erro</option>
                                {selectedParts.length > 0 && <option value="part_change">Troca de Peça</option>}
                            </select>

                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                                Descrição Detalhada
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Digite aqui os detalhes do registro..."
                                style={{
                                    width: '100%', minHeight: isSelectingPiece ? '80px' : '150px',
                                    maxHeight: '200px', background: 'var(--bg-input)',
                                    border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                    padding: '12px', color: 'var(--text-primary)', fontSize: '14px',
                                    resize: 'none', outline: 'none', marginBottom: '16px'
                                }}
                            />

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <label className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
                                    <span>📷</span> {uploading ? 'Carregando...' : 'Anexar Imagem'}
                                    <input type="file" accept="image/*" hidden onChange={handleImageUpload} disabled={uploading} />
                                </label>
                                {modalEventType === 'maintenance' && (
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center', border: selectedParts.length > 0 ? '1px solid var(--primary-accent)' : '1px solid var(--border)' }}
                                        onClick={() => setIsSelectingPiece(!isSelectingPiece)}
                                    >
                                        ⚙️ {selectedParts.length > 0 ? 'Adicionar mais peças' : 'Adicionar Peça'}
                                    </button>
                                )}
                            </div>

                            {isSelectingPiece && (
                                <div className="card" style={{ marginBottom: '16px', background: 'rgba(0,0,0,0.2)', padding: '12px' }}>
                                    <input
                                        type="text"
                                        placeholder="Buscar peça por nome ou código..."
                                        className="observation-input"
                                        style={{ fontSize: '13px', padding: '8px 12px', marginBottom: '8px' }}
                                        value={pieceSearch}
                                        onChange={e => setPieceSearch(e.target.value)}
                                        autoFocus
                                    />
                                    <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '4px', background: 'rgba(0,0,0,0.1)' }}>
                                        {pieceItems.map(item => (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedParts(prev => {
                                                        if (prev.find(p => p.id === item.id)) return prev;
                                                        return [...prev, { id: item.id, quantity: 1 }];
                                                    });
                                                    setIsSelectingPiece(false);
                                                }}
                                                style={{
                                                    padding: '8px 12px', fontSize: '13px', cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    background: selectedParts.find(p => p.id === item.id) ? 'rgba(58, 134, 255, 0.1)' : 'transparent',
                                                    display: 'flex', alignItems: 'center', gap: '12px'
                                                }}
                                            >
                                                {item.image_url ? (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                                                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, border: '1px solid var(--border)' }}>🖼️</div>
                                                )}
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.code || 'S/ Cod'}</div>
                                                </div>
                                                <div style={{ fontSize: '11px', color: item.quantity <= (item.min_quantity || 0) ? 'var(--danger)' : 'var(--text-muted)' }}>
                                                    Estoque: {item.quantity}
                                                </div>
                                            </div>
                                        ))}
                                        {pieceItems.length === 0 && (
                                            <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                                                Nenhuma peça encontrada.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedParts.length > 0 && !isSelectingPiece && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                                    {selectedParts.map((part, index) => {
                                        const invItem = inventoryItems.find(i => i.id === part.id)
                                        return (
                                            <div key={part.id} style={{
                                                padding: '12px',
                                                background: 'rgba(58, 134, 255, 0.05)', border: '1px solid var(--primary-accent)',
                                                borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '12px'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-accent)', fontWeight: 800, marginBottom: '2px' }}>Peça Selecionada {index + 1}</div>
                                                    <div style={{ fontSize: '14px', fontWeight: 600 }}>{invItem?.name}</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{ textAlign: 'right', marginRight: '8px' }}>
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disponível</div>
                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: (invItem?.quantity || 0) < part.quantity ? 'var(--danger)' : 'var(--success)' }}>
                                                            {invItem?.quantity || 0} un
                                                        </div>
                                                    </div>
                                                    <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qtd:</label>
                                                    <input
                                                        type="number"
                                                        value={part.quantity}
                                                        onChange={e => {
                                                            const newQty = Math.max(1, parseInt(e.target.value) || 1)
                                                            setSelectedParts(prev => prev.map(p => p.id === part.id ? { ...p, quantity: newQty } : p))
                                                        }}
                                                        style={{
                                                            width: '60px', padding: '6px',
                                                            background: 'var(--bg-card)',
                                                            border: (invItem?.quantity || 0) < part.quantity ? '2px solid var(--danger)' : '1px solid var(--border)',
                                                            color: 'var(--text-primary)', borderRadius: '4px',
                                                            textAlign: 'center', fontSize: '14px', fontWeight: 700
                                                        }}
                                                    />
                                                    <button
                                                        onClick={() => setSelectedParts(prev => prev.filter(p => p.id !== part.id))}
                                                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--danger)' }}
                                                        title="Remover peça"
                                                    >🗑️</button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}

                            {imageUrl && (
                                <div style={{ marginBottom: '16px', position: 'relative', width: 'fit-content' }}>
                                    <img src={imageUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                                    <button
                                        onClick={() => setImageUrl('')}
                                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}
                                    >×</button>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => { setIsModalOpen(false); setEditingId(null); setDescription(''); setImageUrl('') }}>Cancelar</button>
                            <button className="btn-primary" onClick={handleSaveOccurrence} disabled={isSaving || uploading}>
                                {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar Registro'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
