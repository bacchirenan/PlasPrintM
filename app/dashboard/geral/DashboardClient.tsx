'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { Machine, MaintenanceItem, MaintenanceLog, InventoryItem } from '@/lib/types'
import { FREQUENCY_LABELS } from '@/lib/types'

interface DashboardClientProps {
    machines: Machine[]
    items: MaintenanceItem[]
    logs: MaintenanceLog[]
    inventory: InventoryItem[]
}

export function DashboardClient({ machines, items, logs, inventory }: DashboardClientProps) {
    const router = useRouter()

    // ─── Lógica de dados ─────────────────────────────────────────────────────

    // Último log por item/máquina
    const latestLogs = useMemo(() => {
        const map: Record<string, MaintenanceLog> = {}
        for (const log of logs) {
            const key = `${log.machine_id}__${log.item_id}`
            if (!map[key]) map[key] = log
        }
        return map
    }, [logs])

    const getIsOverdue = (machineId: string, item: MaintenanceItem) => {
        const lastLog = latestLogs[`${machineId}__${item.id}`]
        if (!lastLog) return true
        if (!item.category) return false

        const lastDate = new Date(lastLog.completed_at)
        const diffDays = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
        return diffDays > item.category.frequency_days
    }

    // Métricas Globais
    const stats = useMemo(() => {
        let totalOverdue = 0
        let totalTasks = 0

        machines.forEach(m => {
            const machineItems = items.filter(i => i.target_type === 'both' || i.target_type === m.type)
            machineItems.forEach(i => {
                totalTasks++
                if (getIsOverdue(m.id, i)) {
                    totalOverdue++
                }
            })
        })

        const lowStockItems = inventory.filter(i => i.min_quantity !== null && i.quantity <= i.min_quantity).length
        const totalCompleted = logs.length

        return {
            totalOverdue,
            totalTasks,
            efficiency: totalTasks > 0 ? Math.round(((totalTasks - totalOverdue) / totalTasks) * 100) : 0,
            lowStockItems,
            totalCompleted
        }
    }, [machines, items, latestLogs, inventory, logs])

    return (
        <div className="dashboard-content">
            {/* Cards Superiores */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '32px'
            }}>
                <MetricCard
                    label="Eficiência Geral"
                    value={`${stats.efficiency}%`}
                    icon="📊"
                    color={stats.efficiency > 80 ? 'var(--success)' : stats.efficiency > 50 ? 'var(--warning)' : 'var(--danger)'}
                />
                <MetricCard
                    label="Itens em Atraso"
                    value={String(stats.totalOverdue)}
                    icon="⚠️"
                    color={stats.totalOverdue > 0 ? 'var(--danger)' : 'var(--success)'}
                />
                <MetricCard
                    label="Limpezas Realizadas"
                    value={String(stats.totalCompleted)}
                    icon="✨"
                    color="var(--info)"
                />
            </div>

            {/* Grid de Máquinas */}
            <h2 style={{ marginBottom: '20px', fontSize: '18px', fontWeight: 600 }}>Status por Máquina / Local</h2>
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                gap: '20px'
            }}>
                {machines.map(machine => {
                    const machineItems = items.filter(i => i.target_type === 'both' || i.target_type === machine.type)
                    const machineTasks = machineItems.length
                    const machineOverdue = machineItems.filter(i => getIsOverdue(machine.id, i)).length
                    const machineEfficiency = machineTasks > 0 ? Math.round(((machineTasks - machineOverdue) / machineTasks) * 100) : 100

                    return (
                        <div
                            key={machine.id}
                            className="card dashboard-machine-card"
                            style={{ padding: '20px', cursor: 'pointer', transition: 'transform 0.2s' }}
                            onClick={() => router.push(`/dashboard/cronograma?machineId=${machine.id}`)}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div style={{ fontSize: '18px', fontWeight: 800 }}>
                                    {machine.type === 'room' || isNaN(Number(machine.number)) ? machine.name : `Máquina ${machine.number}`}
                                </div>
                                <div style={{
                                    padding: '4px 10px',
                                    borderRadius: '20px',
                                    fontSize: '12px',
                                    fontWeight: 700,
                                    background: machineEfficiency > 80 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(230, 57, 70, 0.1)',
                                    color: machineEfficiency > 80 ? 'var(--success)' : 'var(--danger)'
                                }}>
                                    {machineEfficiency}% OK
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>Tarefas em atraso:</span>
                                    <span style={{ fontWeight: 700, color: machineOverdue > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                        {machineOverdue}
                                    </span>
                                </div>
                                <div className="progress-bar-container" style={{
                                    height: '6px',
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '3px',
                                    marginTop: '4px',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{
                                        height: '100%',
                                        width: `${machineEfficiency}%`,
                                        background: machineEfficiency > 80 ? 'var(--success)' : machineEfficiency > 50 ? 'var(--warning)' : 'var(--danger)',
                                        transition: 'width 1s ease'
                                    }} />
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function MetricCard({ label, value, icon, color }: { label: string, value: string, icon: string, color: string }) {
    return (
        <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }}>{icon}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 900, color }}>{value}</div>
        </div>
    )
}
