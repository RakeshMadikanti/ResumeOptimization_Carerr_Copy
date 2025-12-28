import { NextRequest, NextResponse } from "next/server";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("resume") as File;
        const jd = formData.get("jd") as string;
        const prompt = formData.get("prompt") as string;

        const provider = formData.get("provider") as string;
        const model = formData.get("model") as string;

        // Check for API Keys
        let apiKey = "";
        if (provider === 'openai') {
            apiKey = process.env.OPENAI_API_KEY || "";
            if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
        } else {
            apiKey = process.env.GEMINI_API_KEY || "";
            if (!apiKey) return NextResponse.json({ error: "Missing GEMINI_API_KEY" }, { status: 500 });
        }

        if (!file || !jd) {
            return NextResponse.json({ error: "Missing file or JD" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const tempDir = os.tmpdir();
        const inputPath = join(tempDir, `input_${Date.now()}.docx`);
        const outputPath = join(tempDir, `output_${Date.now()}.docx`);

        await writeFile(inputPath, buffer);

        // Call Python Script
        // Escaping arguments is important but for MVP we assume simple text or robust python arg handling
        // We'll use a safer way if possible, or just quote content. 
        // Passing large text via command line is bad. We should write JD/Prompt to files too.

        const jdPath = join(tempDir, `jd_${Date.now()}.txt`);
        const promptPath = join(tempDir, `prompt_${Date.now()}.txt`);

        await writeFile(jdPath, jd);
        await writeFile(promptPath, prompt);

        const scriptPath = join(process.cwd(), "scripts", "optimizer.py");

        // Command: python script.py <input> <output> <jd_path> <prompt_path> <provider> <model> <key>
        const command = `python "${scriptPath}" "${inputPath}" "${outputPath}" "${jdPath}" "${promptPath}" "${provider}" "${model}" "${apiKey}"`;

        let result;
        let stdout = "";
        try {
            const { stdout: scriptStdout } = await execAsync(command);
            stdout = scriptStdout; // Store stdout for potential error logging
            result = JSON.parse(stdout);
        } catch (e: any) {
            console.error("Failed to parse script output:", stdout, e);
            return NextResponse.json({ error: "Failed to parse optimization result" }, { status: 500 });
        }

        const fileBuffer = await readFile(outputPath);

        // Cleanup
        await unlink(inputPath);
        try { await unlink(outputPath); } catch { }
        await unlink(jdPath);
        await unlink(promptPath);

        // Return the file as a standardized Blob (Prevent Corruption)
        // Pass Verification Data via Custom Headers

        const verification = result.verification || {};
        const safeFeedback = (verification.feedback || "").replace(/[\r\n]+/g, " "); // Sanitize headers

        return new NextResponse(fileBuffer, {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "Content-Disposition": `attachment; filename="optimized_${file.name}"`,
                "X-Analysis-Score": String(verification.score || 0),
                "X-Analysis-Optimized": String(verification.is_optimized || false),
                "X-Analysis-Feedback": Buffer.from(safeFeedback).toString('base64') // Base64 encode for safe header transport
            },
        });

    } catch (error: any) {
        console.error("Optimization error:", error);
        return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
    }
}
