import Link from 'next/link'

export default function NotFound() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
            <h2 className="text-4xl font-bold">404</h2>
            <p className="mt-2 text-muted-foreground">Page Not Found</p>
            <Link
                href="/"
                className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                Return Home
            </Link>
        </div>
    )
}
