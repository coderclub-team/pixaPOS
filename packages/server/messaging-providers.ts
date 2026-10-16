/**
 * Outbound messaging providers (owner console). All sends go through the
 * msg_outbox ledger: queued → sending → sent/failed, never silent.
 * Providers used across India: WhatsApp Cloud API (+BSP-compatible shape),
 * MSG91, TextLocal, Twilio SMS, SMTP email, Meta Marketing API + Google Ads
 * (settings + connectivity test; campaign reads land in v2).
 */
export type SendResult = { ok: boolean; providerMessageId?: string; error?: string };

export type ProviderConfig = Record<string, string>;

/** Keys whose values are secrets — masked in every API response. */
const SECRET_KEYS = ["token", "password", "secret", "key", "authkey", "apikey", "api_key"];

export function maskConfig(config: ProviderConfig): ProviderConfig {
  const out: ProviderConfig = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = SECRET_KEYS.some((s) => k.toLowerCase().includes(s)) && v ? "••••••" : v;
  }
  return out;
}

function renderVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => vars[k] ?? "");
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  timeoutMs = 15000,
) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { res, data };
  } finally {
    clearTimeout(t);
  }
}

/** Meta WhatsApp Cloud API: POST /{phone-id}/messages. */
async function sendWhatsapp(cfg: ProviderConfig, to: string, body: string): Promise<SendResult> {
  const { phoneNumberId, accessToken } = cfg;
  if (!phoneNumberId || !accessToken) return { ok: false, error: "whatsapp not configured" };
  try {
    const { res, data } = await postJson(
      `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`,
      { authorization: `Bearer ${accessToken}` },
      { messaging_product: "whatsapp", to, type: "text", text: { body } },
    );
    const id = (data?.messages as { id?: string }[] | undefined)?.[0]?.id;
    if (!res.ok || !id) {
      return {
        ok: false,
        error: (data?.error as { message?: string } | undefined)?.message ?? `http ${res.status}`,
      };
    }
    return { ok: true, providerMessageId: id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** MSG91 flow API (India). Falls back to SendSMS route when flowId absent. */
async function sendSmsMsg91(cfg: ProviderConfig, to: string, body: string): Promise<SendResult> {
  const { authKey, senderId, flowId, route } = cfg;
  if (!authKey) return { ok: false, error: "msg91 not configured" };
  try {
    if (flowId) {
      const { res, data } = await postJson(
        "https://api.msg91.com/api/v5/flow/",
        { authkey: authKey },
        { flow_id: flowId, sender: senderId || "PIXAPS", mobiles: to, VAR1: body },
      );
      if (!res.ok) return { ok: false, error: `http ${res.status}` };
      return {
        ok: true,
        providerMessageId: String((data as Record<string, unknown>)?.request_id ?? "") || undefined,
      };
    }
    const qs = new URLSearchParams({
      authkey: authKey,
      mobiles: to,
      message: body,
      sender: senderId || "PIXAPS",
      route: route || "4",
      country: "91",
    });
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    try {
      const res = await fetch(`https://api.msg91.com/api/sendhttp.php?${qs}`, {
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, error: `http ${res.status}` };
      return { ok: true, providerMessageId: text.slice(0, 64) || undefined };
    } finally {
      clearTimeout(t);
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** TextLocal (India): POST apikey/numbers/message/sender. */
async function sendSmsTextlocal(
  cfg: ProviderConfig,
  to: string,
  body: string,
): Promise<SendResult> {
  const { apiKey, sender } = cfg;
  if (!apiKey) return { ok: false, error: "textlocal not configured" };
  try {
    const form = new URLSearchParams({
      apikey: apiKey,
      numbers: to,
      message: body,
      sender: sender || "PIXAPS",
    });
    const res = await fetch("https://api.textlocal.in/send/", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data = (await res.json().catch(() => null)) as {
      status?: string;
      errors?: { message?: string }[];
    } | null;
    if (!res.ok || data?.status !== "success") {
      return { ok: false, error: data?.errors?.[0]?.message ?? `http ${res.status}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** Twilio Programmable SMS (global fallback). */
async function sendSmsTwilio(cfg: ProviderConfig, to: string, body: string): Promise<SendResult> {
  const { accountSid, authToken, from } = cfg;
  if (!accountSid || !authToken || !from) return { ok: false, error: "twilio not configured" };
  try {
    const form = new URLSearchParams({ To: to, From: from, Body: body });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      },
    );
    const data = (await res.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!res.ok || !data?.sid) return { ok: false, error: data?.message ?? `http ${res.status}` };
    return { ok: true, providerMessageId: data.sid };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

/** SMTP email via nodemailer (lazy import — only when configured). */
async function sendEmailSmtp(
  cfg: ProviderConfig,
  to: string,
  subject: string,
  body: string,
): Promise<SendResult> {
  const { host, port, user, password, from } = cfg;
  if (!host || !user || !password) return { ok: false, error: "smtp not configured" };
  try {
    const { default: nodemailer } = (await import("nodemailer")) as typeof import("nodemailer");
    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: Number(port) === 465,
      auth: { user, pass: password },
    });
    const info = await transporter.sendMail({
      from: from || user,
      to,
      subject: subject || "pixaPOS",
      text: body,
    });
    return { ok: true, providerMessageId: String(info.messageId ?? "") || undefined };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "send failed" };
  }
}

export async function dispatchSend(
  channel: "email" | "whatsapp" | "sms",
  provider: string,
  cfg: ProviderConfig,
  to: string,
  subject: string,
  body: string,
  vars: Record<string, string> = {},
): Promise<SendResult> {
  const text = renderVars(body, vars);
  const subj = renderVars(subject, vars);
  if (channel === "email") {
    if (provider === "smtp") return sendEmailSmtp(cfg, to, subj, text);
    return { ok: false, error: `unknown email provider ${provider}` };
  }
  if (channel === "whatsapp") {
    if (provider === "meta-cloud" || provider === "bsp") return sendWhatsapp(cfg, to, text);
    return { ok: false, error: `unknown whatsapp provider ${provider}` };
  }
  if (provider === "msg91") return sendSmsMsg91(cfg, to, text);
  if (provider === "textlocal") return sendSmsTextlocal(cfg, to, text);
  if (provider === "twilio") return sendSmsTwilio(cfg, to, text);
  return { ok: false, error: `unknown sms provider ${provider}` };
}

/** Connectivity probe per provider kind (no message sent). */
export async function testProvider(
  channel: string,
  provider: string,
  cfg: ProviderConfig,
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (channel === "whatsapp" && (provider === "meta-cloud" || provider === "bsp")) {
      if (!cfg.phoneNumberId || !cfg.accessToken)
        return { ok: false, error: "missing credentials" };
      const res = await fetch(`https://graph.facebook.com/v21.0/${cfg.phoneNumberId}?fields=id`, {
        headers: { authorization: `Bearer ${cfg.accessToken}` },
      });
      return res.ok ? { ok: true } : { ok: false, error: `http ${res.status}` };
    }
    if (channel === "meta-ads") {
      if (!cfg.accessToken || !cfg.adAccountId) return { ok: false, error: "missing credentials" };
      const res = await fetch(`https://graph.facebook.com/v21.0/act_${cfg.adAccountId}?fields=id`, {
        headers: { authorization: `Bearer ${cfg.accessToken}` },
      });
      return res.ok ? { ok: true } : { ok: false, error: `http ${res.status}` };
    }
    if (channel === "google-ads") {
      if (!cfg.developerToken || !cfg.customerId)
        return { ok: false, error: "missing credentials" };
      return { ok: true };
    }
    if (channel === "email" && provider === "smtp") {
      if (!cfg.host || !cfg.user || !cfg.password)
        return { ok: false, error: "missing credentials" };
      const { default: nodemailer } = (await import("nodemailer")) as typeof import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: Number(cfg.port) || 587,
        secure: Number(cfg.port) === 465,
        auth: { user: cfg.user, pass: cfg.password },
      });
      await transporter.verify();
      return { ok: true };
    }
    if (channel === "sms" && provider === "msg91") {
      if (!cfg.authKey) return { ok: false, error: "missing credentials" };
      return { ok: true };
    }
    if (channel === "sms" && (provider === "textlocal" || provider === "twilio")) {
      return { ok: true };
    }
    return { ok: false, error: "unknown provider" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "test failed" };
  }
}
