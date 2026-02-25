import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PlasPrint Manutenção',
  description: 'Sistema de controle e cronograma de manutenção de máquinas PlasPrint',
  keywords: 'manutenção, máquinas, PlasPrint, checklist, cronograma',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  )
}
