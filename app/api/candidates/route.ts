import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { mkdir, writeFile, rm, unlink } from 'fs/promises';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
    try {
        const candidatesDir = path.join(process.cwd(), 'candidates');
        if (!fs.existsSync(candidatesDir)) {
            return NextResponse.json({ candidates: [] });
        }

        const candidates: any[] = [];
        const candidateFolders = fs.readdirSync(candidatesDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

        for (const candidate of candidateFolders) {
            const baseDir = path.join(candidatesDir, candidate, 'base');
            const files = [];
            if (fs.existsSync(baseDir)) {
                const resumeFiles = fs.readdirSync(baseDir).filter(f => f.toLowerCase().endsWith('.docx'));
                for (const f of resumeFiles) {
                    files.push({
                        name: f,
                        path: `candidates/${candidate}/base/${f}`
                    });
                }
            }
            // Always push the candidate so empty folders are visible
            candidates.push({
                name: candidate,
                files
            });
        }
        return NextResponse.json({ candidates });
    } catch (error) {
        console.error('Error reading candidates:', error);
        return NextResponse.json({ error: 'Failed to read candidates' }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume") as File | null;
        let name = formData.get("name") as string;

        if (!name) {
            return NextResponse.json({ error: "Candidate name is required" }, { status: 400 });
        }

        // sanitize name
        name = name.replace(/[^a-zA-Z0-9_\- ]/g, "").trim().replace(/\s+/g, '_');

        if (!name) {
            return NextResponse.json({ error: "Invalid candidate name" }, { status: 400 });
        }

        const candidateDir = path.join(process.cwd(), 'candidates', name);
        const baseDir = path.join(candidateDir, 'base');

        // Always create folder if it does not exist
        if (!fs.existsSync(baseDir)) {
            await mkdir(baseDir, { recursive: true });
        }

        if (file) {
            if (!file.name.toLowerCase().endsWith('.docx')) {
                return NextResponse.json({ error: "Only .docx files are supported" }, { status: 400 });
            }

            const buffer = Buffer.from(await file.arrayBuffer());
            const filePath = path.join(baseDir, file.name);
            await writeFile(filePath, buffer);
        }

        return NextResponse.json({ success: true, name });
    } catch (error: any) {
        console.error('Error adding candidate:', error);
        return NextResponse.json({ error: 'Failed to add candidate' }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const candidateName = searchParams.get('name');
        const filePath = searchParams.get('path'); // to delete a specific file

        const candidatesDir = path.join(process.cwd(), 'candidates');

        if (filePath) {
            // Delete a specific file
            if (filePath.includes('..') || !filePath.startsWith('candidates/')) {
                return NextResponse.json({ error: "Invalid path" }, { status: 400 });
            }
            const fullPath = path.join(process.cwd(), filePath);
            if (fs.existsSync(fullPath)) {
                await unlink(fullPath);
            }
            return NextResponse.json({ success: true });
        }

        if (candidateName) {
            // Delete entire candidate folder
            if (candidateName.includes('..') || candidateName.includes('/') || candidateName.includes('\\')) {
                return NextResponse.json({ error: "Invalid candidate name" }, { status: 400 });
            }
            const fullDir = path.join(candidatesDir, candidateName);
            if (fs.existsSync(fullDir)) {
                await rm(fullDir, { recursive: true, force: true });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Provide a name or path" }, { status: 400 });
    } catch (error: any) {
        console.error('Error deleting candidate:', error);
        return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
}
