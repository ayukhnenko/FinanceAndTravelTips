import { NextResponse } from "next/server";
import {
  getSpeechTranscribeStatus,
  transcribeSpeechAudio,
} from "@/lib/speech-transcribe";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const revalidate = 0;

export async function GET() {
  return NextResponse.json(getSpeechTranscribeStatus());
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const audio = formData.get("audio");
  if (!(audio instanceof File)) {
    return NextResponse.json({ ok: false, error: "Не передана аудиозапись" }, { status: 400 });
  }

  const result = await transcribeSpeechAudio(audio);
  if (!result.ok) {
    const status = result.error.includes("не настроена") ? 503 : 400;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  return NextResponse.json({ ok: true, text: result.text });
}
