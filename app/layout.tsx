import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ClerkProvider } from '@clerk/nextjs'
import { Toaster } from 'sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'AutoResume | AI-Powered Resume Tailor',
    description: 'Preserve your formatting while tailoring your resume to any job description.',
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>) {
    return (
        <ClerkProvider>
            <html lang="en" className="dark">
                <body className={inter.className}>
                    {children}
                    <Toaster position="bottom-right" theme="dark" />
                </body>
            </html>
        </ClerkProvider>
    )
}
