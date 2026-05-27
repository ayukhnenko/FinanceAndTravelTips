import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/get-current-user";
import {
  decryptPrivateKeyJwkForUser,
  encryptPrivateKeyJwkForUser,
  normalizePrivateKeyJwk,
} from "@/lib/message-key-sync-server";
import {
  getUserMessagePrivateKeyBackup,
  getUserMessagePublicKey,
  setUserMessagePrivateKeyBackup,
  setUserMessagePublicKey,
} from "@/lib/message-keys-store";
import { reencryptPlainMessagesForRecipient } from "@/lib/messages-reencrypt";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const [publicKey, privateKeyBackup] = await Promise.all([
    getUserMessagePublicKey(user.id),
    getUserMessagePrivateKeyBackup(user.id),
  ]);

  const privateKeyJwk = privateKeyBackup
    ? decryptPrivateKeyJwkForUser(user.id, privateKeyBackup)
    : null;

  return NextResponse.json({
    ok: true,
    publicKey,
    hasKeys: Boolean(publicKey),
    hasPrivateKeyBackup: Boolean(privateKeyJwk),
    privateKeyJwk,
  });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { publicKey?: string; privateKeyJwk?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const publicKey = String(body.publicKey ?? "").trim();
  const privateKeyJwk = String(body.privateKeyJwk ?? "").trim();

  if (publicKey) {
    const result = await setUserMessagePublicKey(user.id, publicKey);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    let reencryptedCount = 0;
    if (result.keyChanged) {
      reencryptedCount = await reencryptPlainMessagesForRecipient(user.id);
    }

    if (privateKeyJwk) {
      const normalized = normalizePrivateKeyJwk(privateKeyJwk);
      if (!normalized) {
        return NextResponse.json({ ok: false, error: "Некорректный приватный ключ" }, { status: 400 });
      }

      let encryptedBackup: string;
      try {
        encryptedBackup = encryptPrivateKeyJwkForUser(user.id, normalized);
      } catch {
        return NextResponse.json({ ok: false, error: "Некорректный приватный ключ" }, { status: 400 });
      }

      const backupResult = await setUserMessagePrivateKeyBackup(user.id, encryptedBackup);
      if (!backupResult.ok) {
        return NextResponse.json({ ok: false, error: backupResult.error }, { status: 400 });
      }
    }

    return NextResponse.json({ ok: true, reencryptedCount });
  }

  if (!privateKeyJwk) {
    return NextResponse.json({ ok: false, error: "Некорректный запрос" }, { status: 400 });
  }

  const normalized = normalizePrivateKeyJwk(privateKeyJwk);
  if (!normalized) {
    return NextResponse.json({ ok: false, error: "Некорректный приватный ключ" }, { status: 400 });
  }

  let encryptedBackup: string;
  try {
    encryptedBackup = encryptPrivateKeyJwkForUser(user.id, normalized);
  } catch {
    return NextResponse.json({ ok: false, error: "Некорректный приватный ключ" }, { status: 400 });
  }

  const backupResult = await setUserMessagePrivateKeyBackup(user.id, encryptedBackup);
  if (!backupResult.ok) {
    return NextResponse.json({ ok: false, error: backupResult.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, reencryptedCount: 0 });
}
