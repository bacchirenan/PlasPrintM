'use client'

import React from 'react'

const HELP_SECTIONS = [
    {
        title: 'Dashboard Geral',
        description: 'Visão panorâmica do status de manutenção.',
        features: [
            'Visualização rápida do progresso de limpeza de cada máquina.',
            'Identificação imediata de máquinas com tarefas em atraso.',
            'Links diretos para as páginas específicas.'
        ]
    },
    {
        title: 'Cronograma de Limpeza',
        description: 'Gestão de tarefas preventivas e limpezas.',
        features: [
            'Divisão por frequências: Semanal, Quinzenal, Trimestral e Semestral.',
            'Registro de limpeza com avaliação (Ruim, Bom, Ótimo) e observações.',
            'Reset automático conforme as regras de negócio (ex: Sextas às 22:00).',
            'Filtros inteligentes por máquina e tipo de equipamento.'
        ]
    },
    {
        title: 'Manutenção (Histórico)',
        description: 'Arquivo completo de todas as atividades realizadas.',
        features: [
            'Filtro por máquina, usuário e período.',
            'Consulta de observações e notas técnicas.',
            'Possibilidade de "desmarcar" (uncheck) tarefas registradas incorretamente (permissão restrita).'
        ]
    },
    {
        title: 'Consumo de Tintas',
        description: 'Controle de uso e desperdício de insumos.',
        features: [
            'Registro de troca de galões para cada cor (CMYK + Branco).',
            'Lançamento automático para controle de estoque.',
            'Gráfico de consumo (em desenvolvimento).'
        ]
    },
    {
        title: 'Administração (Restrito)',
        description: 'Ferramentas de gestão do sistema.',
        features: [
            'Usuários: Criação e liberação de acesso (Regular, Admin, Master).',
            'Estoque de Tintas: Entrada de novos galões e controle de níveis.',
            'Estoque de Peças: Catálogo e controle de peças de reposição.'
        ]
    }
]

export default function AjudaPage() {
    return (
        <div className="page-container" style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
            <div className="card" style={{ padding: '40px', background: 'var(--card-bg)' }}>
                <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                    <div style={{
                        width: '64px',
                        height: '64px',
                        background: 'rgba(52, 152, 219, 0.1)',
                        borderRadius: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px',
                        color: 'var(--accent)'
                    }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                    </div>
                    <h1 style={{ fontSize: '32px', fontWeight: 800, marginBottom: '12px' }}>Guia de Uso PlasPrint</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>
                        Entenda como o sistema de manutenção funciona e conheça cada recurso disponível.
                    </p>
                </div>

                <div style={{ display: 'grid', gap: '32px' }}>
                    {HELP_SECTIONS.map((section, idx) => (
                        <div key={idx} style={{
                            padding: '24px',
                            borderRadius: '12px',
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.05)'
                        }}>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: 'var(--accent)' }}>
                                {section.title}
                            </h3>
                            <p style={{ marginBottom: '16px', fontSize: '15px', color: 'var(--text-primary)' }}>
                                {section.description}
                            </p>
                            <ul style={{ paddingLeft: '20px', display: 'grid', gap: '8px' }}>
                                {section.features.map((feature, fIdx) => (
                                    <li key={fIdx} style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                                        {feature}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div style={{
                    marginTop: '48px',
                    padding: '24px',
                    borderRadius: '12px',
                    background: 'rgba(52, 152, 219, 0.05)',
                    textAlign: 'center'
                }}>
                    <p style={{ fontSize: '14px', fontWeight: 600 }}>
                        Dúvidas Técnicas ou Bugs?
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Entre em contato com o suporte ou envie um e-mail para renan.projeto@plasutil.com.br
                    </p>
                </div>
            </div>
        </div>
    )
}
