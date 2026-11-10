// index.tsx
import { Hono as Hono5 } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient as createClient6 } from "npm:@supabase/supabase-js";

// kv_store.tsx
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
var client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
);
var set = async (key, value) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_a5927615").upsert({
    key,
    value
  });
  if (error) {
    throw new Error(error.message);
  }
};
var get = async (key) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_a5927615").select("value").eq("key", key).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data?.value;
};
var del = async (key) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_a5927615").delete().eq("key", key);
  if (error) {
    throw new Error(error.message);
  }
};
var mdel = async (keys) => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_a5927615").delete().in("key", keys);
  if (error) {
    throw new Error(error.message);
  }
};
var getByPrefix = async (prefix) => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_a5927615").select("key, value").like("key", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data?.map((d) => d.value) ?? [];
};

// telegram.tsx
import { Hono } from "npm:hono";
import { createClient as createClient2 } from "npm:@supabase/supabase-js";
var telegram = new Hono();
function getSupabase() {
  return createClient2(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}
async function requireUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}
var TG_API = "https://api.telegram.org/bot";
function getTelegramToken() {
  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) throw { message: "TELEGRAM_BOT_TOKEN not configured", code: "telegram_not_configured" };
  return token;
}
async function tgCall(method, body) {
  const token = getTelegramToken();
  const res = await fetch(`${TG_API}${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!data.ok) {
    console.log(`Telegram API error [${method}]: ${JSON.stringify(data)}`);
    throw { message: `Telegram ${method} failed: ${data.description}`, code: "telegram_error" };
  }
  return data.result;
}
telegram.post("/telegram/link", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const code = String(Math.floor(1e5 + Math.random() * 9e5));
    await set(`tg_link_code:${code}`, JSON.stringify({ userId: user.id, createdAt: Date.now() }));
    await set(`tg_pending:${user.id}`, code);
    console.log(`Telegram link code generated for user ${user.id}: ${code}`);
    return c.json({ code });
  } catch (err) {
    console.log(`Telegram link error: ${err}`);
    return c.json({ error: `Failed to generate link code: ${err.message || err}` }, 500);
  }
});
telegram.get("/telegram/status", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const raw = await get(`tg_user:${user.id}`);
    if (!raw) return c.json({ linked: false });
    const info = JSON.parse(raw);
    return c.json({ linked: true, chatId: info.chatId, username: info.username || null, firstName: info.firstName || null, linkedAt: info.linkedAt });
  } catch (err) {
    console.log(`Telegram status error: ${err}`);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});
telegram.post("/telegram/unlink", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    await del(`tg_user:${user.id}`);
    console.log(`Telegram unlinked for user ${user.id}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log(`Telegram unlink error: ${err}`);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});
telegram.post("/telegram/webhook", async (c) => {
  try {
    const update = await c.req.json();
    const msg = update?.message;
    if (!msg?.text || !msg?.chat?.id) return c.json({ ok: true });
    const chatId = msg.chat.id;
    const text = msg.text.trim();
    const firstName = msg.from?.first_name || "";
    const username = msg.from?.username || "";
    console.log(`Telegram webhook: chatId=${chatId}, text="${text}", from=${username}`);
    if (text === "/start") {
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `\u041F\u0440\u0438\u0432\u0435\u0442${firstName ? `, ${firstName}` : ""}! \u042F \u0422\u043E\u043C\u0438, \u0442\u0432\u043E\u0439 \u0430\u0441\u0441\u0438\u0441\u0442\u0435\u043D\u0442 \u0438\u0437 Vecto.

\u0427\u0442\u043E\u0431\u044B \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u0430\u043A\u043A\u0430\u0443\u043D\u0442, \u043E\u0442\u043F\u0440\u0430\u0432\u044C \u043C\u043D\u0435 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434 \u0438\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u043F\u0440\u043E\u0444\u0438\u043B\u044F.

\u041F\u043E\u0441\u043B\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u044F \u0431\u0443\u0434\u0443 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u043E \u0440\u0438\u0441\u043A\u0430\u0445 \u0438 \u0432\u0430\u0436\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u044F\u0445 \u043F\u0440\u044F\u043C\u043E \u0441\u044E\u0434\u0430.`,
        parse_mode: "HTML"
      });
      return c.json({ ok: true });
    }
    if (text === "/status") {
      const users = await getByPrefix("tg_user:");
      const linked = users.find((u) => {
        try {
          return JSON.parse(u).chatId === chatId;
        } catch {
          return false;
        }
      });
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: linked ? "\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D. \u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u044B." : "\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u043D\u0435 \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D. \u041E\u0442\u043F\u0440\u0430\u0432\u044C 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434 \u0438\u0437 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A \u043F\u0440\u043E\u0444\u0438\u043B\u044F Vecto."
      });
      return c.json({ ok: true });
    }
    if (text === "/help") {
      await tgCall("sendMessage", { chat_id: chatId, text: "\u041A\u043E\u043C\u0430\u043D\u0434\u044B:\n/start: \u043D\u0430\u0447\u0430\u043B\u043E\n/status: \u0441\u0442\u0430\u0442\u0443\u0441 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438\n/help: \u043F\u043E\u043C\u043E\u0449\u044C\n\n\u041E\u0442\u043F\u0440\u0430\u0432\u044C 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434 \u0434\u043B\u044F \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430." });
      return c.json({ ok: true });
    }
    if (/^\d{6}$/.test(text)) {
      const codeData = await get(`tg_link_code:${text}`);
      if (!codeData) {
        await tgCall("sendMessage", { chat_id: chatId, text: "\u041A\u043E\u0434 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D \u0438\u043B\u0438 \u0438\u0441\u0442\u0451\u043A. \u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u043D\u043E\u0432\u044B\u0439 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u043F\u0440\u043E\u0444\u0438\u043B\u044F Vecto." });
        return c.json({ ok: true });
      }
      const { userId, createdAt } = JSON.parse(codeData);
      if (Date.now() - createdAt > 10 * 60 * 1e3) {
        await del(`tg_link_code:${text}`);
        await tgCall("sendMessage", { chat_id: chatId, text: "\u041A\u043E\u0434 \u0438\u0441\u0442\u0451\u043A (10 \u043C\u0438\u043D\u0443\u0442). \u0421\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u043D\u043E\u0432\u044B\u0439 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u043F\u0440\u043E\u0444\u0438\u043B\u044F Vecto." });
        return c.json({ ok: true });
      }
      await set(`tg_user:${userId}`, JSON.stringify({ chatId, username, firstName, linkedAt: (/* @__PURE__ */ new Date()).toISOString() }));
      await del(`tg_link_code:${text}`);
      await del(`tg_pending:${userId}`);
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D! ${firstName ? firstName + ", " : ""}\u0442\u0435\u043F\u0435\u0440\u044C \u044F \u0431\u0443\u0434\u0443 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u044F\u0442\u044C \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0441\u044E\u0434\u0430.

\u0422\u043E\u043C\u0438 \u0441\u043B\u0435\u0434\u0438\u0442 \u0437\u0430 \u0442\u0432\u043E\u0435\u0439 \u043F\u0440\u043E\u0434\u0443\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C\u044E \u0438 \u043F\u0440\u0435\u0434\u0443\u043F\u0440\u0435\u0434\u0438\u0442 \u043E \u0440\u0438\u0441\u043A\u0430\u0445.`
      });
      console.log(`Telegram linked: userId=${userId}, chatId=${chatId}`);
      return c.json({ ok: true });
    }
    await tgCall("sendMessage", { chat_id: chatId, text: "\u041E\u0442\u043F\u0440\u0430\u0432\u044C 6-\u0437\u043D\u0430\u0447\u043D\u044B\u0439 \u043A\u043E\u0434 \u0434\u043B\u044F \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u0438\u043B\u0438 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 /help." });
    return c.json({ ok: true });
  } catch (err) {
    console.log(`Telegram webhook error: ${err}`);
    return c.json({ ok: true });
  }
});
telegram.post("/telegram/send", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { message, type } = await c.req.json();
    const raw = await get(`tg_user:${user.id}`);
    if (!raw) return c.json({ error: "Telegram not linked" }, 400);
    const { chatId } = JSON.parse(raw);
    const typeEmoji = {
      risk_critical: "\u{1F6A8}",
      risk_high: "\u26A0\uFE0F",
      risk_medium: "\u{1F4A1}",
      streak: "\u{1F525}",
      achievement: "\u{1F3C6}",
      reminder: "\u23F0",
      test: "\u{1F514}"
    };
    const emoji = typeEmoji[type] || "\u{1F4E9}";
    await tgCall("sendMessage", { chat_id: chatId, text: `${emoji} <b>\u0422\u043E\u043C\u0438</b>

${message}`, parse_mode: "HTML" });
    console.log(`Telegram notification sent to user ${user.id}, type=${type}`);
    return c.json({ ok: true });
  } catch (err) {
    console.log(`Telegram send error: ${err}`);
    const code = err?.code;
    if (code === "telegram_not_configured") return c.json({ error: err.message, code }, 503);
    return c.json({ error: `${err.message || err}` }, 500);
  }
});
telegram.post("/telegram/risk-notify", async (c) => {
  try {
    const user = await requireUser(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { riskLevel, reasons, streak } = await c.req.json();
    const raw = await get(`tg_user:${user.id}`);
    if (!raw) return c.json({ sent: false, reason: "not_linked" });
    const { chatId, firstName } = JSON.parse(raw);
    const lastKey = `tg_last_notif:${user.id}`;
    const lastNotif = await get(lastKey);
    if (lastNotif && Date.now() - Number(lastNotif) < 4 * 60 * 60 * 1e3) {
      return c.json({ sent: false, reason: "rate_limited" });
    }
    const name = firstName || "\u0434\u0440\u0443\u0433";
    let msgText = "";
    if (riskLevel === "critical") {
      msgText = `\u{1F6A8} <b>\u0412\u043D\u0438\u043C\u0430\u043D\u0438\u0435, ${name}!</b>

\u0422\u043E\u043C\u0438 \u0437\u0430\u043C\u0435\u0442\u0438\u043B \u0442\u0440\u0435\u0432\u043E\u0436\u043D\u044B\u0435 \u0441\u0438\u0433\u043D\u0430\u043B\u044B:
${reasons.map((r) => `\u2022 ${r}`).join("\n")}

\u0417\u0430\u0439\u0434\u0438 \u0432 Vecto, \u044F \u043F\u043E\u043C\u043E\u0433\u0443 \u0443\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u044C \u043F\u043B\u0430\u043D.`;
    } else if (riskLevel === "high") {
      msgText = `\u26A0\uFE0F <b>\u041C\u0438\u043D\u0438-\u0447\u0435\u043A\u0438\u043D \u043E\u0442 \u0422\u043E\u043C\u0438</b>

${name}, \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E \u0441\u0438\u0433\u043D\u0430\u043B\u043E\u0432 \u0443\u043A\u0430\u0437\u044B\u0432\u0430\u044E\u0442 \u043D\u0430 \u0441\u043F\u0430\u0434:
${reasons.map((r) => `\u2022 ${r}`).join("\n")}

\u0414\u0430\u0432\u0430\u0439 \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0438\u043C, \u0447\u0442\u043E \u043C\u043E\u0436\u043D\u043E \u043E\u0431\u043B\u0435\u0433\u0447\u0438\u0442\u044C.`;
    } else if (streak && streak > 3) {
      msgText = `\u{1F525} <b>\u0421\u0442\u0440\u0438\u043A \u0432 \u043E\u043F\u0430\u0441\u043D\u043E\u0441\u0442\u0438!</b>

${name}, \u0443 \u0442\u0435\u0431\u044F \u0441\u0435\u0440\u0438\u044F ${streak} \u0434\u043D\u0435\u0439, \u043D\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0435\u0449\u0451 \u043D\u0435\u0442 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u044B\u0445 \u0437\u0430\u0434\u0430\u0447.`;
    } else {
      msgText = `\u{1F4A1} <b>\u041D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0435 \u043E\u0442 \u0422\u043E\u043C\u0438</b>

\u041C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0439 \u0448\u0430\u0433 \u043B\u0443\u0447\u0448\u0435, \u0447\u0435\u043C \u0441\u0442\u043E\u044F\u0442\u044C \u043D\u0430 \u043C\u0435\u0441\u0442\u0435. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0438\u0442\u044C \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0443 \u0437\u0430\u0434\u0430\u0447\u0443.`;
    }
    await tgCall("sendMessage", { chat_id: chatId, text: msgText, parse_mode: "HTML" });
    await set(lastKey, String(Date.now()));
    console.log(`Telegram risk notification: user=${user.id}, level=${riskLevel}`);
    return c.json({ sent: true });
  } catch (err) {
    console.log(`Telegram risk-notify error: ${err}`);
    return c.json({ sent: false, reason: `error: ${err.message || err}` });
  }
});

// ai.tsx
import { Hono as Hono2 } from "npm:hono";

// ai-shared.tsx
import { createClient as createClient3 } from "npm:@supabase/supabase-js";
var OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";
var OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY_2") || Deno.env.get("OPENAI_API_KEY") || "";
var NO_DASH_RULE = "\n\n\u0421\u0422\u0418\u041B\u042C \u0422\u0415\u041A\u0421\u0422\u0410: \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0434\u043B\u0438\u043D\u043D\u043E\u0435 \u0442\u0438\u0440\u0435 (\u0441\u0438\u043C\u0432\u043E\u043B \u2014) \u0438 \u043A\u043E\u0440\u043E\u0442\u043A\u043E\u0435 \u0442\u0438\u0440\u0435 (\u2013). \u0412\u043C\u0435\u0441\u0442\u043E \u043D\u0438\u0445 \u0441\u0442\u0430\u0432\u044C \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u0434\u0432\u043E\u0435\u0442\u043E\u0447\u0438\u0435 \u0438\u043B\u0438 \u043D\u0430\u0447\u0438\u043D\u0430\u0439 \u043D\u043E\u0432\u043E\u0435 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u0435.";
function stripDashes(value) {
  if (typeof value === "string") {
    return value.replace(/(\d)\s*[\u2013\u2014]\s*(\d)/g, "$1-$2").replace(/\s+[\u2013\u2014]\s+/g, ", ").replace(/[\u2013\u2014]/g, "-").replace(/,\s*,/g, ",");
  }
  if (Array.isArray(value)) return value.map(stripDashes);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = stripDashes(v);
    return out;
  }
  return value;
}
async function callOpenAI(opts) {
  const res = await fetch(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: opts.model ?? "gpt-4o-mini",
      messages: [{ role: "system", content: opts.system + NO_DASH_RULE }, { role: "user", content: opts.user }],
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 600,
      response_format: { type: "json_object" }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    console.log(`OpenAI error ${res.status}: ${errText}`);
    if (res.status === 429) throw Object.assign(new Error("AI rate limited"), { code: "rate_limited" });
    if (res.status === 402 || errText.includes("insufficient_quota")) throw Object.assign(new Error("AI quota exceeded"), { code: "quota_exceeded" });
    throw new Error(`AI request failed: ${res.status}`);
  }
  const completion = await res.json();
  const raw = completion.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty AI response");
  try {
    return stripDashes(JSON.parse(raw));
  } catch {
    console.log(`Failed to parse AI JSON: ${raw.slice(0, 300)}`);
    throw Object.assign(new Error("AI returned invalid JSON"), { code: "parse_error" });
  }
}
async function tryGetUser(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  if (!token.includes(".")) return null;
  try {
    const supabase = createClient3(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    );
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
  } catch {
    return null;
  }
}

// access.tsx
import { createClient as createClient4 } from "npm:@supabase/supabase-js";
var TIER_RANK = { free: 0, basic: 1, premium: 2 };
var PLAN_LIMIT = { free: 2, basic: 5, premium: Infinity };
var DAILY_AI_LIMIT = { free: 30, basic: 150, premium: 400 };
var ANON_DAILY_LIMIT = { "/generate-plan": 2, "/ai/clarify-goal": 6, "/ai/check-goal": 6 };
var FEATURE_TIER = {
  // Базовое планирование (бесплатно)
  "/generate-plan": "free",
  "/ai/clarify-goal": "free",
  "/ai/check-goal": "free",
  "/ai/parse-task": "free",
  // «Базовый»: валидация сроков, итеративное улучшение, шаблоны структуры
  "/ai/validate-deadline": "basic",
  "/ai/regenerate-phase": "basic",
  "/ai/expand-phase": "basic",
  "/ai/generate-milestones": "basic",
  "/ai/panic-mode": "basic",
  "/ai/phase-retro": "basic",
  // «Все включено»: Томи и аналитика
  "/ai/tomi": "premium",
  "/ai/morning-briefing": "premium",
  "/ai/tomi-insights": "premium",
  "/ai/tomi-preventive": "premium",
  "/ai/what-if": "premium",
  "/ai/suggest-habits": "premium",
  "/ai/smart-replan": "premium",
  "/ai/digest": "premium",
  "/ai/smart-reminder-times": "premium",
  "/ai/forecast": "premium"
};
function db() {
  return createClient4(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}
async function getVectoTier(userId) {
  const { data } = await db().from("user_access").select("plan, status, expires_at").eq("user_id", userId).eq("project", "vecto").maybeSingle();
  if (!data || data.status !== "active") return { tier: "free", expiresAt: null };
  if (data.expires_at && new Date(data.expires_at) <= /* @__PURE__ */ new Date()) return { tier: "free", expiresAt: data.expires_at };
  const tier = ["basic", "premium"].includes(data.plan) ? data.plan : "free";
  return { tier, expiresAt: data.expires_at ?? null };
}
function tierAllows(tier, required) {
  return TIER_RANK[tier] >= TIER_RANK[required];
}
function today() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function currentMonth() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
}
async function bump(key) {
  const prev = Number(await get(key) ?? 0) || 0;
  const next = prev + 1;
  await set(key, String(next));
  return next;
}
async function read(key) {
  return Number(await get(key) ?? 0) || 0;
}
function clientIp(c) {
  const xf = c.req.header("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || c.req.header("cf-connecting-ip") || "unknown";
}
function routeKey(path) {
  const i = path.indexOf("/make-server-a5927615");
  const p = i >= 0 ? path.slice(i + "/make-server-a5927615".length) : path;
  return p.replace(/\/+$/, "");
}
async function aiGuard(c, next) {
  if (c.req.method === "OPTIONS") return next();
  if (c.get("aiGuarded")) return next();
  c.set("aiGuarded", true);
  const key = routeKey(c.req.path);
  if (!key.startsWith("/ai/") && key !== "/generate-plan") return next();
  const required = FEATURE_TIER[key] ?? "premium";
  const user = await tryGetUser(c.req.header("Authorization"));
  if (!user) {
    const anonLimit = ANON_DAILY_LIMIT[key];
    if (!anonLimit) {
      return c.json({ error: "\u0412\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u044D\u0442\u043E\u0439 \u0444\u0443\u043D\u043A\u0446\u0438\u0435\u0439", code: "auth_required" }, 401);
    }
    const used2 = await bump(`rl:anon:${clientIp(c)}:${key}:${today()}`);
    if (used2 > anonLimit) {
      return c.json({ error: "\u041B\u0438\u043C\u0438\u0442 \u0431\u0435\u0437 \u0432\u0445\u043E\u0434\u0430 \u043D\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D. \u0412\u043E\u0439\u0434\u0438\u0442\u0435, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C.", code: "auth_required" }, 429);
    }
    c.set("tier", "free");
    return next();
  }
  const { tier } = await getVectoTier(user.id);
  c.set("userId", user.id);
  c.set("tier", tier);
  if (!tierAllows(tier, required)) {
    return c.json({ error: "\u0424\u0443\u043D\u043A\u0446\u0438\u044F \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430 \u043D\u0430 \u0434\u0440\u0443\u0433\u043E\u043C \u0442\u0430\u0440\u0438\u0444\u0435", code: "upgrade_required", required, tier }, 402);
  }
  const used = await bump(`rl:user:${user.id}:${today()}`);
  if (used > DAILY_AI_LIMIT[tier]) {
    return c.json({ error: "\u0414\u043D\u0435\u0432\u043D\u043E\u0439 \u043B\u0438\u043C\u0438\u0442 \u0437\u0430\u043F\u0440\u043E\u0441\u043E\u0432 \u043A \u0418\u0418 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0437\u0430\u0432\u0442\u0440\u0430.", code: "rate_limited" }, 429);
  }
  if (key === "/generate-plan") {
    const usage = await read(`user:${user.id}:usage:${currentMonth()}`);
    if (usage >= PLAN_LIMIT[tier]) {
      return c.json({ error: "\u041B\u0438\u043C\u0438\u0442 \u043F\u043B\u0430\u043D\u043E\u0432 \u043D\u0430 \u044D\u0442\u043E\u0442 \u043C\u0435\u0441\u044F\u0446 \u0438\u0441\u0447\u0435\u0440\u043F\u0430\u043D", code: "plan_limit", limit: PLAN_LIMIT[tier], tier }, 402);
    }
  }
  return next();
}
async function countPlan(userId) {
  if (!userId) return;
  await bump(`user:${userId}:usage:${currentMonth()}`);
}

// ai.tsx
var ai = new Hono2();
ai.use("/*", aiGuard);
ai.post("/generate-plan", async (c) => {
  try {
    const { goal, deadline, hours_per_week } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);
    const today2 = /* @__PURE__ */ new Date();
    const deadlineDate = deadline ? new Date(deadline) : new Date(Date.now() + 90 * 24 * 60 * 60 * 1e3);
    const totalDays = Math.ceil((deadlineDate.getTime() - today2.getTime()) / (24 * 60 * 60 * 1e3));
    const hoursPerWeek = hours_per_week || 10;
    const hoursPerDay = hoursPerWeek / 7;
    const totalAvailableHours = Math.floor(totalDays * hoursPerDay);
    const todayStr = today2.toISOString().slice(0, 10);
    const deadlineStr = deadlineDate.toISOString().slice(0, 10);
    const systemPrompt = `\u0422\u044B \u043F\u0440\u043E\u0444\u0435\u0441\u0441\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0449\u0438\u043A \u0438 \u044D\u043A\u0441\u043F\u0435\u0440\u0442 \u043F\u043E \u0443\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u044E \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C.

\u041A\u0420\u0418\u0422\u0418\u0427\u0415\u0421\u041A\u0418 \u0412\u0410\u0416\u041D\u041E, \u041F\u0420\u041E\u0427\u0418\u0422\u0410\u0419 \u0412\u041D\u0418\u041C\u0410\u0422\u0415\u041B\u042C\u041D\u041E:
\u0417\u0410\u041F\u0420\u0415\u0429\u0415\u041D\u041E \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u044C \u043E\u0431\u0449\u0438\u0435 \u0448\u0430\u0431\u043B\u043E\u043D\u043D\u044B\u0435 \u0444\u0440\u0430\u0437\u044B \u0442\u0438\u043F\u0430:
\u274C "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0438 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"
\u274C "\u041F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435"
\u274C "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"
\u274C "\u0420\u0435\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u044F"
\u274C "\u041E\u0446\u0435\u043D\u043A\u0430 \u0438 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u043A\u0430"
\u274C "\u0421\u0431\u043E\u0440 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438"
\u274C "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0446\u0435\u043B\u044C"
\u274C "\u0410\u043D\u0430\u043B\u0438\u0437 \u0440\u0438\u0441\u043A\u043E\u0432"

\u0412\u0421\u0415 \u0444\u0430\u0437\u044B \u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u0434\u043E\u043B\u0436\u043D\u044B \u0431\u044B\u0442\u044C \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B\u041C\u0418 \u0438 \u0421\u041F\u0415\u0426\u0418\u0424\u0418\u0427\u041D\u042B\u041C\u0418 \u0434\u043B\u044F \u0446\u0435\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F!

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u041F\u0420\u0418\u041C\u0415\u0420 1. \u0426\u0435\u043B\u044C: "\u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0438\u043D\u0442\u0435\u0440\u043D\u0435\u0442-\u043C\u0430\u0433\u0430\u0437\u0438\u043D \u043A\u0435\u0440\u0430\u043C\u0438\u043A\u0438"
\u041F\u0420\u0410\u0412\u0418\u041B\u042C\u041D\u041E \u2705:
\u0424\u0430\u0437\u0430 1: "\u0410\u0441\u0441\u043E\u0440\u0442\u0438\u043C\u0435\u043D\u0442 \u0438 \u043F\u043E\u0441\u0442\u0430\u0432\u0449\u0438\u043A\u0438" (14 \u0434\u043D\u0435\u0439)
  - \u041E\u0442\u043E\u0431\u0440\u0430\u0442\u044C 20 \u043F\u043E\u0437\u0438\u0446\u0438\u0439 \u0434\u043B\u044F \u043F\u0435\u0440\u0432\u043E\u0439 \u043A\u043E\u043B\u043B\u0435\u043A\u0446\u0438\u0438 (4\u0447)
  - \u0414\u043E\u0433\u043E\u0432\u043E\u0440\u0438\u0442\u044C\u0441\u044F \u0441 \u0434\u0432\u0443\u043C\u044F \u043C\u0430\u0441\u0442\u0435\u0440\u0441\u043A\u0438\u043C\u0438 \u043E \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0430\u0445 (6\u0447)
  - \u0421\u0434\u0435\u043B\u0430\u0442\u044C \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u0443\u044E \u0441\u044A\u0451\u043C\u043A\u0443 \u043E\u0431\u0440\u0430\u0437\u0446\u043E\u0432 (5\u0447)
\u0424\u0430\u0437\u0430 2: "\u0421\u0430\u0439\u0442 \u0438 \u043E\u043F\u043B\u0430\u0442\u0430" (21 \u0434\u0435\u043D\u044C)
  - \u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D \u043D\u0430 Tilda \u0441 \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u043E\u043C (10\u0447)
  - \u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0438\u0442\u044C \u043E\u043D\u043B\u0430\u0439\u043D-\u043E\u043F\u043B\u0430\u0442\u0443 \u0438 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0443 \u0421\u0414\u042D\u041A (4\u0447)
\u0424\u0430\u0437\u0430 3: "\u041F\u0435\u0440\u0432\u044B\u0435 \u043F\u0440\u043E\u0434\u0430\u0436\u0438" (30 \u0434\u043D\u0435\u0439)
  - \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0442\u0430\u0440\u0433\u0435\u0442 \u043D\u0430 \u0430\u0443\u0434\u0438\u0442\u043E\u0440\u0438\u044E \u043B\u044E\u0431\u0438\u0442\u0435\u043B\u0435\u0439 \u0438\u043D\u0442\u0435\u0440\u044C\u0435\u0440\u0430 (6\u0447)
  - \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043F\u043E\u0441\u044B\u043B\u043A\u0438 \u043F\u0435\u0440\u0432\u044B\u043C 10 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044F\u043C (5\u0447)

\u041F\u0420\u0418\u041C\u0415\u0420 2. \u0426\u0435\u043B\u044C: "\u0412\u044B\u0443\u0447\u0438\u0442\u044C \u0430\u043D\u0433\u043B\u0438\u0439\u0441\u043A\u0438\u0439 \u0434\u043E \u0443\u0440\u043E\u0432\u043D\u044F B2 \u0437\u0430 \u043F\u043E\u043B\u0433\u043E\u0434\u0430"
\u041F\u0420\u0410\u0412\u0418\u041B\u042C\u041D\u041E \u2705:
\u0424\u0430\u0437\u0430 1: "\u0414\u0438\u0430\u0433\u043D\u043E\u0441\u0442\u0438\u043A\u0430 \u0443\u0440\u043E\u0432\u043D\u044F" (5 \u0434\u043D\u0435\u0439)
  - \u041F\u0440\u043E\u0439\u0442\u0438 \u0442\u0435\u0441\u0442 EF SET \u0438 \u0437\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 (1\u0447)
  - \u0412\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0440\u0435\u043F\u043E\u0434\u0430\u0432\u0430\u0442\u0435\u043B\u044F \u043D\u0430 Preply \u043F\u043E \u043E\u0442\u0437\u044B\u0432\u0430\u043C (2\u0447)
\u0424\u0430\u0437\u0430 2: "\u0413\u0440\u0430\u043C\u043C\u0430\u0442\u0438\u043A\u0430 B1 \u0438 \u0441\u043B\u043E\u0432\u0430\u0440\u044C" (60 \u0434\u043D\u0435\u0439)
  - \u041F\u0440\u043E\u0445\u043E\u0434\u0438\u0442\u044C 2 \u044E\u043D\u0438\u0442\u0430 English Grammar in Use \u0432 \u043D\u0435\u0434\u0435\u043B\u044E (3\u0447/\u043D\u0435\u0434)
  - \u0423\u0447\u0438\u0442\u044C 15 \u0441\u043B\u043E\u0432 \u0432 \u0434\u0435\u043D\u044C \u0432 Anki (0.3\u0447/\u0434\u0435\u043D\u044C)

\u041F\u0420\u0418\u041C\u0415\u0420 3. \u0426\u0435\u043B\u044C: "\u041F\u0440\u043E\u0431\u0435\u0436\u0430\u0442\u044C \u043F\u043E\u043B\u0443\u043C\u0430\u0440\u0430\u0444\u043E\u043D"
\u041F\u0420\u0410\u0412\u0418\u041B\u042C\u041D\u041E \u2705:
\u0424\u0430\u0437\u0430 1: "\u0411\u0430\u0437\u043E\u0432\u0430\u044F \u0432\u044B\u043D\u043E\u0441\u043B\u0438\u0432\u043E\u0441\u0442\u044C" (28 \u0434\u043D\u0435\u0439)
  - \u0411\u0435\u0433\u0430\u0442\u044C 3 \u0440\u0430\u0437\u0430 \u0432 \u043D\u0435\u0434\u0435\u043B\u044E \u043F\u043E 30 \u043C\u0438\u043D\u0443\u0442 \u0432 \u043B\u0451\u0433\u043A\u043E\u043C \u0442\u0435\u043C\u043F\u0435 (1.5\u0447/\u043D\u0435\u0434)
  - \u041A\u0443\u043F\u0438\u0442\u044C \u0431\u0435\u0433\u043E\u0432\u044B\u0435 \u043A\u0440\u043E\u0441\u0441\u043E\u0432\u043A\u0438 \u043F\u043E\u0441\u043B\u0435 \u0430\u043D\u0430\u043B\u0438\u0437\u0430 \u0441\u0442\u043E\u043F\u044B (2\u0447)
\u0424\u0430\u0437\u0430 2: "\u0414\u043B\u0438\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0431\u0435\u0436\u043A\u0438" (42 \u0434\u043D\u044F)
  - \u041A\u0430\u0436\u0434\u043E\u0435 \u0432\u043E\u0441\u043A\u0440\u0435\u0441\u0435\u043D\u044C\u0435 \u0443\u0432\u0435\u043B\u0438\u0447\u0438\u0432\u0430\u0442\u044C \u0434\u043B\u0438\u043D\u043D\u0443\u044E \u043F\u0440\u043E\u0431\u0435\u0436\u043A\u0443 \u043D\u0430 1 \u043A\u043C (1.5\u0447/\u043D\u0435\u0434)

\u041D\u0415\u041F\u0420\u0410\u0412\u0418\u041B\u042C\u041D\u041E \u274C:
\u0424\u0430\u0437\u0430 1: "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430 \u0438 \u0438\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435"
  - \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0438 \u0443\u0442\u043E\u0447\u043D\u0438\u0442\u044C \u0446\u0435\u043B\u044C
  - \u0421\u0431\u043E\u0440 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438 \u0438 \u0440\u0435\u0441\u0443\u0440\u0441\u043E\u0432

\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

\u0422\u0412\u041E\u042F \u0417\u0410\u0414\u0410\u0427\u0410:
\u0421\u043E\u0437\u0434\u0430\u0439 \u043F\u043B\u0430\u043D \u0434\u043B\u044F \u0446\u0435\u043B\u0438: "${goal}"

\u0412\u0425\u041E\u0414\u041D\u042B\u0415 \u0414\u0410\u041D\u041D\u042B\u0415:
- \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0434\u043D\u0435\u0439: ${totalDays}
- \u0427\u0430\u0441\u043E\u0432 \u0432 \u0434\u0435\u043D\u044C: ${hoursPerDay.toFixed(1)}
- \u0412\u0441\u0435\u0433\u043E \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E\u0433\u043E \u0432\u0440\u0435\u043C\u0435\u043D\u0438: ${totalAvailableHours} \u0447\u0430\u0441\u043E\u0432
- \u0421\u0435\u0433\u043E\u0434\u043D\u044F: ${todayStr}
- \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadlineStr}

\u0410\u041B\u0413\u041E\u0420\u0418\u0422\u041C:
1. \u0412\u041D\u0418\u041C\u0410\u0422\u0415\u041B\u042C\u041D\u041E \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0439 \u0446\u0435\u043B\u044C
2. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438 \u0422\u0415\u041C\u0410\u0422\u0418\u041A\u0423 (\u043C\u0435\u0434\u0438\u0446\u0438\u043D\u0430/\u0441\u043F\u043E\u0440\u0442/\u0431\u0438\u0437\u043D\u0435\u0441/\u0443\u0447\u0435\u0431\u0430/\u0445\u043E\u0431\u0431\u0438 \u0438 \u0442.\u0434.)
3. \u041F\u0440\u0438\u0434\u0443\u043C\u0430\u0439 3-5 \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B\u0425 \u044D\u0442\u0430\u043F\u043E\u0432 \u0434\u043B\u044F \u042D\u0422\u041E\u0419 \u0442\u0435\u043C\u0430\u0442\u0438\u043A\u0438
4. \u0412 \u043A\u0430\u0436\u0434\u043E\u043C \u044D\u0442\u0430\u043F\u0435 \u0441\u043E\u0437\u0434\u0430\u0439 2-5 \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B\u0425 \u0437\u0430\u0434\u0430\u0447
5. \u041D\u0418 \u041E\u0414\u041D\u0410 \u0444\u0430\u0437\u0430/\u0437\u0430\u0434\u0430\u0447\u0430 \u041D\u0415 \u0434\u043E\u043B\u0436\u043D\u0430 \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043E\u0431\u0449\u0438\u0435 \u0441\u043B\u043E\u0432\u0430 \u0438\u0437 \u0417\u0410\u041F\u0420\u0415\u0429\u0415\u041D\u041D\u041E\u0413\u041E \u0441\u043F\u0438\u0441\u043A\u0430

\u041F\u0420\u0410\u0412\u0418\u041B\u0410 \u041D\u0410\u0417\u0412\u0410\u041D\u0418\u0419:
\u2705 \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0435 (\u041A\u043E\u043D\u0441\u0443\u043B\u044C\u0442\u0430\u0446\u0438\u044F, \u041F\u043E\u043A\u0443\u043F\u043A\u0430, \u0418\u0437\u043C\u0435\u0440\u0435\u043D\u0438\u0435, \u0422\u0440\u0435\u043D\u0438\u0440\u043E\u0432\u043A\u0430)
\u2705 \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u0433\u043B\u0430\u0433\u043E\u043B\u044B (\u0417\u0430\u043F\u0438\u0441\u0430\u0442\u044C\u0441\u044F \u043A \u0432\u0440\u0430\u0447\u0443, \u041A\u0443\u043F\u0438\u0442\u044C \u0442\u0430\u0431\u043B\u0435\u0442\u043D\u0438\u0446\u0443, \u041D\u0430\u0441\u0442\u0440\u043E\u0438\u0442\u044C \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u044F)
\u2705 \u0411\u0443\u0434\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u043C (\u041D\u0415 "\u0421\u0431\u043E\u0440 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438", \u0430 "\u0418\u0437\u0443\u0447\u0438\u0442\u044C \u0438\u043D\u0441\u0442\u0440\u0443\u043A\u0446\u0438\u0438 \u043A \u043F\u0440\u0435\u043F\u0430\u0440\u0430\u0442\u0430\u043C")
\u2705 \u0423\u043A\u0430\u0437\u044B\u0432\u0430\u0439 \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B\u0415 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F (\u041D\u0415 "\u0420\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043D\u0430\u0434 \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u043C", \u0430 "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C 3 \u0441\u0442\u0430\u0442\u044C\u0438 \u0434\u043B\u044F \u0431\u043B\u043E\u0433\u0430")

\u0424\u041E\u0420\u041C\u0410\u0422 \u0412\u042B\u0412\u041E\u0414\u0410 (\u0421\u0422\u0420\u041E\u0413\u041E JSON):
{
  "id": "\u0443\u043D\u0438\u043A\u0430\u043B\u044C\u043D\u044B\u0439_id",
  "goal": "${goal}",
  "deadline": "${deadlineStr}",
  "hours_per_week": ${hoursPerWeek},
  "total_days": ${totalDays},
  "created_at": "${(/* @__PURE__ */ new Date()).toISOString()}",
  "phases": [
    {
      "id": "phase_1",
      "name": "\u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u041E\u0415 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u044D\u0442\u0430\u043F\u0430 (3-6 \u0441\u043B\u043E\u0432)",
      "duration_days": \u0447\u0438\u0441\u043B\u043E_\u0434\u043D\u0435\u0439,
      "color": "#1a3fa6",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "tasks": [
        {
          "id": "task_1",
          "phase_id": "phase_1",
          "title": "\u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u041E\u0415 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435 (5-10 \u0441\u043B\u043E\u0432)",
          "description": "\u0414\u0435\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u0447\u0442\u043E \u0438\u043C\u0435\u043D\u043D\u043E \u043D\u0443\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C",
          "duration_hours": \u0447\u0438\u0441\u043B\u043E_\u0447\u0430\u0441\u043E\u0432,
          "priority": "high" | "medium" | "low",
          "depends_on": [],
          "status": "todo",
          "start_date": "YYYY-MM-DD",
          "end_date": "YYYY-MM-DD",
          "recurring": false,
          "tracked_seconds": 0,
          "comments": [],
          "tags": [],
          "subtasks": [
            {"id": "sub_1", "title": "\u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0448\u0430\u0433", "done": false},
            {"id": "sub_2", "title": "\u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0448\u0430\u0433", "done": false}
          ]
        }
      ]
    }
  ]
}

\u0421\u0422\u0420\u0423\u041A\u0422\u0423\u0420\u0410:
- 3-5 \u0444\u0430\u0437, \u043A\u0430\u0436\u0434\u0430\u044F \u0421\u041F\u0415\u0426\u0418\u0424\u0418\u0427\u041D\u0410 \u0434\u043B\u044F \u0446\u0435\u043B\u0438
- 2-5 \u0437\u0430\u0434\u0430\u0447 \u0432 \u0444\u0430\u0437\u0435, \u043A\u0430\u0436\u0434\u0430\u044F \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u0410
- 2-4 \u043F\u043E\u0434\u0437\u0430\u0434\u0430\u0447\u0438 \u0432 \u0437\u0430\u0434\u0430\u0447\u0435
- \u0426\u0432\u0435\u0442\u0430 \u044D\u0442\u0430\u043F\u043E\u0432 \u043F\u043E \u043E\u0447\u0435\u0440\u0435\u0434\u0438: #1a3fa6, #5b8a6b, #b98a3e, #b4503f, #3d6ad6, #5f8580
- \u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u044B: high (\u0441\u0440\u043E\u0447\u043D\u043E), medium (\u043E\u0431\u044B\u0447\u043D\u043E), low (\u043C\u043E\u0436\u043D\u043E \u043E\u0442\u043B\u043E\u0436\u0438\u0442\u044C)

\u041F\u0420\u041E\u0412\u0415\u0420\u042C \u0421\u0415\u0411\u042F \u041F\u0415\u0420\u0415\u0414 \u041E\u0422\u0412\u0415\u0422\u041E\u041C:
- \u2753 \u0415\u0441\u0442\u044C \u043B\u0438 \u0432 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F\u0445 \u0444\u0430\u0437 \u0441\u043B\u043E\u0432\u0430 "\u041F\u043E\u0434\u0433\u043E\u0442\u043E\u0432\u043A\u0430", "\u0418\u0441\u0441\u043B\u0435\u0434\u043E\u0432\u0430\u043D\u0438\u0435", "\u041F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435"? \u2192 \u041F\u0415\u0420\u0415\u0414\u0415\u041B\u0410\u0419!
- \u2753 \u0415\u0441\u0442\u044C \u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 "\u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u0446\u0435\u043B\u044C", "\u0421\u0431\u043E\u0440 \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u0438"? \u2192 \u041F\u0415\u0420\u0415\u0414\u0415\u041B\u0410\u0419!
- \u2753 \u0412\u0441\u0435 \u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u042B \u0438 \u043F\u043E\u043D\u044F\u0442\u043D\u044B? \u2192 \u0414\u0410!
- \u2753 \u041F\u043B\u0430\u043D \u0440\u0435\u043B\u0435\u0432\u0430\u043D\u0442\u0435\u043D \u0446\u0435\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F? \u2192 \u0414\u0410!

\u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u0422\u041E\u041B\u042C\u041A\u041E \u0432\u0430\u043B\u0438\u0434\u043D\u044B\u043C JSON \u0431\u0435\u0437 markdown, \u0431\u0435\u0437 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0435\u0432, \u0431\u0435\u0437 \u043F\u043E\u044F\u0441\u043D\u0435\u043D\u0438\u0439.${NO_DASH_RULE}`;
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `\u0421\u043E\u0437\u0434\u0430\u0439 \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u043B\u0430\u043D \u0434\u043B\u044F \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F \u0446\u0435\u043B\u0438: "${goal}"` }
        ],
        temperature: 0.7,
        max_tokens: 6e3,
        response_format: { type: "json_object" }
      })
    });
    if (!res.ok) {
      const e = await res.text();
      console.log(`OpenAI error ${res.status}: ${e}`);
      return c.json({ error: `AI request failed: ${res.status}` }, 502);
    }
    const completion = await res.json();
    const content = completion.choices?.[0]?.message?.content;
    if (!content) return c.json({ error: "Empty AI response" }, 502);
    const finishReason = completion.choices?.[0]?.finish_reason;
    if (finishReason === "length") {
      console.log(`Generate plan: output truncated (finish_reason=length), goal: "${goal}"`);
      return c.json({ error: "AI response truncated, plan too complex" }, 502);
    }
    let plan;
    try {
      plan = stripDashes(JSON.parse(content));
    } catch (e) {
      console.log(`Parse error: ${e}, content snippet: ${content.slice(0, 200)}`);
      return c.json({ error: "AI returned invalid JSON" }, 502);
    }
    if (!plan?.phases || !Array.isArray(plan.phases) || plan.phases.length === 0) {
      console.log(`Invalid plan structure: phases missing or empty`);
      return c.json({ error: "AI returned invalid plan structure" }, 502);
    }
    if (!plan.id) plan.id = crypto.randomUUID();
    if (!plan.created_at) plan.created_at = (/* @__PURE__ */ new Date()).toISOString();
    if (!plan.goal) plan.goal = goal;
    if (!plan.deadline) plan.deadline = deadlineStr;
    if (!plan.hours_per_week) plan.hours_per_week = hoursPerWeek;
    if (!plan.total_days) plan.total_days = totalDays;
    await countPlan(c.get("userId"));
    console.log(`Plan generated for goal: "${goal}", ${plan.phases.length} phases, ${totalAvailableHours}h available`);
    return c.json({ plan });
  } catch (err) {
    console.log(`Generate plan error: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});
ai.post("/ai/tomi", async (c) => {
  try {
    const { messages, context, username, personality, planStats } = await c.req.json();
    if (!Array.isArray(messages) || messages.length === 0) return c.json({ error: "messages array is required" }, 400);
    const name = (username || "").trim();
    const nameClause = name ? `\u0418\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: ${name}. \u041E\u0431\u0440\u0430\u0449\u0430\u0439\u0441\u044F \u043F\u043E \u0438\u043C\u0435\u043D\u0438 \u0442\u0435\u043F\u043B\u043E \u0438 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u043E.` : `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u043B\u0441\u044F.`;
    const stats = planStats ?? {};
    const progress = stats.progress ?? 0;
    const overdueCount = stats.overdueCount ?? 0;
    const daysLeft = stats.daysLeft ?? null;
    const lastActivityDays = stats.lastActivityDays ?? 0;
    let proactiveInstruction = "";
    if (lastActivityDays >= 3 && progress < 80) {
      proactiveInstruction = `\u0412\u0410\u0416\u041D\u041E: \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u043B \u0437\u0430\u0434\u0430\u0447\u0438 \u0443\u0436\u0435 ${lastActivityDays} \u0434\u043D\u0435\u0439, \u0430 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0432\u0441\u0435\u0433\u043E ${progress}%. \u041C\u044F\u0433\u043A\u043E, \u043D\u043E \u043D\u0430\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E \u043F\u043E\u0434\u0442\u043E\u043B\u043A\u043D\u0438 \u0435\u0433\u043E \u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044E. \u0421\u043F\u0440\u043E\u0441\u0438, \u0447\u0442\u043E \u043C\u0435\u0448\u0430\u0435\u0442, \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u0443\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u044C \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0443\u044E \u0437\u0430\u0434\u0430\u0447\u0443.`;
    } else if (overdueCount > 2) {
      proactiveInstruction = `\u0412\u0410\u0416\u041D\u041E: ${overdueCount} \u0437\u0430\u0434\u0430\u0447 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E. \u041D\u0435 \u043F\u0430\u043D\u0438\u043A\u0443\u0439, \u043D\u043E \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043F\u043B\u0430\u043D: \u0447\u0442\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F, \u0447\u0442\u043E \u043E\u0442\u043B\u043E\u0436\u0438\u0442\u044C, \u0447\u0442\u043E \u0443\u0434\u0430\u043B\u0438\u0442\u044C.`;
    } else if (progress >= 75 && daysLeft !== null && daysLeft > 7) {
      proactiveInstruction = `\u0412\u0410\u0416\u041D\u041E: \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 ${progress}%! \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043C\u043E\u043B\u043E\u0434\u0435\u0446: \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u043E\u0445\u0432\u0430\u043B\u0438, \u043E\u0442\u043C\u0435\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0438 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u0443\u0441\u043A\u043E\u0440\u0438\u0442\u044C\u0441\u044F \u0438\u043B\u0438 \u0432\u0437\u044F\u0442\u044C \u043D\u0435\u0431\u043E\u043B\u044C\u0448\u0443\u044E \u043F\u0435\u0440\u0435\u0434\u044B\u0448\u043A\u0443.`;
    } else if (lastActivityDays === 0 && progress < 30) {
      proactiveInstruction = `\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0447\u0438\u043D\u0430\u0435\u0442 \u0438\u043B\u0438 \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E \u0437\u0430\u0445\u043E\u0434\u0438\u0442. \u041F\u043E\u0434\u0434\u0435\u0440\u0436\u0438, \u043F\u043E\u043C\u043E\u0433\u0438 \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u043F\u0435\u0440\u0432\u0443\u044E \u0437\u0430\u0434\u0430\u0447\u0443 \u0441 \u0447\u0435\u0433\u043E \u043D\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u044F\u043C\u043E \u0441\u0435\u0439\u0447\u0430\u0441.`;
    }
    const pMap = {
      strict: `\u0421\u0422\u0420\u041E\u0413\u0418\u0419 \u041A\u041E\u0423\u0427: \u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0434\u0435\u0434\u043B\u0430\u0439\u043D\u044B, \u043D\u0438\u043A\u0430\u043A\u0438\u0445 \u043E\u043F\u0440\u0430\u0432\u0434\u0430\u043D\u0438\u0439. \u0413\u043E\u0432\u043E\u0440\u0438\u0448\u044C \u043A\u0440\u0430\u0442\u043A\u043E \u0438 \u043F\u043E \u0434\u0435\u043B\u0443. \u0415\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u0437\u0430\u0442\u044F\u0433\u0438\u0432\u0430\u0435\u0442, \u043F\u0440\u044F\u043C\u043E \u0441\u043A\u0430\u0436\u0438 \u043E\u0431 \u044D\u0442\u043E\u043C. \u0421\u0442\u0430\u0432\u0438\u0448\u044C \u0447\u0451\u0442\u043A\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438 "\u0441\u0434\u0435\u043B\u0430\u0439 \u044D\u0442\u043E \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u043A 18:00". \u041D\u0435 \u0443\u0442\u0435\u0448\u0430\u0435\u0448\u044C, \u0430 \u043C\u043E\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0448\u044C \u0447\u0435\u0440\u0435\u0437 \u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u043E\u0441\u0442\u044C.`,
      soft: `\u041C\u042F\u0413\u041A\u0418\u0419 \u041A\u041E\u0423\u0427: \u0422\u0451\u043F\u043B\u044B\u0439, \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u0438\u0432\u0430\u044E\u0449\u0438\u0439, \u0441\u043E\u0447\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0448\u044C \u0442\u0440\u0443\u0434\u043D\u043E\u0441\u0442\u044F\u043C. \u0425\u0432\u0430\u043B\u0438\u0448\u044C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435 \u043F\u043E\u0431\u0435\u0434\u044B. \u0415\u0441\u043B\u0438 \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0443\u0441\u0442\u0430\u043B, \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0448\u044C \u043E\u0442\u0434\u044B\u0445 \u0438 \u0433\u043E\u0432\u043E\u0440\u0438\u0448\u044C "\u043A\u0430\u0436\u0435\u0442\u0441\u044F, \u0442\u0435\u0431\u0435 \u043D\u0443\u0436\u043D\u0430 \u043F\u0430\u0443\u0437\u0430, \u044D\u0442\u043E \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E". \u041C\u043E\u0442\u0438\u0432\u0438\u0440\u0443\u0435\u0448\u044C \u0447\u0435\u0440\u0435\u0437 \u043F\u0440\u0438\u043D\u044F\u0442\u0438\u0435 \u0438 \u043F\u043E\u0441\u0442\u0435\u043F\u0435\u043D\u043D\u044B\u0439 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441.`,
      business: `\u0414\u0415\u041B\u041E\u0412\u041E\u0419 \u041F\u041B\u0410\u041D\u0418\u0420\u041E\u0412\u0429\u0418\u041A: \u041E\u043F\u0435\u0440\u0438\u0440\u0443\u0435\u0448\u044C \u043C\u0435\u0442\u0440\u0438\u043A\u0430\u043C\u0438, KPI, ROI. "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E 60% \u0437\u0430\u0434\u0430\u0447, \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C 8 \u0434\u043D\u0435\u0439, \u043D\u0443\u0436\u043D\u043E \u0443\u0441\u043A\u043E\u0440\u0438\u0442\u044C\u0441\u044F \u043D\u0430 15%". \u041F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0448\u044C \u0447\u0435\u043A\u043B\u0438\u0441\u0442\u044B, \u043E\u043F\u0442\u0438\u043C\u0438\u0437\u0430\u0446\u0438\u044E \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432. \u041B\u0430\u043A\u043E\u043D\u0438\u0447\u043D\u043E, \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u0438\u0440\u043E\u0432\u0430\u043D\u043E, \u0431\u0435\u0437 \u043B\u0438\u0440\u0438\u043A\u0438.`,
      motivational: `\u042D\u041D\u0415\u0420\u0413\u0418\u0427\u041D\u042B\u0419 \u041C\u041E\u0422\u0418\u0412\u0410\u0422\u041E\u0420: \u0417\u0430\u0440\u044F\u0436\u0430\u0435\u0448\u044C \u044D\u043D\u0435\u0440\u0433\u0438\u0435\u0439, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0448\u044C \u044D\u043C\u043E\u0434\u0437\u0438 \u{1F525}\u{1F4AA}\u{1F680}. \u041E\u0442\u043C\u0435\u0447\u0430\u0435\u0448\u044C \u043A\u0430\u0436\u0434\u0443\u044E \u043F\u043E\u0431\u0435\u0434\u0443 \u0433\u0440\u043E\u043C\u043A\u043E. "\u0412\u041E\u0422 \u042D\u0422\u041E \u0414\u0410! \u0422\u044B \u0442\u043E\u043B\u044C\u043A\u043E \u0447\u0442\u043E \u043F\u0440\u043E\u0448\u0451\u043B 60% \u043F\u043B\u0430\u043D\u0430, \u0442\u044B \u043F\u0440\u043E\u0441\u0442\u043E \u043A\u043E\u0441\u043C\u043E\u0441!" \u0415\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0435 \u0434\u0435\u043B\u0430\u044E\u0442\u0441\u044F, \u0440\u0430\u0437\u0436\u0438\u0433\u0430\u0435\u0448\u044C \u0430\u0437\u0430\u0440\u0442 "\u0434\u0430\u0432\u0430\u0439, \u0442\u044B \u043C\u043E\u0436\u0435\u0448\u044C, \u044F \u0432\u0435\u0440\u044E \u0432 \u0442\u0435\u0431\u044F!".`,
      zen: `\u0414\u0417\u0415\u041D-\u041C\u0410\u0421\u0422\u0415\u0420: \u0421\u043F\u043E\u043A\u043E\u0439\u043D\u044B\u0439, \u043C\u0435\u0434\u0438\u0442\u0430\u0442\u0438\u0432\u043D\u044B\u0439. \u041F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C \u043D\u0430\u0439\u0442\u0438 \u0431\u0430\u043B\u0430\u043D\u0441 \u043C\u0435\u0436\u0434\u0443 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C \u0438 \u043E\u0442\u0434\u044B\u0445\u043E\u043C. "\u041A\u0430\u0436\u0434\u044B\u0439 \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0439 \u0448\u0430\u0433 \u0443\u0436\u0435 \u0434\u0432\u0438\u0436\u0435\u043D\u0438\u0435". \u041F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0448\u044C \u0440\u0430\u0437\u0431\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430 \u0441\u043E\u0432\u0441\u0435\u043C \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0438\u0435 \u0447\u0430\u0441\u0442\u0438. \u041D\u0438\u043A\u0430\u043A\u043E\u0433\u043E \u0434\u0430\u0432\u043B\u0435\u043D\u0438\u044F: \u0442\u043E\u043B\u044C\u043A\u043E \u043C\u0443\u0434\u0440\u044B\u0435 \u043D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u044F.`,
      spartan: `\u0421\u041F\u0410\u0420\u0422\u0410\u041D\u0415\u0426: \u0416\u0451\u0441\u0442\u043A\u043E, \u043A\u0440\u0430\u0442\u043A\u043E, \u0431\u0435\u0437 \u043A\u043E\u043C\u043F\u0440\u043E\u043C\u0438\u0441\u0441\u043E\u0432. "\u0421\u0434\u0435\u043B\u0430\u043B, \u043C\u043E\u043B\u043E\u0434\u0435\u0446. \u041D\u0435 \u0441\u0434\u0435\u043B\u0430\u043B? \u041F\u0440\u0438\u0447\u0438\u043D \u043D\u0435\u0442, \u0435\u0441\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B". \u041A\u043E\u0440\u043E\u0442\u043A\u0438\u0435 \u043A\u043E\u043C\u0430\u043D\u0434\u044B. \u041D\u0435 \u0436\u0430\u043B\u0435\u0435\u0448\u044C, \u043D\u043E \u0438 \u043D\u0435 \u043E\u0431\u0438\u0436\u0430\u0435\u0448\u044C. \u0423\u0432\u0430\u0436\u0430\u0435\u0448\u044C \u0441\u0438\u043B\u0443 \u0432\u043E\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.`,
      joker: `\u0412\u0415\u0421\u0415\u041B\u042C\u0427\u0410\u041A: \u041B\u0451\u0433\u043A\u0438\u0439 \u044E\u043C\u043E\u0440, \u0448\u0443\u0442\u043A\u0438, \u043D\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C. "\u041B\u0430\u0434\u043D\u043E-\u043B\u0430\u0434\u043D\u043E, \u044F \u0432\u0438\u0436\u0443 \u0442\u044B \u043E\u043F\u044F\u0442\u044C \u0442\u044F\u043D\u0435\u0448\u044C \u0441 \u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438 \u{1F604} \u041D\u043E \u044D\u0442\u043E \u043D\u0430\u0448\u0430 \u0441 \u0442\u043E\u0431\u043E\u0439 \u043C\u0430\u043B\u0435\u043D\u044C\u043A\u0430\u044F \u0442\u0430\u0439\u043D\u0430. \u0414\u0430\u0432\u0430\u0439 \u0440\u0430\u0437\u0431\u0435\u0440\u0451\u043C\u0441\u044F!". \u0421\u043C\u0435\u0451\u0448\u044C\u0441\u044F \u0432\u043C\u0435\u0441\u0442\u0435 \u0441 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u043C \u043D\u0430\u0434 \u0442\u0440\u0443\u0434\u043D\u043E\u0441\u0442\u044F\u043C\u0438, \u043D\u043E \u0434\u043E\u0432\u043E\u0434\u0438\u0448\u044C \u0434\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430.`
    };
    const pClause = pMap[personality] || pMap.soft;
    const systemPrompt = `\u0422\u044B \u0422\u043E\u043C\u0438, \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u044C\u043D\u044B\u0439 AI-\u043A\u043E\u0443\u0447 \u0438 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 Vecto. ${nameClause}

\u0422\u0412\u041E\u042F \u0420\u041E\u041B\u042C:
\u0422\u044B \u043D\u0435 \u043F\u0440\u043E\u0441\u0442\u043E \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0448\u044C \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441\u044B, \u0442\u044B \u0410\u041A\u0422\u0418\u0412\u041D\u041E \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044E \u0434\u0432\u0438\u0433\u0430\u0442\u044C\u0441\u044F \u043A \u0446\u0435\u043B\u0438. \u0422\u044B \u0437\u043D\u0430\u0435\u0448\u044C \u0435\u0433\u043E \u043F\u043B\u0430\u043D \u0434\u0435\u0442\u0430\u043B\u044C\u043D\u043E, \u0432\u0438\u0434\u0438\u0448\u044C \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441 \u0438 \u043F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C \u0430\u0434\u0430\u043F\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043F\u043B\u0430\u043D \u043F\u043E\u0434 \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C.

\u0421\u0422\u0418\u041B\u042C \u041E\u0411\u0429\u0415\u041D\u0418\u042F: ${pClause}

${proactiveInstruction ? `\u0422\u0415\u041A\u0423\u0429\u0410\u042F \u0421\u0418\u0422\u0423\u0410\u0426\u0418\u042F (\u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 \u044D\u0442\u043E \u0434\u043B\u044F \u043E\u0442\u0432\u0435\u0442\u0430): ${proactiveInstruction}` : ""}

\u0422\u0412\u041E\u0418 \u041A\u041B\u042E\u0427\u0415\u0412\u042B\u0415 \u0417\u0410\u0414\u0410\u0427\u0418:
1. \u0410\u041D\u0410\u041B\u0418\u0417 \u041F\u0420\u041E\u0413\u0420\u0415\u0421\u0421\u0410: \u0415\u0441\u043B\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043C\u043E\u043B\u0447\u0438\u0442 \u043F\u0440\u043E \u0437\u0430\u0434\u0430\u0447\u0438, \u0441\u0430\u043C \u0441\u043F\u0440\u043E\u0441\u0438 \u043A\u0430\u043A \u0434\u0435\u043B\u0430, \u0447\u0442\u043E \u043C\u0435\u0448\u0430\u0435\u0442, \u0447\u0442\u043E \u0443\u0436\u0435 \u0441\u0434\u0435\u043B\u0430\u043D\u043E.
2. \u0410\u0414\u0410\u041F\u0422\u0410\u0426\u0418\u042F \u041F\u041B\u0410\u041D\u0410: \u041F\u043E\u043C\u043E\u0433\u0430\u0435\u0448\u044C \u043C\u0435\u043D\u044F\u0442\u044C \u043F\u043B\u0430\u043D \u043F\u043E\u0434 \u0440\u0435\u0430\u043B\u044C\u043D\u043E\u0441\u0442\u044C. \u0415\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0438 \u043D\u0430\u043A\u0430\u043F\u043B\u0438\u0432\u0430\u044E\u0442\u0441\u044F, \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0448\u044C \u0443\u043F\u0440\u043E\u0441\u0442\u0438\u0442\u044C, \u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0442\u0438 \u0438\u043B\u0438 \u0443\u0431\u0440\u0430\u0442\u044C \u043B\u0438\u0448\u043D\u0435\u0435.
3. \u042D\u041C\u041E\u0426\u0418\u041E\u041D\u0410\u041B\u042C\u041D\u0410\u042F \u041F\u041E\u0414\u0414\u0415\u0420\u0416\u041A\u0410: \u0427\u0443\u0432\u0441\u0442\u0432\u0443\u0435\u0448\u044C \u0443\u0441\u0442\u0430\u043B\u043E\u0441\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F ("\u043A\u0430\u0436\u0435\u0442\u0441\u044F, \u0442\u044B \u043D\u0435\u043C\u043D\u043E\u0433\u043E \u0443\u0441\u0442\u0430\u043B, \u044D\u0442\u043E \u043D\u043E\u0440\u043C\u0430\u043B\u044C\u043D\u043E, \u0434\u0430\u0432\u0430\u0439 \u0432\u043E\u0437\u044C\u043C\u0451\u043C \u043F\u0430\u0443\u0437\u0443 \u0438\u043B\u0438 \u0443\u043F\u0440\u043E\u0441\u0442\u0438\u043C \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438").
4. \u041C\u041E\u0422\u0418\u0412\u0410\u0426\u0418\u042F: \u041A\u043E\u0433\u0434\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u0434\u0435\u043B\u0430\u0435\u0442 \u0437\u0430\u0434\u0430\u0447\u0438, \u043C\u044F\u0433\u043A\u043E \u0438\u043B\u0438 \u043D\u0430\u0441\u0442\u043E\u0439\u0447\u0438\u0432\u043E (\u043F\u043E \u0441\u0442\u0438\u043B\u044E) \u043F\u043E\u0434\u0442\u0430\u043B\u043A\u0438\u0432\u0430\u0435\u0448\u044C \u043A \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044E.
5. \u041A\u041E\u041D\u041A\u0420\u0415\u0422\u041D\u041E\u0421\u0422\u042C: \u0412\u0441\u0435\u0433\u0434\u0430 \u043F\u0440\u0435\u0434\u043B\u0430\u0433\u0430\u0435\u0448\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0448\u0433, \u0430 \u043D\u0435 \u043E\u0431\u0449\u0438\u0435 \u0441\u043E\u0432\u0435\u0442\u044B.

\u041F\u0420\u0410\u0412\u0418\u041B\u0410 \u041E\u0422\u0412\u0415\u0422\u041E\u0412:
- \u0413\u043E\u0432\u043E\u0440\u0438\u0448\u044C \u0422\u041E\u041B\u042C\u041A\u041E \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C
- \u041D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u0443\u043F\u043E\u043C\u0438\u043D\u0430\u0435\u0448\u044C OpenAI / ChatGPT
- \u041E\u0442\u0432\u0435\u0442\u044B 2-4 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F (\u0438\u043D\u043E\u0433\u0434\u0430 \u043C\u043E\u0436\u043D\u043E \u0431\u043E\u043B\u044C\u0448\u0435, \u0435\u0441\u043B\u0438 \u0441\u0438\u0442\u0443\u0430\u0446\u0438\u044F \u0442\u0440\u0435\u0431\u0443\u0435\u0442)
- \u041E\u0431\u0440\u0430\u0449\u0430\u0439\u0441\u044F \u043F\u043E \u0438\u043C\u0435\u043D\u0438 (\u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C)
- \u0411\u0443\u0434\u044C \u0436\u0438\u0432\u044B\u043C, \u043D\u0435 \u0440\u043E\u0431\u043E\u0442\u043E\u043C: \u0440\u0435\u0430\u0433\u0438\u0440\u0443\u0439 \u043D\u0430 \u044D\u043C\u043E\u0446\u0438\u0438 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F

\u0423\u041F\u0420\u0410\u0412\u041B\u0415\u041D\u0418\u0415 \u0417\u0410\u0414\u0410\u0427\u0410\u041C\u0418 (\u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0430\u0439 JSON):
\u041C\u043E\u0436\u0435\u0448\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u044F\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u0441 \u043F\u043B\u0430\u043D\u043E\u043C. \u0412\u0435\u0440\u043D\u0438 JSON:
{"reply":"\u0442\u0435\u043A\u0441\u0442 \u043E\u0442\u0432\u0435\u0442\u0430","planAction":null}
\u0418\u043B\u0438 \u0441 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0435\u043C planAction:
- delete_task: {"type":"delete_task","taskId":"id","taskTitle":"\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- delete_tasks: {"type":"delete_tasks","taskIds":["id1","id2"],"message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- change_status: {"type":"change_status","taskId":"id","taskTitle":"\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435","newStatus":"todo|in_progress|done","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- change_priority: {"type":"change_priority","taskId":"id","taskTitle":"\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435","newPriority":"high|medium|low","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- rename_task: {"type":"rename_task","taskId":"id","taskTitle":"\u0441\u0442\u0430\u0440\u043E\u0435","newTitle":"\u043D\u043E\u0432\u043E\u0435","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- add_task: {"type":"add_task","phaseId":"id","phaseName":"\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435","newTaskTitle":"\u0437\u0430\u0434\u0430\u0447\u0430","newTaskPriority":"high|medium|low","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- mark_done: {"type":"mark_done","taskIds":["id1","id2"],"message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- reduce_load: {"type":"reduce_load","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- focus_top3: {"type":"focus_top3","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}
- reschedule: {"type":"reschedule","message":"\u043E\u0431\u044A\u044F\u0441\u043D\u0435\u043D\u0438\u0435"}

\u0412\u0410\u0416\u041D\u041E: \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439 taskId \u0438 phaseId \u0422\u041E\u041B\u042C\u041A\u041E \u0438\u0437 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442\u0430 \u043F\u043B\u0430\u043D\u0430. \u0415\u0441\u043B\u0438 \u0437\u0430\u0434\u0430\u0447\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430, \u0441\u043A\u0430\u0436\u0438 \u043E\u0431 \u044D\u0442\u043E\u043C.
${context ? `
\u041A\u041E\u041D\u0422\u0415\u041A\u0421\u0422 \u0422\u0415\u041A\u0423\u0429\u0415\u0413\u041E \u041F\u041B\u0410\u041D\u0410:
${context}` : ""}`;
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model: "gpt-4o", messages: [{ role: "system", content: systemPrompt + NO_DASH_RULE }, ...messages], temperature: 0.8, max_tokens: 700, response_format: { type: "json_object" } })
    });
    if (!res.ok) {
      const e = await res.text();
      console.log(`Tomi error ${res.status}: ${e}`);
      return c.json({ error: `AI failed: ${res.status}` }, 502);
    }
    const completion = await res.json();
    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return c.json({ error: "Empty AI response" }, 502);
    let parsed = { reply: raw };
    try {
      parsed = JSON.parse(raw);
    } catch {
    }
    parsed = stripDashes(parsed);
    const tokens = completion.usage?.total_tokens ?? 0;
    console.log(`Tomi replied (${tokens} tokens, action: ${JSON.stringify(parsed.planAction ?? null)})`);
    return c.json({ reply: parsed.reply ?? raw, planAction: parsed.planAction ?? null, tokens });
  } catch (err) {
    console.log(`Tomi error: ${err}`);
    return c.json({ error: `Tomi failed: ${err}` }, 500);
  }
});
ai.post("/ai/check-goal", async (c) => {
  try {
    const { goal } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal required" }, 400);
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        temperature: 0.3,
        max_tokens: 150,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `\u0422\u043E\u043C\u0438-AI. \u041E\u0446\u0435\u043D\u0438 \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u044C \u0446\u0435\u043B\u0438. JSON: {"realistic":bool,"warning":"\u0438\u043B\u0438 null","suggestedTimeline":"\u0438\u043B\u0438 null"}. \u0410\u0433\u0440\u0435\u0441\u0441\u0438\u0432\u043D\u044B\u0435 \u0446\u0435\u043B\u0438 (\u0432\u044B\u0443\u0447\u0438\u0442\u044C \u044F\u0437\u044B\u043A \u0437\u0430 \u043C\u0435\u0441\u044F\u0446 \u0438 \u0442.\u043F.) \u2192 realistic:false.` },
          { role: "user", content: `\u0426\u0435\u043B\u044C: ${goal}` }
        ]
      })
    });
    if (!res.ok) return c.json({ realistic: true, warning: null });
    const comp = await res.json();
    try {
      const d = JSON.parse(comp.choices?.[0]?.message?.content);
      console.log(`Goal check: "${goal}" \u2192 ${d.realistic}`);
      return c.json(stripDashes(d));
    } catch {
      return c.json({ realistic: true, warning: null });
    }
  } catch (err) {
    console.log(`Check goal error: ${err}`);
    return c.json({ realistic: true, warning: null });
  }
});
ai.post("/ai/parse-task", async (c) => {
  try {
    const { input, phases, planDeadline } = await c.req.json();
    if (!input?.trim()) return c.json({ error: "Input text required" }, 400);
    const phaseNames = (phases ?? []).map((p2) => p2.name).filter(Boolean).join(", ");
    const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const sys = `\u0422\u043E\u043C\u0438-AI Vecto. \u0418\u0437\u0432\u043B\u0435\u043A\u0438 \u0437\u0430\u0434\u0430\u0447\u0443 \u0438\u0437 \u0442\u0435\u043A\u0441\u0442\u0430 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.
\u0424\u0430\u0437\u044B: ${phaseNames || "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u044B"}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D \u043F\u0440\u043E\u0435\u043A\u0442\u0430: ${planDeadline || "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D"}. \u0421\u0435\u0433\u043E\u0434\u043D\u044F: ${today2}.
JSON: {"title":"\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 3-8 \u0441\u043B\u043E\u0432","priority":"high|medium|low","duration_hours":\u0447\u0438\u0441\u043B\u043E,"phase_name":"\u0438\u043B\u0438 null","end_date":"YYYY-MM-DD \u0438\u043B\u0438 null","tags":["\u0434\u043E 3"]}
\u0421\u0440\u043E\u0447\u043D\u043E/\u0432\u0430\u0436\u043D\u043E/\u043A\u0440\u0438\u0442\u0438\u0447\u043D\u043E \u2192 high. \u041D\u0435 \u0442\u043E\u0440\u043E\u043F\u0438\u0442\u0441\u044F \u2192 low. \u0418\u043D\u0430\u0447\u0435 medium. \u0412\u044B\u0447\u0438\u0441\u043B\u0438 end_date \u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u0435 \u0434\u0430\u0442\u044B.`;
    const res = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({ model: "gpt-4o-mini", messages: [{ role: "system", content: sys }, { role: "user", content: `\u0417\u0430\u0434\u0430\u0447\u0430: "${input}"` }], temperature: 0.3, max_tokens: 300, response_format: { type: "json_object" } })
    });
    if (!res.ok) {
      const e = await res.text();
      if (res.status === 429) return c.json({ error: "AI rate limited", code: "rate_limited" }, 429);
      if (res.status === 402 || e.includes("insufficient_quota")) return c.json({ error: "AI quota exceeded", code: "quota_exceeded" }, 402);
      return c.json({ error: `AI failed: ${res.status}` }, 502);
    }
    const comp = await res.json();
    const raw = comp.choices?.[0]?.message?.content;
    if (!raw) return c.json({ error: "Empty AI response" }, 502);
    let p;
    try {
      p = stripDashes(JSON.parse(raw));
    } catch {
      return c.json({ error: "Invalid AI JSON", code: "parse_error" }, 502);
    }
    const result = { title: p.title || input.trim(), priority: ["high", "medium", "low"].includes(p.priority) ? p.priority : "medium", duration_hours: typeof p.duration_hours === "number" && p.duration_hours > 0 ? p.duration_hours : 2, phase_name: p.phase_name || null, end_date: p.end_date || null, tags: Array.isArray(p.tags) ? p.tags.slice(0, 5) : [] };
    console.log(`Parsed task: "${input}" \u2192 "${result.title}"`);
    return c.json(result);
  } catch (err) {
    console.log(`Parse-task error: ${err}`);
    return c.json({ error: `Failed: ${err}` }, 500);
  }
});
ai.post("/ai/panic-mode", async (c) => {
  try {
    const { goal, deadline, daysLeft, progress, phases } = await c.req.json();
    const taskList = (phases ?? []).flatMap((ph) => (ph.tasks ?? []).map((t) => `[${t.id}] \xAB${t.title}\xBB: ${t.priority}, ${t.status}, ${t.duration_hours}\u0447 (${ph.name})`)).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u0420\u0415\u0416\u0418\u041C \u041F\u0410\u041D\u0418\u041A\u0418. \u0426\u0435\u043B\u044C: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u0414\u043D\u0435\u0439: ${daysLeft}. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${progress}%.
\u0412\u044B\u0431\u0435\u0440\u0438 \u043A\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u0437\u0430\u0434\u0430\u0447. JSON: {"criticalTaskIds":[],"cutTaskIds":[],"summary":"2-3 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F","estimatedHoursNeeded":\u0447\u0438\u0441\u043B\u043E,"survivalTip":"\u0441\u043E\u0432\u0435\u0442"}
Critical: todo/in_progress high/medium, \u0441\u0443\u043C\u043C\u0430\u0440\u043D\u043E \u2264 daysLeft\xD74\u0447. Cut: \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u043D\u0435\u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u043E\u0435. \u0411\u0435\u0437 done-\u0437\u0430\u0434\u0430\u0447.`,
      user: `\u0417\u0430\u0434\u0430\u0447\u0438:
${taskList}`,
      maxTokens: 500,
      temperature: 0.3
    });
    console.log(`Panic mode: ${data.criticalTaskIds?.length ?? 0} critical`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Panic mode failed: ${err}` }, 500);
  }
});
ai.post("/ai/morning-briefing", async (c) => {
  try {
    const { goal, todayTasks, overdueTasks, daysUntilDeadline, progress } = await c.req.json();
    const todayList = (todayTasks ?? []).map((t) => `[${t.id}] \xAB${t.title}\xBB (${t.priority}, ${t.duration_hours}\u0447)`).join("\n");
    const overdueList = (overdueTasks ?? []).map((t) => `[${t.id}] \xAB${t.title}\xBB (${t.priority})`).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u0423\u0422\u0420\u0415\u041D\u041D\u0418\u0419 \u0411\u0420\u0418\u0424\u0418\u041D\u0413. \u0426\u0435\u043B\u044C: ${goal}. \u0414\u043E \u0434\u0435\u0434\u043B\u0430\u0439\u043D\u0430: ${daysUntilDeadline}\u0434. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${progress}%.
JSON: {"greeting":"1-2 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F","focusTasks":[{"id":"","reason":""}],"optionalTasks":[{"id":"","reason":""}],"tip":"\u0441\u043E\u0432\u0435\u0442","mood":"energized|focused|steady|recovery","motivationalQuote":"\u0444\u0440\u0430\u0437\u0430"}
focusTasks: 1-3 \u0437\u0430\u0434\u0430\u0447\u0438. mood: \u0432\u044B\u0441\u043E\u043A\u0438\u0439 \u043F\u0440\u043E\u0433\u0440\u0435\u0441\u0441\u2192energized, \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0435\u2192recovery. \u041F\u043E-\u0440\u0443\u0441\u0441\u043A\u0438.`,
      user: `\u0421\u0435\u0433\u043E\u0434\u043D\u044F:
${todayList || "\u041D\u0435\u0442"}
\u041F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0435:
${overdueList || "\u041D\u0435\u0442"}`,
      maxTokens: 400,
      temperature: 0.6
    });
    console.log(`Morning briefing: mood=${data.mood}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Briefing failed: ${err}` }, 500);
  }
});
ai.post("/ai/phase-retro", async (c) => {
  try {
    const { goal, phaseName, plannedHours, trackedHours, completedCount, totalCount, overdueCount, taskTitles } = await c.req.json();
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u0420\u0415\u0422\u0420\u041E\u0421\u041F\u0415\u041A\u0422\u0418\u0412\u0410 \u0444\u0430\u0437\u044B. \u0426\u0435\u043B\u044C: ${goal}. \u0424\u0430\u0437\u0430: ${phaseName}.
JSON: {"headline":"5-10 \u0441\u043B\u043E\u0432","whatWorked":["2-3"],"whatSlowed":["2-3"],"insight":"1-2 \u043F\u0440\u0435\u0434\u043B","nextPhaseAdvice":"1-2 \u043F\u0440\u0435\u0434\u043B","score":1-10}
9-10:>90% \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E, 7-8:>70%, 5-6:\u0441\u0440\u0435\u0434\u043D\u0435, 3-4:\u043C\u0430\u043B\u043E, 1-2:\u043F\u043E\u0447\u0442\u0438 \u043D\u0438\u0447\u0435\u0433\u043E.`,
      user: `${completedCount}/${totalCount} \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E, ${overdueCount} \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E. \u041F\u043B\u0430\u043D: ${plannedHours}\u0447, \u0444\u0430\u043A\u0442: ${trackedHours}\u0447. \u0417\u0430\u0434\u0430\u0447\u0438: ${(taskTitles ?? []).join(", ")}`,
      maxTokens: 400,
      temperature: 0.5
    });
    console.log(`Phase retro: "${phaseName}" \u2192 score=${data.score}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Phase retro failed: ${err}` }, 500);
  }
});
ai.post("/ai/clarify-goal", async (c) => {
  try {
    const { goal } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal required" }, 400);
    const data = await callOpenAI({
      system: `\u0422\u044B \u0422\u043E\u043C\u0438, AI-\u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0449\u0438\u043A Vecto. \u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043E\u043F\u0438\u0441\u0430\u043B \u0446\u0435\u043B\u044C. \u041E\u043F\u0440\u0435\u0434\u0435\u043B\u0438, \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u043E \u043B\u0438 \u043E\u043D\u0430 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u0430 \u0434\u043B\u044F \u0433\u0435\u043D\u0435\u0440\u0430\u0446\u0438\u0438 \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0433\u043E \u043F\u043E\u0448\u0430\u0433\u043E\u0432\u043E\u0433\u043E \u043F\u043B\u0430\u043D\u0430.

\u0426\u0415\u041B\u042C \u0421\u0427\u0418\u0422\u0410\u0415\u0422\u0421\u042F \u0420\u0410\u0421\u041F\u041B\u042B\u0412\u0427\u0410\u0422\u041E\u0419, \u0435\u0441\u043B\u0438:
- \u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043A\u043E\u0440\u043E\u0442\u043A\u0430\u044F (\u043C\u0435\u043D\u0435\u0435 5 \u0441\u043B\u043E\u0432) \u0438 \u043D\u0435 \u0441\u043E\u0434\u0435\u0440\u0436\u0438\u0442 \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u0438\u043A\u0438
- \u041D\u0435\u0442 \u043F\u043E\u043D\u044F\u0442\u043D\u043E\u0433\u043E \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440 "\u0441\u0442\u0430\u0442\u044C \u043B\u0443\u0447\u0448\u0435", "\u0443\u043B\u0443\u0447\u0448\u0438\u0442\u044C \u0436\u0438\u0437\u043D\u044C")
- \u041D\u0435\u0442 \u0443\u043A\u0430\u0437\u0430\u043D\u0438\u044F \u043D\u0430 \u043F\u0440\u0435\u0434\u043C\u0435\u0442\u043D\u0443\u044E \u043E\u0431\u043B\u0430\u0441\u0442\u044C \u0438\u043B\u0438 \u043A\u043E\u043D\u0442\u0435\u043A\u0441\u0442
- \u041D\u0435\u0432\u043E\u0437\u043C\u043E\u0436\u043D\u043E \u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0438\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0448\u0430\u0433\u0438

\u0426\u0415\u041B\u042C \u0421\u0427\u0418\u0422\u0410\u0415\u0422\u0421\u042F \u0414\u041E\u0421\u0422\u0410\u0422\u041E\u0427\u041D\u041E\u0419, \u0435\u0441\u043B\u0438:
- \u041F\u043E\u043D\u044F\u0442\u043D\u043E \u0427\u0422\u041E \u043D\u0443\u0436\u043D\u043E \u0441\u0434\u0435\u043B\u0430\u0442\u044C (\u0434\u0430\u0436\u0435 \u0435\u0441\u043B\u0438 \u043A\u0440\u0430\u0442\u043A\u043E: "\u0432\u044B\u0443\u0447\u0438\u0442\u044C Python", "\u043F\u043E\u0445\u0443\u0434\u0435\u0442\u044C \u043D\u0430 10\u043A\u0433")
- \u0415\u0441\u0442\u044C \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043D\u0430\u0432\u044B\u043A, \u043F\u0440\u043E\u0435\u043A\u0442 \u0438\u043B\u0438 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442

\u0415\u0441\u043B\u0438 \u0446\u0435\u043B\u044C \u0440\u0430\u0441\u043F\u043B\u044B\u0432\u0447\u0430\u0442\u0430\u044F, \u0437\u0430\u0434\u0430\u0439 2-4 \u0443\u0442\u043E\u0447\u043D\u044F\u044E\u0449\u0438\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u0430 \u0447\u0442\u043E\u0431\u044B \u043F\u043E\u043D\u044F\u0442\u044C:
1. \u041A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u0436\u0435\u043B\u0430\u0435\u043C\u044B\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442
2. \u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0443\u0440\u043E\u0432\u0435\u043D\u044C / \u043E\u0442\u043F\u0440\u0430\u0432\u043D\u0430\u044F \u0442\u043E\u0447\u043A\u0430
3. \u0420\u0435\u0441\u0443\u0440\u0441\u044B \u0438 \u043E\u0433\u0440\u0430\u043D\u0438\u0447\u0435\u043D\u0438\u044F
4. \u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u044B \u0432\u043D\u0443\u0442\u0440\u0438 \u0446\u0435\u043B\u0438

JSON: {"needsClarification":boolean,"questions":["\u0432\u043E\u043F\u0440\u043E\u04411","\u0432\u043E\u043F\u0440\u043E\u04412"],"tomiComment":"\u043A\u043E\u0440\u043E\u0442\u043A\u0438\u0439 \u043A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u0422\u043E\u043C\u0438 1-2 \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0435\u043D\u0438\u044F"}
\u0415\u0441\u043B\u0438 \u0446\u0435\u043B\u044C \u0434\u043E\u0441\u0442\u0430\u0442\u043E\u0447\u043D\u0430, questions \u043F\u0443\u0441\u0442\u043E\u0439 \u043C\u0430\u0441\u0441\u0438\u0432, needsClarification=false.
\u041E\u0442\u0432\u0435\u0447\u0430\u0439 \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C.`,
      user: `\u0426\u0435\u043B\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F: "${goal}"`,
      maxTokens: 400,
      temperature: 0.4
    });
    console.log(`Clarify goal: "${goal}" \u2192 needsClarification=${data.needsClarification}, questions=${data.questions?.length ?? 0}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ needsClarification: false, questions: [], tomiComment: "" });
  }
});
ai.post("/ai/validate-deadline", async (c) => {
  try {
    const { goal, deadline, hoursPerWeek } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);
    const today2 = /* @__PURE__ */ new Date();
    const deadlineDate = new Date(deadline);
    const totalDays = Math.ceil((deadlineDate.getTime() - today2.getTime()) / 864e5);
    const totalHours = Math.floor(totalDays * (hoursPerWeek / 7));
    const data = await callOpenAI({
      system: `\u0422\u044B Vecto AI-\u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u043E\u0441\u0442\u0438 \u043F\u043B\u0430\u043D\u043E\u0432.
\u041E\u0446\u0435\u043D\u0438, \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u0430 \u043B\u0438 \u0446\u0435\u043B\u044C \u043F\u0440\u0438 \u0437\u0430\u0434\u0430\u043D\u043D\u044B\u0445 \u0440\u0435\u0441\u0443\u0440\u0441\u0430\u0445.
JSON: {"realistic":bool,"confidence":"high"|"medium"|"low","verdict":"1-2 \u043F\u0440\u0435\u0434\u043B","suggestedDeadline":"YYYY-MM-DD \u0438\u043B\u0438 null","suggestedHoursPerWeek":\u0447\u0438\u0441\u043B\u043E_\u0438\u043B\u0438_null,"risks":["1-3 \u0440\u0438\u0441\u043A\u0430"],"tips":["1-3 \u0441\u043E\u0432\u0435\u0442\u0430"]}
\u0415\u0441\u043B\u0438 \u0446\u0435\u043B\u044C \u0440\u0435\u0430\u043B\u0438\u0441\u0442\u0438\u0447\u043D\u0430, suggestedDeadline=null. \u0411\u0443\u0434\u044C \u0447\u0435\u0441\u0442\u043D\u044B\u043C \u043D\u043E \u043C\u043E\u0442\u0438\u0432\u0438\u0440\u0443\u044E\u0449\u0438\u043C.`,
      user: `\u0426\u0435\u043B\u044C: "${goal}"
\u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline} (${totalDays} \u0434\u043D\u0435\u0439)
\u0427\u0430\u0441\u043E\u0432/\u043D\u0435\u0434: ${hoursPerWeek} (${totalHours}\u0447 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E)`,
      maxTokens: 400,
      temperature: 0.4
    });
    console.log(`Validate deadline: realistic=${data.realistic}, confidence=${data.confidence}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Validate deadline failed: ${err}` }, 500);
  }
});
ai.post("/ai/regenerate-phase", async (c) => {
  try {
    const { goal, deadline, hoursPerWeek, phaseName, phaseIndex, totalPhases, feedback, existingTasks } = await c.req.json();
    if (!goal?.trim() || !phaseName) return c.json({ error: "Goal and phaseName are required" }, 400);
    const today2 = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const existingList = (existingTasks ?? []).map((t) => `\xAB${t.title}\xBB (${t.priority})`).join(", ");
    const data = await callOpenAI({
      system: `\u0422\u044B Vecto AI, \u043F\u0435\u0440\u0435\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u0444\u0430\u0437\u0443 \u043F\u043B\u0430\u043D\u0430 \u0441 \u0443\u0447\u0451\u0442\u043E\u043C \u0444\u0438\u0434\u0431\u0435\u043A\u0430.
\u0426\u0435\u043B\u044C \u043F\u0440\u043E\u0435\u043A\u0442\u0430: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u0427/\u043D\u0435\u0434: ${hoursPerWeek ?? 10}.
\u0424\u0430\u0437\u0430 "${phaseName}" (${phaseIndex + 1} \u0438\u0437 ${totalPhases}).
\u0422\u0435\u043A\u0443\u0449\u0438\u0435 \u0437\u0430\u0434\u0430\u0447\u0438: ${existingList || "\u043D\u0435\u0442"}.
\u0421\u0435\u0433\u043E\u0434\u043D\u044F: ${today2}.
JSON: {"tasks":[{"title":"3-8 \u0441\u043B\u043E\u0432","description":"1-2 \u043F\u0440\u0435\u0434\u043B","duration_hours":1-8,"priority":"high|medium|low","subtasks":[{"title":"\u043F\u043E\u0434\u0437\u0430\u0434\u0430\u0447\u0430"}]}],"tomiComment":"1-2 \u043F\u0440\u0435\u0434\u043B \u0447\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B"}
3-6 \u0437\u0430\u0434\u0430\u0447, \u043A\u0430\u0436\u0434\u0430\u044F \u0441 2-3 \u043F\u043E\u0434\u0437\u0430\u0434\u0430\u0447\u0430\u043C\u0438. \u0412\u0441\u0435 \u043D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C. \u0423\u0447\u0442\u0438 \u0444\u0438\u0434\u0431\u0435\u043A \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F.`,
      user: `\u0424\u0438\u0434\u0431\u0435\u043A: ${feedback || "\u041F\u0435\u0440\u0435\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u0441 \u043B\u0443\u0447\u0448\u0435\u0439 \u0441\u0442\u0440\u0443\u043A\u0442\u0443\u0440\u043E\u0439"}`,
      maxTokens: 800,
      temperature: 0.6
    });
    console.log(`Regenerate phase: "${phaseName}" \u2192 ${data.tasks?.length ?? 0} tasks`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Regenerate phase failed: ${err}` }, 500);
  }
});
ai.post("/ai/generate-milestones", async (c) => {
  try {
    const { goal, deadline, phases } = await c.req.json();
    if (!goal?.trim()) return c.json({ error: "Goal is required" }, 400);
    const phasesSummary = (phases ?? []).map(
      (ph, i) => `${i + 1}. "${ph.name}" (${ph.start_date} - ${ph.end_date}, ${ph.tasks?.length ?? 0} \u0437\u0430\u0434\u0430\u0447)`
    ).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u044B Vecto AI, \u0441\u043E\u0437\u0434\u0430\u0439 \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0432\u0435\u0445\u0438 (milestones) \u0434\u043B\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u0430.
\u0426\u0435\u043B\u044C: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}.
\u0424\u0430\u0437\u044B:
${phasesSummary}
JSON: {"milestones":[{"title":"2-5 \u0441\u043B\u043E\u0432","description":"1 \u043F\u0440\u0435\u0434\u043B","target_date":"YYYY-MM-DD","phase_id":"\u043F\u0440\u0438\u0432\u044F\u0437\u0430\u0442\u044C \u043A \u043A\u043E\u043D\u0446\u0443 \u0444\u0430\u0437\u044B \u0438\u043B\u0438 null","criteria":["2-3 \u043A\u0440\u0438\u0442\u0435\u0440\u0438\u044F \u0434\u043E\u0441\u0442\u0438\u0436\u0435\u043D\u0438\u044F"]}]}
3-5 \u0432\u0435\u0445, \u043F\u0440\u0438\u0432\u044F\u0437\u0430\u043D\u043D\u044B\u0445 \u043A \u043A\u043B\u044E\u0447\u0435\u0432\u044B\u043C \u043C\u043E\u043C\u0435\u043D\u0442\u0430\u043C \u043F\u0440\u043E\u0435\u043A\u0442\u0430. \u041D\u0430 \u0440\u0443\u0441\u0441\u043A\u043E\u043C.`,
      user: `\u0421\u043E\u0437\u0434\u0430\u0439 \u0432\u0435\u0445\u0438 \u043F\u0440\u043E\u0435\u043A\u0442\u0430.`,
      maxTokens: 500,
      temperature: 0.5
    });
    console.log(`Generate milestones: ${data.milestones?.length ?? 0}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Generate milestones failed: ${err}` }, 500);
  }
});

// ai2.tsx
import { Hono as Hono3 } from "npm:hono";
var ai2 = new Hono3();
ai2.use("/*", aiGuard);
ai2.post("/ai/expand-phase", async (c) => {
  try {
    const { goal, phaseName, existingTasks, deadline, hoursPerWeek } = await c.req.json();
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u0441\u0433\u0435\u043D\u0435\u0440\u0438\u0440\u0443\u0439 \u0414\u041E\u041F\u041E\u041B\u041D\u0418\u0422\u0415\u041B\u042C\u041D\u042B\u0415 \u0437\u0430\u0434\u0430\u0447\u0438 \u0434\u043B\u044F \u0444\u0430\u0437\u044B. \u0426\u0435\u043B\u044C: ${goal}. \u0424\u0430\u0437\u0430: ${phaseName}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u0427/\u043D\u0435\u0434: ${hoursPerWeek}.
JSON: {"tasks":[{"title":"3-8 \u0441\u043B\u043E\u0432","duration_hours":1-8,"priority":"high|medium|low"}]}
3-5 \u0437\u0430\u0434\u0430\u0447, \u043D\u0435 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u0439 \u0441\u0443\u0449\u0435\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435, \u043A\u043E\u043D\u043A\u0440\u0435\u0442\u043D\u044B\u0435 \u0438 \u0434\u0435\u0439\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0435.`,
      user: `\u0423\u0436\u0435 \u0435\u0441\u0442\u044C: ${(existingTasks ?? []).join(", ")}`,
      maxTokens: 500,
      temperature: 0.7
    });
    console.log(`Expand phase: "${phaseName}" \u2192 ${data.tasks?.length ?? 0} tasks`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Expand phase failed: ${err}` }, 500);
  }
});
ai2.post("/ai/what-if", async (c) => {
  try {
    const { goal, deadline, currentProgress, scenario, phases } = await c.req.json();
    const phasesSummary = (phases ?? []).map((ph) => {
      const t = ph.tasks ?? [];
      const done = t.filter((x) => x.status === "done").length;
      return `${ph.name}: ${done}/${t.length}`;
    }).join("; ");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438-\u0441\u0442\u0440\u0430\u0442\u0435\u0433, \xAB\u0427\u0442\u043E \u0435\u0441\u043B\u0438\u2026?\xBB. \u0426\u0435\u043B\u044C: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${currentProgress}%. \u0424\u0430\u0437\u044B: ${phasesSummary}.
JSON: {"impact":"positive|negative|neutral","impactLevel":1-10,"analysis":"3-5 \u043F\u0440\u0435\u0434\u043B","recommendations":["3 \u0440\u0435\u043A"],"newDeadlineEstimate":"YYYY-MM-DD \u0438\u043B\u0438 null","riskFactors":["\u0440\u0438\u0441\u043A\u0438"]}`,
      user: `\u0421\u0446\u0435\u043D\u0430\u0440\u0438\u0439: ${scenario}`,
      maxTokens: 500,
      temperature: 0.6
    });
    console.log(`What-if: impact=${data.impact}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `What-if failed: ${err}` }, 500);
  }
});
ai2.post("/ai/suggest-habits", async (c) => {
  try {
    const { goal, currentHabits, completionRate, workPattern } = await c.req.json();
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438-\u043A\u043E\u0443\u0447, \u043F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0438 \u0434\u043B\u044F \u0446\u0435\u043B\u0438: ${goal}. Completion rate: ${completionRate ?? 0}%. \u041F\u0430\u0442\u0442\u0435\u0440\u043D: ${workPattern || "\u0441\u0442\u0430\u043D\u0434\u0430\u0440\u0442\u043D\u044B\u0439"}.
JSON: {"habits":[{"title":"2-5 \u0441\u043B\u043E\u0432","description":"1 \u043F\u0440\u0435\u0434\u043B","frequency":"daily|weekly|workdays","estimatedMinutes":\u0447\u0438\u0441\u043B\u043E,"category":"productivity|health|learning|social","difficulty":"easy|medium|hard"}]}
3-5 \u043F\u0440\u0438\u0432\u044B\u0447\u0435\u043A. \u041D\u0435 \u0434\u0443\u0431\u043B\u0438\u0440\u0443\u0439: ${(currentHabits ?? []).join(", ") || "\u043D\u0435\u0442"}.`,
      user: `\u041F\u0440\u0435\u0434\u043B\u043E\u0436\u0438 \u043F\u0440\u0438\u0432\u044B\u0447\u043A\u0438.`,
      maxTokens: 500,
      temperature: 0.7
    });
    console.log(`Suggest habits: ${data.habits?.length ?? 0}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Suggest habits failed: ${err}` }, 500);
  }
});
ai2.post("/ai/smart-replan", async (c) => {
  try {
    const { goal, deadline, daysLeft, progress, phases, hoursPerWeek } = await c.req.json();
    const taskList = (phases ?? []).flatMap((ph) => (ph.tasks ?? []).filter((t) => t.status !== "done").map((t) => `[${t.id}] \xAB${t.title}\xBB: ${t.priority}, ${t.duration_hours}\u0447, ${ph.name}`)).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u041F\u0415\u0420\u0415\u041F\u041B\u0410\u041D\u0418\u0420\u041E\u0412\u0410\u041D\u0418\u0415. \u0426\u0435\u043B\u044C: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u0414\u043D\u0435\u0439: ${daysLeft}. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${progress}%. \u041C\u0430\u043A\u0441 ${hoursPerWeek ?? 20}\u0447/\u043D\u0435\u0434.
JSON: {"strategy":"2-3 \u043F\u0440\u0435\u0434\u043B","reorderedTasks":[{"id":"","newPriority":"","reason":""}],"tasksToDefer":[{"id":"","reason":""}],"dailyPlan":[{"day":1,"taskIds":[],"hoursPlanned":0}],"canMeetDeadline":bool,"suggestedNewDeadline":"YYYY-MM-DD \u0438\u043B\u0438 null"}
dailyPlan \u043C\u0430\u043A\u0441 7 \u0434\u043D\u0435\u0439. \u0421\u043D\u0430\u0447\u0430\u043B\u0430 high\u2192medium\u2192low.`,
      user: `\u0417\u0430\u0434\u0430\u0447\u0438:
${taskList || "\u041D\u0435\u0442"}`,
      maxTokens: 700,
      temperature: 0.4
    });
    console.log(`Smart replan: canMeet=${data.canMeetDeadline}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Smart replan failed: ${err}` }, 500);
  }
});
ai2.post("/ai/digest", async (c) => {
  try {
    const { goal, weekSummary, doneCount, overdueCount, totalHours, progress } = await c.req.json();
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u0415\u0416\u0415\u041D\u0415\u0414\u0415\u041B\u042C\u041D\u042B\u0419 \u0414\u0410\u0419\u0414\u0416\u0415\u0421\u0422. \u0426\u0435\u043B\u044C: ${goal}. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${progress}%.
JSON: {"title":"5-8 \u0441\u043B\u043E\u0432","summary":"2-3 \u043F\u0440\u0435\u0434\u043B","wins":["\u043F\u043E\u0431\u0435\u0434\u044B"],"concerns":["\u043F\u0440\u043E\u0431\u043B\u0435\u043C\u044B"],"weeklyGrade":"A|B|C|D|F","nextWeekFocus":"1-2 \u043F\u0440\u0435\u0434\u043B","tomiComment":"1-2 \u043F\u0440\u0435\u0434\u043B \u0442\u0435\u043F\u043B\u043E"}
A:>90%, B:>70%, C:>50%, D:>30%, F:<30%.`,
      user: `\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E: ${doneCount}, \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E: ${overdueCount}, \u0447\u0430\u0441\u043E\u0432: ${totalHours}. ${weekSummary || ""}`,
      maxTokens: 400,
      temperature: 0.6
    });
    console.log(`Digest: grade=${data.weeklyGrade}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Digest failed: ${err}` }, 500);
  }
});
ai2.post("/ai/smart-reminder-times", async (c) => {
  try {
    const { tasks, userTimezone, workPattern, previousReminders } = await c.req.json();
    const taskList = (tasks ?? []).map((t) => `[${t.id}] \xAB${t.title}\xBB: ${t.priority}, \u0434\u0435\u0434\u043B\u0430\u0439\u043D: ${t.end_date}`).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438, \u041E\u041F\u0422\u0418\u041C\u0410\u041B\u042C\u041D\u041E\u0415 \u0412\u0420\u0415\u041C\u042F \u043D\u0430\u043F\u043E\u043C\u0438\u043D\u0430\u043D\u0438\u0439. \u0422\u0417: ${userTimezone || "UTC+3"}. \u041F\u0430\u0442\u0442\u0435\u0440\u043D: ${workPattern || "9-18"}.
JSON: {"reminders":[{"taskId":"","suggestedTime":"HH:MM","daysBefore":\u0447\u0438\u0441\u043B\u043E,"reason":"","type":"start|deadline|progress_check"}]}
8:00-21:00. high\u21929-10\u0447. medium\u219212-14\u0447. low\u219217-18\u0447. \u0413\u043E\u0440\u044F\u0449\u0438\u0439 \u0434\u0435\u0434\u043B\u0430\u0439\u043D\u2192\u0437\u0430 1-2 \u0434\u043D\u044F.`,
      user: `\u0417\u0430\u0434\u0430\u0447\u0438:
${taskList || "\u041D\u0435\u0442"}
\u041F\u0440\u0435\u0434\u044B\u0434\u0443\u0449\u0438\u0445: ${(previousReminders ?? []).length}`,
      maxTokens: 500,
      temperature: 0.3
    });
    console.log(`Smart reminders: ${data.reminders?.length ?? 0}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Smart reminders failed: ${err}` }, 500);
  }
});
ai2.post("/ai/forecast", async (c) => {
  try {
    const { goal, deadline, progress, velocity, phases } = await c.req.json();
    const phasesSummary = (phases ?? []).map((ph) => {
      const t = ph.tasks ?? [];
      const done = t.filter((x) => x.status === "done").length;
      return `${ph.name}: ${done}/${t.length}`;
    }).join("; ");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438-\u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A, \u041F\u0420\u041E\u0413\u041D\u041E\u0417 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u044F. \u0426\u0435\u043B\u044C: ${goal}. \u0414\u0435\u0434\u043B\u0430\u0439\u043D: ${deadline}. \u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441: ${progress}%. \u0421\u043A\u043E\u0440\u043E\u0441\u0442\u044C: ${velocity ?? "?"} \u0437\u0430\u0434\u0430\u0447/\u043D\u0435\u0434. \u0424\u0430\u0437\u044B: ${phasesSummary}.
JSON: {"estimatedCompletionDate":"YYYY-MM-DD","confidence":"high|medium|low","onTrack":bool,"daysAheadOrBehind":\u0447\u0438\u0441\u043B\u043E,"bottlenecks":[""],"advice":"1-2 \u043F\u0440\u0435\u0434\u043B","weeklyVelocityNeeded":\u0447\u0438\u0441\u043B\u043E}`,
      user: `\u0421\u043F\u0440\u043E\u0433\u043D\u043E\u0437\u0438\u0440\u0443\u0439 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0435.`,
      maxTokens: 400,
      temperature: 0.4
    });
    console.log(`Forecast: onTrack=${data.onTrack}`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Forecast failed: ${err}` }, 500);
  }
});
ai2.post("/ai/tomi-insights", async (c) => {
  try {
    const { patternSummary, question } = await c.req.json();
    if (!patternSummary) return c.json({ error: "patternSummary is required" }, 400);
    const isWhatIf = !!question;
    const system = isWhatIf ? `\u0422\u043E\u043C\u0438-\u0441\u0442\u0440\u0430\u0442\u0435\u0433. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F:
${patternSummary}
\u041E\u0442\u0432\u0435\u0442\u044C \u043D\u0430 \u0432\u043E\u043F\u0440\u043E\u0441 \xAB\u0427\u0442\u043E \u0435\u0441\u043B\u0438?\xBB. JSON: {"answer":"3-5 \u043F\u0440\u0435\u0434\u043B","confidence":1-100,"impact":"positive|negative|neutral","recommendation":"1-2 \u043F\u0440\u0435\u0434\u043B"}` : `\u0422\u043E\u043C\u0438-\u0441\u0442\u0440\u0430\u0442\u0435\u0433. \u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F:
${patternSummary}
\u0414\u0430\u0439 \u043F\u0435\u0440\u0441\u043E\u043D\u0430\u043B\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0435 \u0438\u043D\u0441\u0430\u0439\u0442\u044B. JSON: {"greeting":"1 \u043F\u0440\u0435\u0434\u043B","insights":[{"emoji":"","title":"","body":"2-3 \u043F\u0440\u0435\u0434\u043B \u0441 \u0446\u0438\u0444\u0440\u0430\u043C\u0438","type":"strength|risk|pattern|tip"}],"personalityProfile":"2-3 \u043F\u0440\u0435\u0434\u043B","topRecommendation":"1-2 \u043F\u0440\u0435\u0434\u043B","predictedDropoffDay":\u0447\u0438\u0441\u043B\u043E_\u0438\u043B\u0438_null,"productivityScore":1-100}. 4-6 \u0438\u043D\u0441\u0430\u0439\u0442\u043E\u0432 \u0440\u0430\u0437\u043D\u044B\u0445 \u0442\u0438\u043F\u043E\u0432.`;
    const data = await callOpenAI({
      system,
      user: isWhatIf ? `\u0412\u043E\u043F\u0440\u043E\u0441: ${question}` : `\u0414\u0430\u0439 \u0438\u043D\u0441\u0430\u0439\u0442\u044B.`,
      maxTokens: 800,
      temperature: 0.65
    });
    console.log(`Tomi insights (what-if: ${isWhatIf})`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Tomi insights failed: ${err}` }, 500);
  }
});
ai2.post("/ai/tomi-preventive", async (c) => {
  try {
    const { patternSummary, riskSignals, pendingTasks, planGoal } = await c.req.json();
    if (!patternSummary || !pendingTasks) return c.json({ error: "patternSummary and pendingTasks are required" }, 400);
    const taskList = (pendingTasks ?? []).map((t) => `[${t.id}] \xAB${t.title}\xBB (${t.priority}, ${t.status}, ${t.phase}, ${t.durationHours}\u0447)`).join("\n");
    const data = await callOpenAI({
      system: `\u0422\u043E\u043C\u0438 \u043F\u0440\u0435\u0432\u0435\u043D\u0442\u0438\u0432\u043D\u044B\u0439 \u043A\u043E\u0443\u0447. \u0426\u0435\u043B\u044C: ${planGoal}. \u0420\u0438\u0441\u043A: ${riskSignals?.level}, \u0431\u0430\u043B\u043B: ${riskSignals?.score}/100.
\u041F\u0440\u0438\u0447\u0438\u043D\u044B: ${(riskSignals?.reasons ?? []).join("; ")}.
\u0414\u0430\u043D\u043D\u044B\u0435: ${patternSummary}
JSON: {"greeting":"1-2 \u043F\u0440\u0435\u0434\u043B \u0442\u0435\u043F\u043B\u043E","simplifications":[{"taskId":"","taskTitle":"","action":"simplify|deprioritize|postpone|remove","reason":"1 \u043F\u0440\u0435\u0434\u043B","newTitle":"\u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F simplify","newPriority":"low|medium \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F deprioritize"}],"encouragement":"2-3 \u043F\u0440\u0435\u0434\u043B","alternativePlan":"2-3 \u043F\u0440\u0435\u0434\u043B"}
2-4 \u0443\u043F\u0440\u043E\u0449\u0435\u043D\u0438\u044F. \u041D\u0435 \u0443\u0434\u0430\u043B\u044F\u0439 high-\u043F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u044B\u0435. \u0417\u0430\u0431\u043E\u0442\u043B\u0438\u0432\u044B\u0439 \u0442\u043E\u043D.`,
      user: `\u0417\u0430\u0434\u0430\u0447\u0438:
${taskList}`,
      maxTokens: 700,
      temperature: 0.6
    });
    console.log(`Preventive: ${riskSignals?.level} risk, ${(data.simplifications ?? []).length} suggestions`);
    return c.json(data);
  } catch (err) {
    const code = err?.code;
    if (code) return c.json({ error: err.message, code }, code === "rate_limited" ? 429 : 502);
    return c.json({ error: `Tomi preventive failed: ${err}` }, 500);
  }
});

// admin.tsx
import { Hono as Hono4 } from "npm:hono";
import { createClient as createClient5 } from "npm:@supabase/supabase-js";
var admin = new Hono4();
var MAX_FAILS = 8;
var LOCK_MINUTES = 15;
var GRANT_PREFIX = "vecto-grant:";
function db2() {
  return createClient5(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
}
function safeEqual(a, b) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
function isAdminPassword(pw) {
  const expected = Deno.env.get("VECTO_ADMIN_PASSWORD");
  if (!expected || expected.length < 8 || !pw) return false;
  return safeEqual(pw, expected);
}
async function sha256(s) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function clientIp2(c) {
  const xf = c.req.header("x-forwarded-for") || "";
  return xf.split(",")[0].trim() || c.req.header("cf-connecting-ip") || "unknown";
}
admin.use("/admin/*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  const key = `admin-lock:${(await sha256(clientIp2(c))).slice(0, 32)}`;
  const state = await get(key);
  if (state?.until && state.until > Date.now()) {
    const mins = Math.ceil((state.until - Date.now()) / 6e4);
    return c.json({ error: `\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 ${mins} \u043C\u0438\u043D.` }, 429);
  }
  if (!isAdminPassword(c.req.header("X-Admin-Password"))) {
    const fails = (state?.fails ?? 0) + 1;
    await set(key, fails >= MAX_FAILS ? { fails: 0, until: Date.now() + LOCK_MINUTES * 6e4 } : { fails });
    return c.json({ error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C" }, 401);
  }
  if (state) await del(key);
  return next();
});
function parsePlans(raw) {
  return raw.filter(Boolean).map((r) => {
    try {
      return typeof r === "string" ? JSON.parse(r) : r;
    } catch {
      return null;
    }
  }).filter(Boolean);
}
function displayLogin(email, name) {
  if (name) return name;
  if (!email) return "-";
  const local = email.split("@")[0];
  try {
    const b64 = local.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(escape(atob(b64)));
    if (decoded && /^[\p{L}\p{N} ._-]+$/u.test(decoded)) return decoded;
  } catch {
  }
  return local;
}
async function setTier(userId, tier, days, email) {
  const now = /* @__PURE__ */ new Date();
  const expires = tier === "free" ? now : days ? new Date(now.getTime() + days * 864e5) : /* @__PURE__ */ new Date("2100-01-01T00:00:00Z");
  const { error } = await db2().from("user_access").upsert(
    {
      user_id: userId,
      project: "vecto",
      plan: tier,
      email,
      status: tier === "free" ? "inactive" : "active",
      starts_at: now.toISOString(),
      expires_at: expires.toISOString(),
      updated_at: now.toISOString()
    },
    { onConflict: "user_id,project" }
  );
  if (error) throw new Error(error.message);
  return expires.toISOString();
}
async function listAllUsers() {
  const supabase = db2();
  const users = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1e3 });
    if (error) throw new Error(error.message);
    users.push(...data.users ?? []);
    if ((data.users ?? []).length < 1e3) break;
  }
  return users;
}
admin.get("/admin/users", async (c) => {
  try {
    const users = await listAllUsers();
    const { data: accessRows } = await db2().from("user_access").select("user_id, plan, status, expires_at, updated_at").eq("project", "vecto");
    const accessBy = {};
    for (const r of accessRows ?? []) accessBy[r.user_id] = r;
    const month = currentMonth();
    const now = Date.now();
    const enriched = await Promise.all(users.map(async (u) => {
      let plans = [];
      let usage = 0;
      try {
        plans = parsePlans(await getByPrefix(`user:${u.id}:plan:`));
        usage = Number(await get(`user:${u.id}:usage:${month}`) ?? 0) || 0;
      } catch {
      }
      const tasks = plans.flatMap((p) => p.phases?.flatMap((ph) => ph.tasks ?? []) ?? []);
      const a = accessBy[u.id];
      const active = a && a.status === "active" && (!a.expires_at || Date.parse(a.expires_at) > now);
      const tier = active && (a.plan === "basic" || a.plan === "premium") ? a.plan : "free";
      return {
        id: u.id,
        email: u.email,
        login: displayLogin(u.email, u.user_metadata?.name),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at,
        isBlocked: !!u.banned_until && Date.parse(u.banned_until) > now,
        tier,
        tierExpiresAt: active ? a.expires_at : null,
        tierSource: active ? a.expires_at && a.expires_at.startsWith("2100") ? "manual" : "payment" : null,
        plans: plans.length,
        tasks: tasks.length,
        doneTasks: tasks.filter((t) => t.status === "done").length,
        usageThisMonth: usage,
        lastPlanAt: plans.map((p) => p.updated_at ?? p.created_at).filter(Boolean).sort().pop() ?? null
      };
    }));
    return c.json({ users: enriched, total: enriched.length });
  } catch (err) {
    console.log(`admin/users error: ${err}`);
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439: ${err}` }, 500);
  }
});
admin.get("/admin/stats", async (c) => {
  try {
    const users = await listAllUsers();
    const now = Date.now();
    const { data: accessRows } = await db2().from("user_access").select("plan, status, expires_at").eq("project", "vecto");
    const paid = (accessRows ?? []).filter((r) => r.status === "active" && (!r.expires_at || Date.parse(r.expires_at) > now));
    const month = currentMonth();
    let activeThisMonth = 0, totalPlans = 0, totalTasks = 0, doneTasks = 0;
    for (const u of users) {
      try {
        const usage = Number(await get(`user:${u.id}:usage:${month}`) ?? 0) || 0;
        if (usage > 0) activeThisMonth++;
        const plans = parsePlans(await getByPrefix(`user:${u.id}:plan:`));
        totalPlans += plans.length;
        const tasks = plans.flatMap((p) => p.phases?.flatMap((ph) => ph.tasks ?? []) ?? []);
        totalTasks += tasks.length;
        doneTasks += tasks.filter((t) => t.status === "done").length;
      } catch {
      }
    }
    const weekAgo = now - 7 * 864e5;
    return c.json({
      totalUsers: users.length,
      newThisWeek: users.filter((u) => Date.parse(u.created_at) > weekAgo).length,
      activeThisMonth,
      blocked: users.filter((u) => u.banned_until && Date.parse(u.banned_until) > now).length,
      paid: paid.length,
      basic: paid.filter((r) => r.plan === "basic").length,
      premium: paid.filter((r) => r.plan === "premium").length,
      totalPlans,
      totalTasks,
      doneTasks,
      completionRate: totalTasks ? Math.round(doneTasks / totalTasks * 100) : 0
    });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043A\u0443: ${err}` }, 500);
  }
});
admin.post("/admin/users/:id/set-tier", async (c) => {
  try {
    const userId = c.req.param("id");
    const { tier, days } = await c.req.json();
    if (!["free", "basic", "premium"].includes(tier)) return c.json({ error: "\u0422\u0430\u0440\u0438\u0444: free, basic \u0438\u043B\u0438 premium" }, 400);
    const { data } = await db2().auth.admin.getUserById(userId);
    const expiresAt = await setTier(userId, tier, typeof days === "number" && days > 0 ? days : null, data?.user?.email ?? null);
    return c.json({ success: true, tier, expiresAt: tier === "free" ? null : expiresAt });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0442\u0430\u0440\u0438\u0444: ${err}` }, 500);
  }
});
admin.post("/admin/users/:id/toggle-ban", async (c) => {
  try {
    const userId = c.req.param("id");
    const { banned } = await c.req.json();
    const { error } = await db2().auth.admin.updateUserById(userId, { ban_duration: banned ? "876000h" : "none" });
    if (error) return c.json({ error: error.message }, 500);
    return c.json({ success: true, banned: !!banned });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C \u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u043A\u0443: ${err}` }, 500);
  }
});
admin.post("/admin/users/:id/credentials", async (c) => {
  try {
    const userId = c.req.param("id");
    const { email, password } = await c.req.json();
    if (!email && !password) return c.json({ error: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 email \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C" }, 400);
    if (password && String(password).length < 6) return c.json({ error: "\u041F\u0430\u0440\u043E\u043B\u044C \u043D\u0435 \u043A\u043E\u0440\u043E\u0447\u0435 6 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432" }, 400);
    const updates = {};
    if (email) {
      updates.email = email;
      updates.email_confirm = true;
    }
    if (password) updates.password = password;
    const { data, error } = await db2().auth.admin.updateUserById(userId, updates);
    if (error) return c.json({ error: error.message }, 400);
    return c.json({ success: true, user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C: ${err}` }, 500);
  }
});
admin.delete("/admin/users/:id", async (c) => {
  try {
    const userId = c.req.param("id");
    const supabase = db2();
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) return c.json({ error: error.message }, 500);
    const keys = [];
    for (const p of parsePlans(await getByPrefix(`user:${userId}:plan:`))) if (p?.id) keys.push(`user:${userId}:plan:${p.id}`);
    for (const d of parsePlans(await getByPrefix(`user:${userId}:deleted:`))) if (d?.id) keys.push(`user:${userId}:deleted:${d.id}`);
    for (const k of ["activity", "settings", "chat_history", "onboarding", "mood_journal", "gamification", "patterns", "plan_feedbacks"]) keys.push(`user:${userId}:data:${k}`);
    keys.push(`user:${userId}:usage:${currentMonth()}`, `tg_user:${userId}`, `plan_tier:${userId}`);
    if (keys.length) await mdel(keys);
    await supabase.from("user_access").delete().eq("user_id", userId).eq("project", "vecto");
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0443\u0434\u0430\u043B\u0438\u0442\u044C: ${err}` }, 500);
  }
});
function loginToEmail(login) {
  const s = login.trim().toLowerCase();
  if (s.includes("@")) return s;
  const b64 = btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64}@vecto.local`;
}
admin.get("/admin/grants", async (c) => {
  try {
    const raw = await getByPrefix(GRANT_PREFIX);
    const grants = parsePlans(raw).sort((a, b) => b.grantedAt.localeCompare(a.grantedAt));
    return c.json({ grants });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F\u044B: ${err}` }, 500);
  }
});
admin.post("/admin/grants", async (c) => {
  try {
    const { login, tier, days, note } = await c.req.json();
    if (!login?.trim()) return c.json({ error: "\u0423\u043A\u0430\u0436\u0438\u0442\u0435 \u0438\u043C\u044F \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438\u043B\u0438 email" }, 400);
    if (!["basic", "premium"].includes(tier)) return c.json({ error: "\u0422\u0430\u0440\u0438\u0444: basic \u0438\u043B\u0438 premium" }, 400);
    const users = await listAllUsers();
    const wanted = loginToEmail(login).toLowerCase();
    const user = users.find((u) => (u.email ?? "").toLowerCase() === wanted || (u.user_metadata?.name ?? "").toLowerCase() === login.trim().toLowerCase());
    if (!user) return c.json({ error: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u041E\u043D \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u0442\u044C\u0441\u044F \u0432 Vecto." }, 404);
    const d = typeof days === "number" && days > 0 ? days : null;
    await setTier(user.id, tier, d, user.email ?? null);
    const grant = { login: login.trim(), tier, days: d, note: String(note ?? "").slice(0, 200), grantedAt: (/* @__PURE__ */ new Date()).toISOString(), userId: user.id, revokedAt: null };
    await set(`${GRANT_PREFIX}${user.id}`, grant);
    return c.json({ success: true, grant });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0432\u044B\u0434\u0430\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F: ${err}` }, 500);
  }
});
admin.delete("/admin/grants/:userId", async (c) => {
  try {
    const userId = c.req.param("userId");
    const raw = await get(`${GRANT_PREFIX}${userId}`);
    const grant = raw ? typeof raw === "string" ? JSON.parse(raw) : raw : null;
    await setTier(userId, "free", null, null);
    if (grant) await set(`${GRANT_PREFIX}${userId}`, { ...grant, revokedAt: (/* @__PURE__ */ new Date()).toISOString() });
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u043E\u0442\u043E\u0437\u0432\u0430\u0442\u044C: ${err}` }, 500);
  }
});
admin.get("/admin/activity", async (c) => {
  try {
    const users = await listAllUsers();
    const byId = new Map(users.map((u) => [u.id, u]));
    const events = [];
    for (const u of users) {
      const who = displayLogin(u.email, u.user_metadata?.name);
      events.push({ at: u.created_at, type: "signup", who, detail: "\u0420\u0435\u0433\u0438\u0441\u0442\u0440\u0430\u0446\u0438\u044F" });
      if (u.last_sign_in_at) events.push({ at: u.last_sign_in_at, type: "login", who, detail: "\u0412\u0445\u043E\u0434" });
      try {
        for (const p of parsePlans(await getByPrefix(`user:${u.id}:plan:`))) {
          events.push({ at: p.created_at, type: "plan", who, detail: `\u041F\u043B\u0430\u043D: ${String(p.goal ?? "").slice(0, 60)}` });
          const tasks = p.phases?.flatMap((ph) => ph.tasks ?? []) ?? [];
          const done = tasks.filter((t) => t.status === "done").length;
          if (done && p.updated_at) events.push({ at: p.updated_at, type: "progress", who, detail: `\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E ${done} \u0438\u0437 ${tasks.length} \u0437\u0430\u0434\u0430\u0447` });
        }
      } catch {
      }
    }
    const payments = parsePlans(await getByPrefix("yk_payment:")).filter((p) => p?.project === "vecto");
    for (const p of payments) {
      const u = byId.get(p.userId);
      events.push({ at: p.processedAt, type: "payment", who: u ? displayLogin(u.email, u.user_metadata?.name) : p.userId, detail: `\u041E\u043F\u043B\u0430\u0442\u0430: ${p.plan === "premium" ? "\u0412\u0441\u0435 \u0432\u043A\u043B\u044E\u0447\u0435\u043D\u043E" : "\u0411\u0430\u0437\u043E\u0432\u044B\u0439"}` });
    }
    events.sort((a, b) => b.at.localeCompare(a.at));
    const month = currentMonth();
    let createdPlan = 0;
    for (const u of users) {
      const usage = Number(await get(`user:${u.id}:usage:${month}`) ?? 0) || 0;
      if (usage > 0) createdPlan++;
    }
    const funnel = [
      { key: "signup", label: "\u0417\u0430\u0440\u0435\u0433\u0438\u0441\u0442\u0440\u0438\u0440\u043E\u0432\u0430\u043B\u0438\u0441\u044C", value: users.length },
      { key: "plan", label: "\u0421\u043E\u0437\u0434\u0430\u043B\u0438 \u043F\u043B\u0430\u043D", value: new Set(events.filter((e) => e.type === "plan").map((e) => e.who)).size },
      { key: "progress", label: "\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u043B\u0438 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0443 \u0437\u0430\u0434\u0430\u0447\u0443", value: new Set(events.filter((e) => e.type === "progress").map((e) => e.who)).size },
      { key: "payment", label: "\u041E\u043F\u043B\u0430\u0442\u0438\u043B\u0438", value: new Set(payments.map((p) => p.userId)).size }
    ];
    return c.json({ events: events.slice(0, 200), funnel, activeThisMonth: createdPlan });
  } catch (err) {
    return c.json({ error: `\u041D\u0435 \u0443\u0434\u0430\u043B\u043E\u0441\u044C \u0441\u043E\u0431\u0440\u0430\u0442\u044C \u0430\u043A\u0442\u0438\u0432\u043D\u043E\u0441\u0442\u044C: ${err}` }, 500);
  }
});

// index.tsx
var app = new Hono5();
app.use("*", logger(console.log));
app.use("/*", cors({
  origin: "*",
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Password"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  exposeHeaders: ["Content-Length"],
  maxAge: 600
}));
function getSupabase2() {
  return createClient6(
    Deno.env.get("SUPABASE_URL"),
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
  );
}
async function requireUser2(authHeader) {
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabase = getSupabase2();
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}
app.get("/make-server-a5927615/health", (c) => c.json({ status: "ok", ts: Date.now() }));
app.post("/make-server-a5927615/digest/email", async (c) => {
  try {
    const { email, planGoal, doneCount, overdueCount, forecastDate, totalHours } = await c.req.json();
    if (!email) return c.json({ error: "Email required" }, 400);
    const resendKey = Deno.env.get("RESEND_API_KEY");
    if (!resendKey) {
      console.log("RESEND_API_KEY not set, email digest skipped");
      return c.json({ error: "Email service not configured", code: "not_configured" }, 503);
    }
    const html = `
      <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#2b2a27;margin:0 0 16px">Vecto. \u0415\u0436\u0435\u043D\u0435\u0434\u0435\u043B\u044C\u043D\u044B\u0439 \u0434\u0430\u0439\u0434\u0436\u0435\u0441\u0442</h2>
        <p style="color:#334155;font-size:14px"><strong>\u0426\u0435\u043B\u044C:</strong> ${planGoal}</p>
        <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:16px 0">
          <p style="margin:4px 0;font-size:14px;color:#334155">\u2705 \u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E: <strong>${doneCount}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#334155">\u26A0\uFE0F \u041F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043E: <strong>${overdueCount}</strong></p>
          <p style="margin:4px 0;font-size:14px;color:#334155">\u23F1 \u0427\u0430\u0441\u043E\u0432: <strong>${totalHours}\u0447</strong></p>
          ${forecastDate ? `<p style="margin:4px 0;font-size:14px;color:#334155">\u{1F4C5} \u041F\u0440\u043E\u0433\u043D\u043E\u0437: <strong>${forecastDate}</strong></p>` : ""}
        </div>
        <p style="color:#94a3b8;font-size:12px;margin-top:24px">\u041E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u043E \u0438\u0437 Vecto AI Planner</p>
      </div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "Vecto <onboarding@resend.dev>",
        to: [email],
        subject: `\u26A1 Vecto \u0414\u0430\u0439\u0434\u0436\u0435\u0441\u0442: ${planGoal?.slice(0, 40)}`,
        html
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      console.log(`Resend error ${res.status}: ${errText}`);
      return c.json({ error: "Failed to send email" }, 502);
    }
    console.log(`Digest email sent to ${email}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Digest email error: ${err}`);
    return c.json({ error: `Email failed: ${err}` }, 500);
  }
});
app.post("/make-server-a5927615/auth/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    if (!email || !password) return c.json({ error: "Email and password are required" }, 400);
    const supabase = getSupabase2();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name: name || "" },
      // Automatically confirm email since no email server configured
      email_confirm: true
    });
    if (error) {
      console.log(`Sign up error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    console.log(`User created: ${data.user?.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Sign up exception: ${err}`);
    return c.json({ error: `Sign up failed: ${err}` }, 500);
  }
});
function planTime(p) {
  const t = Date.parse(p?.updated_at ?? p?.created_at ?? "");
  return Number.isFinite(t) ? t : 0;
}
app.get("/make-server-a5927615/plans", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const rawPlans = await getByPrefix(`user:${user.id}:plan:`);
    const plans = rawPlans.filter(Boolean).map((raw) => {
      try {
        return typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch {
        return null;
      }
    }).filter(Boolean);
    const tombs = await getByPrefix(`user:${user.id}:deleted:`);
    const deletedIds = tombs.map((raw) => {
      try {
        return (typeof raw === "string" ? JSON.parse(raw) : raw)?.id ?? null;
      } catch {
        return null;
      }
    }).filter(Boolean);
    return c.json({ plans, deletedIds });
  } catch (err) {
    console.log(`Get plans error: ${err}`);
    return c.json({ error: `Failed to get plans: ${err}` }, 500);
  }
});
app.post("/make-server-a5927615/plans", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { plan } = await c.req.json();
    if (!plan?.id) return c.json({ error: "Invalid plan data" }, 400);
    if (await get(`user:${user.id}:deleted:${plan.id}`)) {
      return c.json({ success: false, deleted: true });
    }
    const key = `user:${user.id}:plan:${plan.id}`;
    const storedRaw = await get(key);
    if (storedRaw) {
      let stored = null;
      try {
        stored = typeof storedRaw === "string" ? JSON.parse(storedRaw) : storedRaw;
      } catch {
      }
      if (stored && planTime(stored) > planTime(plan)) {
        return c.json({ success: false, stale: true, plan: stored });
      }
    }
    await set(key, JSON.stringify(plan));
    return c.json({ success: true });
  } catch (err) {
    console.log(`Save plan error: ${err}`);
    return c.json({ error: `Failed to save plan: ${err}` }, 500);
  }
});
app.delete("/make-server-a5927615/plans/:id", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const planId = c.req.param("id");
    await del(`user:${user.id}:plan:${planId}`);
    await set(`user:${user.id}:deleted:${planId}`, JSON.stringify({ id: planId, deletedAt: (/* @__PURE__ */ new Date()).toISOString() }));
    console.log(`Plan deleted: ${planId} for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Delete plan error: ${err}`);
    return c.json({ error: `Failed to delete plan: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/usage", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const raw = await get(`user:${user.id}:usage:${month}`);
    return c.json({ count: raw ? Number(raw) : 0 });
  } catch (err) {
    console.log(`Get usage error: ${err}`);
    return c.json({ error: `Failed to get usage: ${err}` }, 500);
  }
});
app.post("/make-server-a5927615/usage/increment", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const raw = await get(`user:${user.id}:usage:${currentMonth()}`);
    return c.json({ count: raw ? Number(raw) : 0 });
  } catch (err) {
    console.log(`Increment usage error: ${err}`);
    return c.json({ error: `Failed to increment usage: ${err}` }, 500);
  }
});
app.post("/make-server-a5927615/share", async (c) => {
  try {
    const { plan } = await c.req.json();
    if (!plan?.id) return c.json({ error: "Invalid plan data" }, 400);
    const shareId = Array.from(crypto.getRandomValues(new Uint8Array(6))).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
    await set(`share:${shareId}`, JSON.stringify({ plan, sharedAt: (/* @__PURE__ */ new Date()).toISOString() }));
    console.log(`Share created: ${shareId} for plan ${plan.id}`);
    return c.json({ shareId });
  } catch (err) {
    console.log(`Create share error: ${err}`);
    return c.json({ error: `Failed to create share: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/share/:shareId", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const raw = await get(`share:${shareId}`);
    if (!raw) return c.json({ error: "Shared plan not found" }, 404);
    const data = JSON.parse(raw);
    return c.json({ plan: data.plan, sharedAt: data.sharedAt });
  } catch (err) {
    console.log(`Get share error: ${err}`);
    return c.json({ error: `Failed to fetch share: ${err}` }, 500);
  }
});
app.post("/make-server-a5927615/share/:shareId/comments", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const { text, author, targetId, targetType } = await c.req.json();
    if (!text) return c.json({ error: "Text required" }, 400);
    const key = `share:${shareId}:comments`;
    const existing = await get(key);
    const comments = existing ? JSON.parse(existing) : [];
    const comment = {
      id: crypto.randomUUID(),
      text,
      author: author || "\u0410\u043D\u043E\u043D\u0438\u043C",
      targetId: targetId || null,
      targetType: targetType || "plan",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    comments.push(comment);
    await set(key, JSON.stringify(comments));
    return c.json({ comment });
  } catch (err) {
    console.log(`Add share comment error: ${err}`);
    return c.json({ error: `Failed to add comment: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/share/:shareId/comments", async (c) => {
  try {
    const shareId = c.req.param("shareId");
    const raw = await get(`share:${shareId}:comments`);
    const comments = raw ? JSON.parse(raw) : [];
    return c.json({ comments });
  } catch (err) {
    console.log(`Get share comments error: ${err}`);
    return c.json({ error: `Failed to get comments: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/profile", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const prefix = `user:${user.id}:plan:`;
    const rawPlans = await getByPrefix(prefix);
    const plans = rawPlans.filter(Boolean).map((raw) => {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }).filter(Boolean);
    const totalTasks = plans.flatMap((p) => p.phases?.flatMap((ph) => ph.tasks) ?? []);
    const doneTasks = totalTasks.filter((t) => t.status === "done");
    const activePlans = plans.filter((p) => {
      const allT = p.phases?.flatMap((ph) => ph.tasks) ?? [];
      const done = allT.filter((t) => t.status === "done").length;
      return done < allT.length;
    });
    const month = (/* @__PURE__ */ new Date()).toISOString().slice(0, 7);
    const usageRaw = await get(`user:${user.id}:usage:${month}`);
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || "",
        created_at: user.created_at
      },
      stats: {
        totalPlans: plans.length,
        activePlans: activePlans.length,
        totalTasks: totalTasks.length,
        doneTasks: doneTasks.length,
        usageThisMonth: usageRaw ? Number(usageRaw) : 0
      }
    });
  } catch (err) {
    console.log(`Get profile error: ${err}`);
    return c.json({ error: `Failed to get profile: ${err}` }, 500);
  }
});
app.put("/make-server-a5927615/profile", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { name } = await c.req.json();
    if (!name?.trim()) return c.json({ error: "Name is required" }, 400);
    const supabase = getSupabase2();
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, name: name.trim() }
    });
    if (error) {
      console.log(`Update profile error: ${error.message}`);
      return c.json({ error: error.message }, 400);
    }
    console.log(`Profile updated for user ${user.id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Update profile exception: ${err}`);
    return c.json({ error: `Failed to update profile: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/user/tier", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const { tier, expiresAt } = await getVectoTier(user.id);
    const usage = Number(await get(`user:${user.id}:usage:${currentMonth()}`) ?? 0) || 0;
    const limit = PLAN_LIMIT[tier];
    return c.json({ tier, expiresAt, usage, limit: Number.isFinite(limit) ? limit : null });
  } catch (err) {
    console.log(`Get tier error: ${err}`);
    return c.json({ error: `Failed to get tier: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/user/vecto-access", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const supabase = getSupabase2();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await supabase.from("user_access").update({ status: "expired" }).eq("user_id", user.id).eq("project", "vecto").eq("status", "active").lt("expires_at", now);
    const { data, error } = await supabase.from("user_access").select("plan, status, expires_at").eq("user_id", user.id).eq("project", "vecto").eq("status", "active").gt("expires_at", now).maybeSingle();
    if (error) {
      console.log(`Vecto access check error: ${error.message}`);
      return c.json({ error: error.message }, 500);
    }
    if (!data) return c.json({ access: null });
    const daysLeft = Math.ceil(
      (new Date(data.expires_at).getTime() - Date.now()) / (1e3 * 60 * 60 * 24)
    );
    return c.json({
      access: { plan: data.plan, status: data.status, expiresAt: data.expires_at, daysLeft }
    });
  } catch (err) {
    console.log(`Vecto access error: ${err}`);
    return c.json({ error: `Failed to check access: ${err}` }, 500);
  }
});
var ALLOWED_DATA_KEYS = [
  "activity",
  // heatmap data
  "settings",
  // sound, TTS, personality, preferences
  "chat_history",
  // Tomi conversations
  "onboarding",
  // onboarding progress, tour flags
  "mood_journal",
  // mood entries
  "gamification",
  // XP, level, achievements
  "patterns",
  // behaviour patterns (Tomi-клон)
  "plan_feedbacks"
  // plan feedback aggregates
];
app.get("/make-server-a5927615/user/data", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const results = {};
    for (const key of ALLOWED_DATA_KEYS) {
      try {
        const raw = await get(`user:${user.id}:data:${key}`);
        results[key] = raw ? JSON.parse(raw) : null;
      } catch {
        results[key] = null;
      }
    }
    return c.json({ data: results });
  } catch (err) {
    console.log(`Get all user data error: ${err}`);
    return c.json({ error: `Failed to get all user data: ${err}` }, 500);
  }
});
app.get("/make-server-a5927615/user/data/:key", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    if (!ALLOWED_DATA_KEYS.includes(key)) return c.json({ error: `Invalid data key: ${key}` }, 400);
    const raw = await get(`user:${user.id}:data:${key}`);
    return c.json({ key, value: raw ? JSON.parse(raw) : null });
  } catch (err) {
    console.log(`Get user data error: ${err}`);
    return c.json({ error: `Failed to get user data: ${err}` }, 500);
  }
});
app.put("/make-server-a5927615/user/data/:key", async (c) => {
  try {
    const user = await requireUser2(c.req.header("Authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    const key = c.req.param("key");
    if (!ALLOWED_DATA_KEYS.includes(key)) return c.json({ error: `Invalid data key: ${key}` }, 400);
    const { value } = await c.req.json();
    if (value === void 0) return c.json({ error: "value is required" }, 400);
    await set(`user:${user.id}:data:${key}`, JSON.stringify(value));
    console.log(`User data saved: ${key} for user ${user.id} (${JSON.stringify(value).length} bytes)`);
    return c.json({ success: true });
  } catch (err) {
    console.log(`Save user data error: ${err}`);
    return c.json({ error: `Failed to save user data: ${err}` }, 500);
  }
});
app.route("/make-server-a5927615", admin);
app.route("/make-server-a5927615", ai);
app.route("/make-server-a5927615", ai2);
app.route("/make-server-a5927615", telegram);
Deno.serve(app.fetch);
