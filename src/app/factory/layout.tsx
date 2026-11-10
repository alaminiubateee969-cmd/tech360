import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Restricted Workspace — TECH360',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false, noimageindex: true },
  },
}

export default function FactoryLayout({ children }: { children: React.ReactNode }) {
  return children
}
