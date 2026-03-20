import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

const PROJECT_ROOT = process.cwd();
const PYTHON_SCRIPT = path.join(PROJECT_ROOT, "tools", "translator.py");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, detectedLang, targetCountry } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "텍스트를 입력하세요" }, { status: 400 });
    }

    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn("/home/egkim/anaconda3/bin/python3", [PYTHON_SCRIPT], {
        cwd: PROJECT_ROOT,
        env: { ...process.env, PYTHONUNBUFFERED: "1" },
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => { stdout += data.toString(); });
      proc.stderr.on("data", (data) => { stderr += data.toString(); });

      proc.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`Python error (code ${code}): ${stderr}`));
        } else {
          resolve(stdout);
        }
      });

      proc.on("error", (err) => reject(err));

      proc.stdin.write(JSON.stringify({ text, detectedLang, targetCountry }));
      proc.stdin.end();
    });

    const parsed = JSON.parse(result);
    return NextResponse.json(parsed);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[translate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
