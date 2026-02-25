'use client'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ToastProvider'
import type { InventoryItem } from '@/lib/types'

interface InventoryClientProps {
    initialItems: InventoryItem[]
    category: 'peca' | 'tinta'
    userRole?: string
    viewMode?: 'inventory' | 'planning' | 'both'
}

export function InventoryClient({ initialItems, category, userRole, viewMode = 'both' }: InventoryClientProps) {
    const isAdmin = userRole === 'admin' || userRole === 'master'
    const supabase = createClient()
    const { showToast } = useToast()
    const [items, setItems] = useState<InventoryItem[]>(initialItems)
    const [searchTerm, setSearchTerm] = useState('')
    const [loading, setLoading] = useState<string | null>(null)
    const [isEditing, setIsEditing] = useState<string | null>(null)
    const [isAdding, setIsAdding] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [editForm, setEditForm] = useState<Partial<InventoryItem>>({})
    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [withdrawals, setWithdrawals] = useState([{ itemId: '', bottles: 1 }])

    const filteredItems = useMemo(() => {
        return items.filter(item =>
            item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.code && item.code.toLowerCase().includes(searchTerm.toLowerCase()))
        )
    }, [items, searchTerm])

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEdit: boolean = false) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const fileExt = file.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `inventory/${fileName}`

            const { error: uploadError } = await supabase.storage
                .from('attachments')
                .upload(filePath, file)

            if (uploadError) throw uploadError

            const { data: { publicUrl } } = supabase.storage
                .from('attachments')
                .getPublicUrl(filePath)

            setEditForm(prev => ({ ...prev, image_url: publicUrl }))
            showToast('Imagem carregada com sucesso!', 'success')
        } catch (error) {
            console.error('Erro no upload:', error)
            showToast('Erro ao carregar imagem.', 'error')
        } finally {
            setUploading(false)
        }
    }

    const handleUpdateQuantity = async (id: string, newQty: number) => {
        if (newQty < 0) return
        setLoading(id)

        const { error } = await supabase
            .from('inventory_items')
            .update({ quantity: newQty })
            .eq('id', id)

        setLoading(null)

        if (error) {
            showToast('Erro ao atualizar quantidade.', 'error')
            return
        }

        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, quantity: newQty } : item
        ))
    }

    const handleSaveAdd = async () => {
        if (!editForm.name) {
            showToast('Nome é obrigatório.', 'error')
            return
        }

        setLoading('adding')
        const { data, error } = await supabase
            .from('inventory_items')
            .insert({
                name: editForm.name,
                code: editForm.code,
                quantity: editForm.quantity || 0,
                min_quantity: editForm.min_quantity || 0,
                image_url: editForm.image_url,
                category: category,
                daily_consumption: editForm.daily_consumption || 0,
                lead_time_days: editForm.lead_time_days || 0
            })
            .select()
            .single()

        setLoading(null)

        if (error) {
            showToast(`Erro ao cadastrar ${category === 'tinta' ? 'tinta' : 'peça'}.`, 'error')
            return
        }

        setItems(prev => [data, ...prev])
        setIsAdding(false)
        setEditForm({})
        showToast(`${category === 'tinta' ? 'Tinta' : 'Peça'} cadastrada com sucesso!`, 'success')
    }

    const handleSaveEdit = async () => {
        if (!isEditing) return
        setLoading(isEditing)

        const { error } = await supabase
            .from('inventory_items')
            .update({
                name: editForm.name,
                code: editForm.code,
                quantity: editForm.quantity,
                min_quantity: editForm.min_quantity,
                daily_consumption: editForm.daily_consumption,
                lead_time_days: editForm.lead_time_days,
                image_url: editForm.image_url
            })
            .eq('id', isEditing)

        setLoading(null)

        if (error) {
            showToast('Erro ao salvar alterações.', 'error')
            return
        }

        setItems(prev => prev.map(item =>
            item.id === isEditing ? { ...item, ...editForm } as InventoryItem : item
        ))
        setIsEditing(null)
        showToast('Item atualizado com sucesso!', 'success')
    }

    const handleUpdatePlanning = async (id: string, field: 'daily_consumption' | 'lead_time_days', value: number) => {
        if (!isAdmin) {
            showToast('Você não tem permissão para alterar o planejamento.', 'error')
            return
        }

        setLoading(id)
        const { error } = await supabase
            .from('inventory_items')
            .update({ [field]: value })
            .eq('id', id)

        setLoading(null)
        if (error) {
            showToast('Erro ao atualizar planejamento.', 'error')
            return
        }

        setItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ))
    }

    const handleRegisterWithdrawal = async () => {
        const validWithdrawals = withdrawals.filter(w => w.itemId && w.bottles > 0)

        if (validWithdrawals.length === 0) {
            showToast('Selecione pelo menos uma tinta e a quantidade.', 'error')
            return
        }

        setLoading('withdrawing')

        let hasError = false
        const updatedItems = [...items]

        for (const withdrawal of validWithdrawals) {
            const itemIndex = updatedItems.findIndex(i => i.id === withdrawal.itemId)
            if (itemIndex === -1) continue

            const item = updatedItems[itemIndex]

            if (item.quantity < withdrawal.bottles) {
                showToast(`Estoque insuficiente para a tinta ${item.name}.`, 'error')
                hasError = true
                continue
            }

            // 1. Registrar a retirada no log
            const { error: logError } = await supabase
                .from('ink_withdrawals')
                .insert({
                    item_id: item.id,
                    quantity_liters: withdrawal.bottles
                })

            if (logError) {
                showToast(`Erro ao registrar retirada para ${item.name}.`, 'error')
                hasError = true
                continue
            }

            // 2. Dar baixa no estoque
            const newQty = item.quantity - withdrawal.bottles
            const { error: stockError } = await supabase
                .from('inventory_items')
                .update({ quantity: newQty })
                .eq('id', item.id)

            if (stockError) {
                showToast(`Erro ao atualizar estoque para ${item.name}.`, 'error')
                hasError = true
                continue
            }

            // 3. Cálculo de Consumo Médio (ml/dia)
            const { data: withdrawalsList } = await supabase
                .from('ink_withdrawals')
                .select('created_at')
                .eq('item_id', item.id)
                .order('created_at', { ascending: false })
                .limit(2)

            let updatedConsumption = item.daily_consumption

            if (withdrawalsList && withdrawalsList.length === 2) {
                const last = new Date(withdrawalsList[0].created_at)
                const secondToLast = new Date(withdrawalsList[1].created_at)
                const diffTime = Math.abs(last.getTime() - secondToLast.getTime())
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                if (diffDays > 0) {
                    updatedConsumption = Math.round((withdrawal.bottles * 1000) / diffDays)

                    await supabase
                        .from('inventory_items')
                        .update({ daily_consumption: updatedConsumption })
                        .eq('id', item.id)
                }
            }

            updatedItems[itemIndex] = { ...item, quantity: newQty, daily_consumption: updatedConsumption }
        }

        setItems(updatedItems)
        setLoading(null)

        if (!hasError) {
            setIsWithdrawing(false)
            setWithdrawals([{ itemId: '', bottles: 1 }])
            showToast('Retiradas registradas e estoque atualizado!', 'success')
        }
    }

    return (
        <div className="inventory-container">
            {/* Toolbar - Ocultar botão de cadastrar na visão de planejamento pura se desejar, ou manter se for admin */}
            <div className="card" style={{ marginBottom: '24px', padding: '16px 20px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar por nome ou código..."
                            className="observation-input"
                            style={{ margin: 0, paddingLeft: '40px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <span style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>🔍</span>
                    </div>
                    {viewMode === 'planning' && (
                        <button
                            className="btn btn-primary"
                            style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                            onClick={() => setIsWithdrawing(true)}
                        >
                            🧪 Registrar Retirada
                        </button>
                    )}
                    {viewMode !== 'planning' && (
                        <button
                            className="btn btn-primary"
                            onClick={() => {
                                setEditForm({ quantity: 0, min_quantity: 0, daily_consumption: 0, lead_time_days: 7 })
                                setIsAdding(true)
                            }}
                        >
                            + Cadastrar {category === 'tinta' ? 'Tinta' : 'Peça'}
                        </button>
                    )}
                </div>
            </div>

            {/* Tabela de Planejamento (Apenas para Tintas) */}
            {category === 'tinta' && viewMode !== 'inventory' && filteredItems.length > 0 && (
                <div className="card" style={{ marginBottom: '24px', padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'rgba(58, 134, 255, 0.05)' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            📊 Planejamento de Consumo e Cobertura
                        </h3>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Código</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Descrição</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Consumo Ano (L)</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Consumo Mês (L)</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', background: 'rgba(58, 134, 255, 0.05)' }}>Consumo Dia (ml)</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Estoque Atual (L)</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Cobertura</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', background: 'rgba(58, 134, 255, 0.05)' }}>Dias Entrega</th>
                                    <th style={{ padding: '12px 20px', fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Dias p/ Pedido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => {
                                    const consumptionMonth = ((item.daily_consumption || 0) / 1000) * 30
                                    const consumptionYear = ((item.daily_consumption || 0) / 1000) * 365
                                    const coverage = item.daily_consumption > 0 ? ((item.quantity * 1000) / item.daily_consumption) : 0
                                    const daysToOrder = coverage - (item.lead_time_days || 0)

                                    return (
                                        <tr key={`plan-${item.id}`} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.code || '—'}</td>
                                            <td style={{ padding: '12px 20px', fontSize: '13px', fontWeight: 600 }}>{item.name}</td>
                                            <td style={{ padding: '12px 20px', fontSize: '12px', textAlign: 'center' }}>{consumptionYear.toFixed(1)}</td>
                                            <td style={{ padding: '12px 20px', fontSize: '12px', textAlign: 'center' }}>{consumptionMonth.toFixed(1)}</td>
                                            <td style={{ padding: '8px 20px', textAlign: 'center', background: 'rgba(58, 134, 255, 0.02)' }}>
                                                <input
                                                    type="number"
                                                    className="observation-input"
                                                    style={{ margin: 0, padding: '4px 8px', width: '70px', textAlign: 'center', fontSize: '13px', opacity: isAdmin ? 1 : 0.6 }}
                                                    defaultValue={item.daily_consumption || 0}
                                                    onBlur={e => {
                                                        if (!isAdmin) return
                                                        const val = parseFloat(e.target.value) || 0
                                                        if (val !== item.daily_consumption) {
                                                            handleUpdatePlanning(item.id, 'daily_consumption', val)
                                                        }
                                                    }}
                                                    disabled={loading === item.id || !isAdmin}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 20px', fontSize: '13px', textAlign: 'center', fontWeight: 700 }}>{item.quantity}</td>
                                            <td style={{ padding: '12px 20px', fontSize: '12px', textAlign: 'center', color: coverage < 15 ? 'var(--danger)' : 'var(--success)' }}>
                                                {coverage.toFixed(0)} dias
                                            </td>
                                            <td style={{ padding: '8px 20px', textAlign: 'center', background: 'rgba(58, 134, 255, 0.02)' }}>
                                                <input
                                                    type="number"
                                                    className="observation-input"
                                                    style={{ margin: 0, padding: '4px 8px', width: '60px', textAlign: 'center', fontSize: '13px', opacity: isAdmin ? 1 : 0.6 }}
                                                    defaultValue={item.lead_time_days || 0}
                                                    onBlur={e => {
                                                        if (!isAdmin) return
                                                        const val = parseInt(e.target.value) || 0
                                                        if (val !== item.lead_time_days) {
                                                            handleUpdatePlanning(item.id, 'lead_time_days', val)
                                                        }
                                                    }}
                                                    disabled={loading === item.id || !isAdmin}
                                                />
                                            </td>
                                            <td style={{
                                                padding: '12px 20px',
                                                fontSize: '13px',
                                                textAlign: 'center',
                                                fontWeight: 800,
                                                color: daysToOrder <= 3 ? 'var(--danger)' : 'inherit'
                                            }}>
                                                {daysToOrder <= 0 ? 'PEDIR AGORA' : `${daysToOrder.toFixed(0)} dias`}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Listagem */}
            {viewMode !== 'planning' && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="inventory-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.03)', textAlign: 'left' }}>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', width: '80px' }}>Foto</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Item</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Código</th>
                                    {category === 'tinta' && (
                                        <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Consumo Dia (ml)</th>
                                    )}
                                    <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center' }}>Qtd Atual</th>
                                    <th style={{ padding: '16px 20px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map(item => {
                                    const isLowStock = item.min_quantity !== null && item.quantity <= item.min_quantity

                                    return (
                                        <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '8px',
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid var(--border)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    overflow: 'hidden'
                                                }}>
                                                    {item.image_url ? (
                                                        <img src={item.image_url} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    ) : (
                                                        <span style={{ fontSize: '20px', opacity: 0.3 }}>{category === 'tinta' ? '🧪' : '⚙️'}</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: 600 }}>{item.name}</div>
                                                {isLowStock && (
                                                    <span style={{ fontSize: '10px', color: 'var(--danger)', background: 'rgba(230, 57, 70, 0.1)', padding: '2px 6px', borderRadius: '4px', marginTop: '4px', display: 'inline-block' }}>
                                                        ⚠️ Estoque Baixo (Mín: {item.min_quantity})
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px', color: 'var(--text-secondary)', fontSize: '13px' }}>{item.code || '—'}</td>
                                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ width: '24px', height: '24px', fontSize: '16px' }}
                                                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                                        disabled={loading === item.id}
                                                    >
                                                        -
                                                    </button>
                                                    <span style={{ fontSize: '18px', fontWeight: 800, minWidth: '30px', color: isLowStock ? 'var(--danger)' : 'inherit' }}>
                                                        {item.quantity}
                                                    </span>
                                                    <button
                                                        className="btn-icon"
                                                        style={{ width: '24px', height: '24px', fontSize: '16px' }}
                                                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                                        disabled={loading === item.id}
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-sm btn-ghost"
                                                    onClick={() => {
                                                        setIsEditing(item.id)
                                                        setEditForm(item)
                                                    }}
                                                >
                                                    Editar
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            Nenhum item encontrado no estoque.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Modal de Cadastro/Edição */}
            {(isAdding || isEditing) && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '24px' }}>
                        <h3 style={{ marginBottom: '20px' }}>{isAdding ? `Cadastrar Nova ${category === 'tinta' ? 'Tinta' : 'Peça'}` : 'Editar Item'}</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Upload de Imagem (Apenas para Peças) */}
                            {category === 'peca' && (
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', marginBottom: '8px' }}>
                                    <div style={{
                                        width: '80px', height: '80px', borderRadius: '12px',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
                                    }}>
                                        {editForm.image_url ? (
                                            <img src={editForm.image_url} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                            <span style={{ fontSize: '30px', opacity: 0.2 }}>📷</span>
                                        )}
                                    </div>
                                    <label className="btn-secondary" style={{ fontSize: '12px', padding: '8px 16px', cursor: 'pointer' }}>
                                        {uploading ? 'Carregando...' : 'Carregar Imagem'}
                                        <input type="file" hidden accept="image/*" onChange={handleImageUpload} disabled={uploading} />
                                    </label>
                                </div>
                            )}

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Nome do Item</label>
                                    <input
                                        type="text"
                                        className="observation-input"
                                        value={editForm.name || ''}
                                        onChange={e => {
                                            const val = category === 'tinta' ? e.target.value.toUpperCase() : e.target.value
                                            setEditForm(prev => ({ ...prev, name: val }))
                                        }}
                                        style={{ margin: 0, textTransform: category === 'tinta' ? 'uppercase' : 'none' }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Código no Sistema</label>
                                    <input
                                        type="text"
                                        className="observation-input"
                                        value={editForm.code || ''}
                                        onChange={e => {
                                            const val = category === 'tinta' ? e.target.value.toUpperCase() : e.target.value
                                            setEditForm(prev => ({ ...prev, code: val }))
                                        }}
                                        style={{ margin: 0, textTransform: category === 'tinta' ? 'uppercase' : 'none' }}
                                    />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Quantidade Atual (L)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        className="observation-input"
                                        style={{ margin: 0 }}
                                        value={editForm.quantity || 0}
                                        onChange={e => setEditForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Estoque Mínimo</label>
                                    <input
                                        type="number"
                                        className="observation-input"
                                        style={{ margin: 0 }}
                                        value={editForm.min_quantity || 0}
                                        onChange={e => setEditForm(prev => ({ ...prev, min_quantity: parseInt(e.target.value) || 0 }))}
                                    />
                                </div>
                            </div>

                            {category === 'tinta' && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div>
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Consumo Diário (ml)</label>
                                        <input
                                            type="number"
                                            step="1"
                                            className="observation-input"
                                            style={{ margin: 0 }}
                                            value={editForm.daily_consumption || 0}
                                            onChange={e => setEditForm(prev => ({ ...prev, daily_consumption: parseFloat(e.target.value) || 0 }))}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Dias para Entrega</label>
                                        <input
                                            type="number"
                                            className="observation-input"
                                            style={{ margin: 0 }}
                                            value={editForm.lead_time_days || 0}
                                            onChange={e => setEditForm(prev => ({ ...prev, lead_time_days: parseInt(e.target.value) || 0 }))}
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px' }}>
                            <button className="btn btn-ghost" onClick={() => { setIsAdding(false); setIsEditing(null); }}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={isAdding ? handleSaveAdd : handleSaveEdit}
                                disabled={loading !== null || uploading}
                            >
                                {loading ? 'Salvando...' : isAdding ? `Cadastrar ${category === 'tinta' ? 'Tinta' : 'Peça'}` : 'Salvar Alterações'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Retirada de Tinta */}
            {isWithdrawing && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 1000, backdropFilter: 'blur(4px)'
                }}>
                    <div className="card" style={{ width: '100%', maxWidth: '450px', padding: '24px' }}>
                        <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🧪 Registrar Retirada de Tintas
                        </h3>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
                            {withdrawals.map((withdrawal, index) => (
                                <div key={index} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) auto auto', gap: '12px', alignItems: 'flex-end', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Tinta</label>
                                        <select
                                            className="observation-input"
                                            style={{ margin: 0, width: '100%', fontSize: '13px' }}
                                            value={withdrawal.itemId}
                                            onChange={e => {
                                                const newWithdrawals = [...withdrawals]
                                                newWithdrawals[index].itemId = e.target.value
                                                setWithdrawals(newWithdrawals)
                                            }}
                                        >
                                            <option value="">Escolher...</option>
                                            {items.filter(i => i.category === 'tinta').map(item => (
                                                <option key={item.id} value={item.id} disabled={withdrawals.some((w, idx) => w.itemId === item.id && idx !== index)}>
                                                    {item.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>Qtd</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '2px 6px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <button
                                                className="btn-icon"
                                                style={{ width: '24px', height: '24px', fontSize: '14px' }}
                                                onClick={() => {
                                                    const newWithdrawals = [...withdrawals]
                                                    newWithdrawals[index].bottles = Math.max(1, newWithdrawals[index].bottles - 1)
                                                    setWithdrawals(newWithdrawals)
                                                }}
                                            >-</button>
                                            <span style={{ fontSize: '14px', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                                                {withdrawal.bottles}
                                            </span>
                                            <button
                                                className="btn-icon"
                                                style={{ width: '24px', height: '24px', fontSize: '14px' }}
                                                onClick={() => {
                                                    const newWithdrawals = [...withdrawals]
                                                    newWithdrawals[index].bottles += 1
                                                    setWithdrawals(newWithdrawals)
                                                }}
                                            >+</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {index === withdrawals.length - 1 && (
                                            <button
                                                className="btn-icon"
                                                style={{ width: '32px', height: '32px', background: 'var(--success)', color: 'white' }}
                                                onClick={() => setWithdrawals([...withdrawals, { itemId: '', bottles: 1 }])}
                                                title="Adicionar outra cor"
                                            >
                                                +
                                            </button>
                                        )}
                                        {withdrawals.length > 1 && (
                                            <button
                                                className="btn-icon"
                                                style={{ width: '32px', height: '32px', background: 'var(--danger)', color: 'white' }}
                                                onClick={() => {
                                                    const newWithdrawals = withdrawals.filter((_, idx) => idx !== index)
                                                    setWithdrawals(newWithdrawals)
                                                }}
                                                title="Remover linha"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button className="btn btn-ghost" onClick={() => setIsWithdrawing(false)}>Cancelar</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleRegisterWithdrawal}
                                disabled={loading === 'withdrawing' || !withdrawals.some(w => w.itemId)}
                            >
                                {loading === 'withdrawing' ? 'Processando...' : 'Confirmar Tudo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
