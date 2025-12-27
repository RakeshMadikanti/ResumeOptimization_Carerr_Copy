import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'AutoResume | AI Resume Tailor',
    description: 'Instantly tailor your resume to any job description using AI.',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="en" className="dark">
            <body className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}>
                <div className="relative flex min-h-screen flex-col">
                    {children}
                </div>
            </body>
        </html>
    )
}
