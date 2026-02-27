import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    if (!filePath || filePath.includes('..') || !filePath.startsWith('candidates/')) {
        return new NextResponse("Invalid path", { status: 400 });
    }

    const fullPath = path.join(process.cwd(), filePath);

    if (!fs.existsSync(fullPath)) {
        return new NextResponse("Not found", { status: 404 });
    }

    try {
        const fileBuffer = fs.readFileSync(fullPath);
        const fileName = path.basename(fullPath);

        return new NextResponse(fileBuffer, {
            headers: {
                // Return generic octet-stream so browser treats it safely
                'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'Content-Disposition': `attachment; filename="${fileName}"`,
            },
        });
    } catch (e) {
        return new NextResponse("Error reading file", { status: 500 });
    }
}
