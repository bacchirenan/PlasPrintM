import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PlasPrint Manutenção',
  description: 'Sistema de controle e cronograma de manutenção de máquinas PlasPrint',
  keywords: 'manutenção, máquinas, PlasPrint, checklist, cronograma',
  icons: {
    icon: '/favicon.png',
  },
}

import localFont from 'next/font/local'

const appFont = localFont({
  src: '../public/fonts/font.ttf',
  variable: '--font-primary-local',
  display: 'swap',
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR" className={appFont.variable}>
      <body>{children}</body>
    </html>
  )
}
