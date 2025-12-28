export function Footer() {
    return (
        <footer className="py-8 border-t border-border/40 bg-background">
            <div className="container px-4 md:px-6 mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground text-center md:text-left">
                    © {new Date().getFullYear()} AutoResume. All rights reserved. Built with Next.js & Python.
                </p>
                <div className="flex gap-4">
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
                    <a href="https://github.com/rajasampath125/autoresume" className="text-sm text-muted-foreground hover:text-foreground">GitHub</a>
                </div>
            </div>
        </footer>
    );
}
