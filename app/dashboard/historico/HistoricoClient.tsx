'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { Machine, Profile, MachineEvent, InventoryItem } from '@/lib/types'
import { FREQUENCY_LABELS } from '@/lib/types'

interface HistoricoClientProps {
    profile: Profile
    machines: Machine[]
    events: MachineEvent[]
}

export function HistoricoClient({ profile, machines, events: initialEvents }: HistoricoClientProps) {
    const supabase = createClient()
    const { showToast } = useToast()

    const [activeTab, setActiveTab] = useState<string>(machines[0]?.id || '')
    const [activeSubTab, setActiveSubTab] = useState<'ocorrencia' | 'manutencao' | 'erro'>('ocorrencia')
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
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
    const [quantityUsed, setQuantityUsed] = useState<number>(1)
    const [isSelectingPiece, setIsSelectingPiece] = useState(false)
    const [pieceSearch, setPieceSearch] = useState('')

    const currentMachine = machines.find(m => m.id === activeTab)

    const isMaster = profile.role === 'master' || profile.role === 'admin'

    const pieceItems = useMemo(() => {
        // Filtro Sugerido: Se for uma máquina numérica (28, 29, 180...), buscar por "DACEN".
        // Caso contrário, buscar pelo nome da máquina no campo 'location'.
        const itemsToFilter = inventoryItems.filter(item => {
            const machineNum = currentMachine?.number;
            const isNumericMachine = machineNum && ['28', '29', '180', '181', '182'].includes(machineNum);

            if (isNumericMachine) {
                // Para máquinas 28, 29, 180, 181, 182, buscar itens que tenham "DACEN" no local ou nome
                const loc = (item.location || '').toLowerCase();
                const name = (item.name || '').toLowerCase();
                return loc.includes('dacen') || name.includes('dacen');
            } else {
                // Para outras máquinas/salas, buscar pelo nome específico da máquina no local
                const loc = (item.location || '').toLowerCase();
                const machineName = (currentMachine?.name || '').toLowerCase();
                return loc.includes(machineName);
            }
        });

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

    useEffect(() => {
        fetchInventory()
    }, [fetchInventory])

    const currentTimeline = useMemo(() => {
        const machineEvents = localEvents.filter(e => e.machine_id === activeTab)

        const filterType = activeSubTab === 'ocorrencia' ? 'occurrence' :
            activeSubTab === 'manutencao' ? 'maintenance' : 'error'

        return machineEvents
            .filter(e => e.event_type === filterType || (filterType === 'occurrence' && e.event_type === 'part_change'))
            .map(e => {
                const piece = e.inventory_item_id ? inventoryItems.find(i => i.id === e.inventory_item_id) : null
                const typeLabels = { occurrence: 'Ocorrência', maintenance: 'Manutenção', error: 'Erro', part_change: 'Troca de Peça' }

                return {
                    id: e.id,
                    date: new Date(e.created_at),
                    type: e.event_type,
                    title: typeLabels[e.event_type as keyof typeof typeLabels] || 'Evento',
                    description: e.description || '(Sem descrição)',
                    detail: piece ? `${piece.name} (${e.quantity_used} un)` : null,
                    imageUrl: e.image_url,
                    user: e.user?.full_name || 'Usuário',
                    userId: e.user_id,
                    rating: null,
                    inventory_item_id: e.inventory_item_id,
                    quantity_used: e.quantity_used
                }
            })
            .filter(item => {
                if (!searchText) return true
                const term = searchText.toLowerCase()
                const desc = (item.description || '').toLowerCase()
                const title = (item.title || '').toLowerCase()
                const detail = (item.detail || '').toLowerCase()
                const user = (item.user || '').toLowerCase()

                return title.includes(term) ||
                    desc.includes(term) ||
                    detail.includes(term) ||
                    user.includes(term)
            })
            .sort((a, b) => b.date.getTime() - a.date.getTime())
    }, [activeTab, activeSubTab, localEvents, searchText, inventoryItems])

    const handleOpenModal = (item?: any) => {
        if (item) {
            setEditingId(item.id)
            setDescription(item.description)
            setImageUrl(item.imageUrl || '')
            setSelectedItemId(item.inventory_item_id || null)
            setQuantityUsed(item.quantity_used || 1)
            setModalEventType(item.type === 'part_change' ? 'occurrence' : item.type as any || 'occurrence')
        } else {
            setEditingId(null)
            setDescription('')
            setImageUrl('')
            setSelectedItemId(null)
            setQuantityUsed(1)
            setModalEventType('occurrence')
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
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `events/${fileName}`

            const { error: uploadError, data } = await supabase.storage
                .from('attachments')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(filePath)

            setImageUrl(publicUrl)
            showToast('Imagem carregada!', 'success')
        } catch (error: any) {
            console.error('Erro no upload:', error)
            showToast('Erro ao carregar imagem: ' + error.message, 'error')
        } finally {
            setUploading(false)
        }
    }

    const handleDeleteOccurrence = async (id: string) => {
        if (!confirm('Tem certeza que deseja apagar este registro? Pela integridade do sistema, se houver troca de peça vinculada, as peças serão estornadas para o estoque.')) return

        try {
            // 1. Verificar se o evento tem peça vinculada
            const eventToDelete = localEvents.find(e => e.id === id)

            if (eventToDelete?.inventory_item_id && (eventToDelete.quantity_used || 0) > 0) {
                // 2. Buscar item atual do estoque para garantir consistência
                const { data: currentItem, error: fetchError } = await supabase
                    .from('inventory_items')
                    .select('quantity')
                    .eq('id', eventToDelete.inventory_item_id)
                    .single()

                if (!fetchError && currentItem) {
                    // 3. Devolver peças ao estoque
                    const newQuantity = currentItem.quantity + (eventToDelete.quantity_used || 0)
                    const { error: updateError } = await supabase
                        .from('inventory_items')
                        .update({ quantity: newQuantity })
                        .eq('id', eventToDelete.inventory_item_id)

                    if (updateError) {
                        console.error('Erro ao estornar estoque:', updateError)
                        showToast('Erro ao devolver peças ao estoque, mas o registro será apagado.', 'warning')
                    } else {
                        // Atualiza estado local do estoque
                        setInventoryItems(prev => prev.map(i =>
                            i.id === eventToDelete.inventory_item_id ? { ...i, quantity: newQuantity } : i
                        ))
                    }
                }
            }

            const { error } = await supabase
                .from('machine_events')
                .delete()
                .eq('id', id)

            if (error) throw error

            setLocalEvents(prev => prev.filter(e => e.id !== id))
            showToast('Registro removido e estoque estornado com sucesso!', 'success')
        } catch (error: any) {
            console.error('Erro ao excluir:', error)
            showToast('Erro ao excluir: ' + error.message, 'error')
        }
    }

    const handleSaveOccurrence = async () => {
        if (!description.trim()) {
            showToast('Por favor, descreva a ocorrência. A descrição é obrigatória.', 'warning')
            return
        }

        setIsSaving(true)
        try {
            // Validação de Estoque se houver peça selecionada
            if (selectedItemId) {
                const item = inventoryItems.find(i => i.id === selectedItemId)
                if (item && quantityUsed > item.quantity) {
                    showToast(`Quantidade insuficiente em estoque. Saldo atual: ${item.quantity}`, 'error')
                    setIsSaving(false)
                    return
                }
            }

            // Usa o tipo selecionado no modal sempre
            const eventType = modalEventType

            if (editingId) {
                // Atualizar
                const { data, error } = await supabase
                    .from('machine_events')
                    .update({
                        description: description.trim(),
                        image_url: imageUrl,
                        inventory_item_id: selectedItemId,
                        quantity_used: selectedItemId ? quantityUsed : 0,
                        event_type: eventType
                    })
                    .eq('id', editingId)
                    .select('*, user:profiles(id, full_name, email)')
                    .single()

                if (error) throw error

                setLocalEvents(prev => prev.map(e => e.id === editingId ? data as MachineEvent : e))
                showToast('Registro atualizado com sucesso!', 'success')
            } else {
                // Inserir
                const { data, error } = await supabase
                    .from('machine_events')
                    .insert({
                        machine_id: activeTab,
                        user_id: profile.id,
                        event_type: eventType,
                        description: description.trim(),
                        image_url: imageUrl,
                        inventory_item_id: selectedItemId,
                        quantity_used: selectedItemId ? quantityUsed : 0
                    })
                    .select('*, user:profiles(id, full_name, email)')
                    .single()

                if (error) throw error

                // Baixa no Estoque se for troca de peça
                if (selectedItemId) {
                    const selectedItem = inventoryItems.find(i => i.id === selectedItemId)
                    if (selectedItem) {
                        const { error: stockError } = await supabase
                            .from('inventory_items')
                            .update({ quantity: selectedItem.quantity - quantityUsed })
                            .eq('id', selectedItemId)

                        if (stockError) {
                            console.error('Erro ao baixar estoque:', stockError)
                            showToast('Evento salvo, mas houve erro ao baixar estoque.', 'warning')
                        } else {
                            // Atualiza estoque local
                            setInventoryItems(prev => prev.map(i =>
                                i.id === selectedItemId ? { ...i, quantity: i.quantity - quantityUsed } : i
                            ))
                        }
                    }
                }

                setLocalEvents(prev => [data as MachineEvent, ...prev])
                showToast('Registro realizado com sucesso!', 'success')
            }

            setDescription('')
            setImageUrl('')
            setSelectedItemId(null)
            setQuantityUsed(1)
            setEditingId(null)
            setIsModalOpen(false)
        } catch (error: any) {
            console.error('Erro detalhado ao salvar:', error)

            // Tenta extrair a mensagem de erro de várias formas
            let errorMsg = 'Erro desconhecido'

            if (typeof error === 'string') {
                errorMsg = error
            } else if (error.message) {
                errorMsg = error.message
            } else if (error.details) {
                errorMsg = error.details
            } else {
                // Captura propriedades de objetos Error (que não são enumeráveis pelo JSON.stringify padrão)
                try {
                    errorMsg = JSON.stringify(error, Object.getOwnPropertyNames(error))
                } catch (e) {
                    errorMsg = String(error)
                }
            }

            showToast('Erro ao salvar: ' + errorMsg, 'error')
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="historico-container">
            {/* Abas das Máquinas (Nível 1) */}
            <div className="machines-tabs" style={{ marginBottom: '20px' }}>
                {machines.map(machine => (
                    <button
                        key={machine.id}
                        className={`machine-tab ${activeTab === machine.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(machine.id)
                            // Opcional: manter a sub-aba ativa ao trocar de máquina
                        }}
                    >
                        {machine.type === 'room' || isNaN(Number(machine.number)) ? machine.name : `Máquina ${machine.number}`}
                    </button>
                ))}
            </div>

            {/* Sub-abas e Ação (Nível 2) */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '24px',
                flexWrap: 'wrap'
            }}>
                <div style={{
                    display: 'flex',
                    gap: '4px',
                    background: 'rgba(255,255,255,0.03)',
                    padding: '4px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-card)',
                    flexWrap: 'wrap'
                }}>
                    <button
                        onClick={() => setActiveSubTab('ocorrencia')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: activeSubTab === 'ocorrencia' ? 'var(--primary-accent)' : 'transparent',
                            color: activeSubTab === 'ocorrencia' ? 'white' : 'var(--text-muted)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        Ocorrência
                    </button>
                    <button
                        onClick={() => setActiveSubTab('manutencao')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: activeSubTab === 'manutencao' ? 'var(--primary-accent)' : 'transparent',
                            color: activeSubTab === 'manutencao' ? 'white' : 'var(--text-muted)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        Manutenção
                    </button>
                    <button
                        onClick={() => setActiveSubTab('erro')}
                        style={{
                            padding: '8px 20px',
                            borderRadius: 'var(--radius-sm)',
                            border: 'none',
                            background: activeSubTab === 'erro' ? 'var(--primary-accent)' : 'transparent',
                            color: activeSubTab === 'erro' ? 'white' : 'var(--text-muted)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'var(--transition)'
                        }}
                    >
                        Erro
                    </button>
                </div>

                <button
                    className="btn-primary"
                    onClick={() => handleOpenModal()}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '14px' }}
                >
                    <span>➕</span> Incluir Informação
                </button>
            </div>

            {/* Busca */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>

                <div style={{ position: 'relative', flex: '1', maxWidth: '400px' }}>
                    <input
                        type="text"
                        placeholder="Buscar no histórico..."
                        value={searchText}
                        onChange={e => setSearchText(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '10px 16px',
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid var(--border-card)',
                            borderRadius: '30px',
                            color: 'var(--text-primary)',
                            fontSize: '14px',
                            outline: 'none'
                        }}
                    />
                </div>
            </div>

            {/* Timeline Filtrada */}
            <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
                {currentTimeline.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <div style={{ fontSize: '40px', marginBottom: '16px' }}>📂</div>
                        <p>Nenhum registro encontrado para este local.</p>
                    </div>
                ) : (
                    <div style={{ padding: '24px' }}>
                        <div className="timeline" style={{ position: 'relative' }}>
                            {currentTimeline.map((item, idx) => (
                                <div key={item.id} style={{
                                    display: 'flex',
                                    gap: '20px',
                                    marginBottom: idx === currentTimeline.length - 1 ? 0 : '32px',
                                    position: 'relative'
                                }}>
                                    {/* Linha vertical */}
                                    {idx !== currentTimeline.length - 1 && (
                                        <div style={{
                                            position: 'absolute',
                                            left: '11px',
                                            top: '28px',
                                            bottom: '-32px',
                                            width: '2px',
                                            background: 'rgba(255,255,255,0.05)'
                                        }} />
                                    )}

                                    {/* Ícone por tipo */}
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        background: item.type === 'error' ? 'rgba(230, 57, 70, 0.1)' :
                                            item.type === 'maintenance' ? 'rgba(255, 159, 28, 0.1)' :
                                                item.type === 'occurrence' ? 'rgba(58, 134, 255, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                        border: `2px solid ${item.type === 'error' ? 'var(--danger)' :
                                            item.type === 'maintenance' ? '#ff9f1c' :
                                                item.type === 'occurrence' ? 'var(--primary-accent)' : 'var(--success)'
                                            }`,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '10px',
                                        zIndex: 1,
                                        marginTop: '4px'
                                    }}>
                                        {item.type === 'error' ? '🚨' :
                                            item.type === 'maintenance' ? '🔧' :
                                                item.type === 'occurrence' ? '📝' : '⚙️'}
                                    </div>

                                    {/* Conteúdo */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                    {item.title}
                                                </h4>
                                                {item.detail && (
                                                    <span style={{ fontSize: '11px', background: 'rgba(58, 134, 255, 0.1)', color: 'var(--primary-accent)', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                                        ⚙️ {item.detail}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                    {format(item.date, 'dd/MM/yyyy HH:mm')}
                                                </span>
                                                {isMaster && (
                                                    <div style={{ display: 'flex', gap: '8px' }}>
                                                        <button
                                                            onClick={() => handleOpenModal(item)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '4px' }}
                                                            title="Editar"
                                                        >
                                                            ✏️
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteOccurrence(item.id)}
                                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.6, padding: '4px' }}
                                                            title="Apagar"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ color: 'var(--primary-accent)', fontWeight: 600 }}>👤 {item.user}</span>
                                        </div>

                                        {item.description && (
                                            <div className="card" style={{
                                                padding: '16px 20px',
                                                background: 'rgba(255,255,255,0.02)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                fontSize: '14px',
                                                lineHeight: '1.6',
                                                color: 'var(--text-secondary)',
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word',
                                                width: '100%',
                                                maxWidth: '1000px',
                                                marginBottom: item.imageUrl ? '12px' : 0
                                            }}>
                                                {item.description}
                                            </div>
                                        )}

                                        {item.imageUrl && (
                                            <div style={{
                                                marginTop: '8px',
                                                borderRadius: 'var(--radius-md)',
                                                overflow: 'hidden',
                                                border: '1px solid var(--border-card)',
                                                width: 'fit-content',
                                                maxWidth: '100%'
                                            }}>
                                                <img
                                                    src={item.imageUrl}
                                                    alt="Anexo da ocorrência"
                                                    style={{ maxWidth: '400px', maxHeight: '300px', display: 'block', objectFit: 'contain' }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Incluir Informação */}
            {isModalOpen && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">{editingId ? 'Editar Ocorrência' : 'Registrar Ocorrência'}</h3>
                            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', paddingRight: '8px' }}>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                                {editingId ? 'Atualize os detalhes do registro.' : `Selecione o tipo e descreva o que aconteceu na ${currentMachine?.type === 'room' || isNaN(Number(currentMachine?.number)) ? currentMachine?.name : `Máquina ${currentMachine?.number}`}.`}
                            </p>

                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                                Tipo de Informação
                            </label>
                            <select
                                value={modalEventType}
                                onChange={e => {
                                    const val = e.target.value as any
                                    setModalEventType(val)
                                    // Se mudar para algo que não seja manutenção, limpa a peça selecionada
                                    if (val !== 'maintenance') {
                                        setSelectedItemId(null)
                                        setIsSelectingPiece(false)
                                    }
                                }}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    outline: 'none',
                                    marginBottom: '16px',
                                    cursor: 'pointer'
                                }}
                                disabled={!!selectedItemId}
                            >
                                <option value="occurrence">Ocorrência</option>
                                <option value="maintenance">Manutenção de Máquina</option>
                                <option value="error">Erro</option>
                                {selectedItemId && <option value="part_change">Troca de Peça</option>}
                            </select>

                            <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>
                                Descrição Detalhada
                            </label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                placeholder="Digite aqui os detalhes da ocorrência..."
                                style={{
                                    width: '100%',
                                    minHeight: isSelectingPiece ? '80px' : '150px',
                                    maxHeight: '200px',
                                    background: 'var(--bg-input)',
                                    border: '1px solid var(--border)',
                                    borderRadius: 'var(--radius-md)',
                                    padding: '12px',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    resize: 'none',
                                    outline: 'none',
                                    marginBottom: '16px'
                                }}
                            />

                            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                                <label className="btn-secondary" style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', flex: 1, justifyContent: 'center' }}>
                                    <span>📷</span> {uploading ? 'Carregando...' : 'Anexar Imagem'}
                                    <input
                                        type="file"
                                        accept="image/*"
                                        hidden
                                        onChange={handleImageUpload}
                                        disabled={uploading}
                                    />
                                </label>
                                {modalEventType === 'maintenance' && (
                                    <button
                                        className="btn-secondary"
                                        style={{ fontSize: '12px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '8px', flex: 1, justifyContent: 'center', border: selectedItemId ? '1px solid var(--primary-accent)' : '1px solid var(--border)' }}
                                        onClick={() => setIsSelectingPiece(!isSelectingPiece)}
                                    >
                                        ⚙️ {selectedItemId ? 'Trocar Peça' : 'Troca de Peça'}
                                    </button>
                                )}
                            </div>

                            {/* Seletor de Peças */}
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
                                                    setSelectedItemId(item.id)
                                                    setIsSelectingPiece(false)
                                                }}
                                                style={{
                                                    padding: '8px 12px',
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    borderBottom: '1px solid var(--border)',
                                                    background: selectedItemId === item.id ? 'rgba(58, 134, 255, 0.1)' : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px'
                                                }}
                                            >
                                                {item.image_url ? (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, border: '1px solid var(--border)' }}>
                                                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                ) : (
                                                    <div style={{ width: '32px', height: '32px', borderRadius: '4px', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', flexShrink: 0, border: '1px solid var(--border)' }}>
                                                        🖼️
                                                    </div>
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

                            {/* Resumo da Peça Selecionada */}
                            {selectedItemId && !isSelectingPiece && (
                                <div style={{
                                    marginBottom: '16px',
                                    padding: '12px',
                                    background: 'rgba(58, 134, 255, 0.05)',
                                    border: '1px solid var(--primary-accent)',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--primary-accent)', fontWeight: 800, marginBottom: '2px' }}>Peça Selecionada</div>
                                        <div style={{ fontSize: '14px', fontWeight: 600 }}>{inventoryItems.find(i => i.id === selectedItemId)?.name}</div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ textAlign: 'right', marginRight: '8px' }}>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Disponível</div>
                                            <div style={{ fontSize: '12px', fontWeight: 700, color: (inventoryItems.find(i => i.id === selectedItemId)?.quantity || 0) < quantityUsed ? 'var(--danger)' : 'var(--success)' }}>
                                                {inventoryItems.find(i => i.id === selectedItemId)?.quantity || 0} un
                                            </div>
                                        </div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Qtd:</label>
                                        <input
                                            type="number"
                                            value={quantityUsed}
                                            onChange={e => setQuantityUsed(Math.max(1, parseInt(e.target.value) || 1))}
                                            style={{
                                                width: '60px',
                                                padding: '6px',
                                                background: 'var(--bg-card)',
                                                border: (inventoryItems.find(i => i.id === selectedItemId)?.quantity || 0) < quantityUsed
                                                    ? '2px solid var(--danger)'
                                                    : '1px solid var(--border)',
                                                color: 'var(--text-primary)',
                                                borderRadius: '4px',
                                                textAlign: 'center',
                                                fontSize: '14px',
                                                fontWeight: 700
                                            }}
                                        />
                                        <button
                                            onClick={() => setSelectedItemId(null)}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: 'var(--danger)' }}
                                            title="Remover peça"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            )}

                            {imageUrl && (
                                <div style={{ marginBottom: '16px', position: 'relative', width: 'fit-content' }}>
                                    <img
                                        src={imageUrl}
                                        alt="Preview"
                                        style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                                    />
                                    <button
                                        onClick={() => setImageUrl('')}
                                        style={{ position: 'absolute', top: '-8px', right: '-8px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        ×
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn-secondary" onClick={() => {
                                setIsModalOpen(false)
                                setEditingId(null)
                                setDescription('')
                                setImageUrl('')
                            }}>Cancelar</button>
                            <button
                                className="btn-primary"
                                onClick={handleSaveOccurrence}
                                disabled={isSaving || uploading}
                            >
                                {isSaving ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Confirmar Ocorrência'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
