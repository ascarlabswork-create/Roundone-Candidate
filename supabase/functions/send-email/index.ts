import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

type HookUser = {
  email: string;
  new_email?: string;
};

type HookEmailData = {
  token: string;
  token_hash: string;
  token_new?: string;
  token_hash_new?: string;
  redirect_to: string;
  email_action_type: string;
  site_url: string;
};

const SUBJECTS: Record<string, string> = {
  signup: "Confirm your jobround.ai account",
  recovery: "Reset your jobround.ai password",
  invite: "You are invited to jobround.ai",
  magiclink: "Your jobround.ai sign-in link",
  email_change: "Confirm your jobround.ai email change",
  reauthentication: "Your jobround.ai verification code",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readHookSecret(): string | null {
  const raw = Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "";
  if (!raw) return null;
  return raw.startsWith("v1,whsec_") ? raw.replace("v1,whsec_", "") : raw;
}

function fromAddress(): string {
  return Deno.env.get("AUTH_EMAIL_FROM") ?? "jobround.ai <support@jobround.ai>";
}

function supabaseAuthBase(): string {
  const url = Deno.env.get("SUPABASE_URL") ?? "https://fhcrxjrqtojixgqemofp.supabase.co";
  return url.replace(/\/$/, "");
}

function buildVerifyUrl(emailData: HookEmailData, tokenHash: string, actionType: string) {
  const params = new URLSearchParams({
    token: tokenHash,
    type: actionType,
    redirect_to: emailData.redirect_to || "https://jobround.ai/candidate/auth/callback",
  });
  return `${supabaseAuthBase()}/auth/v1/verify?${params.toString()}`;
}

function htmlWrap(title: string, body: string) {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a">
<h2 style="color:#0f172a">${title}</h2>
${body}
<p style="color:#64748b;font-size:13px;margin-top:24px">If you did not request this, you can ignore this email.</p>
</body></html>`;
}

function messageForAction(
  action: string,
  user: HookUser,
  emailData: HookEmailData,
): { subject: string; html: string } | null {
  const subject = SUBJECTS[action] ?? "jobround.ai notification";

  if (action === "reauthentication") {
    return {
      subject,
      html: htmlWrap(
        "Verification code",
        `<p>Your verification code is:</p><p style="font-size:22px;font-weight:600;letter-spacing:0.12em">${emailData.token}</p>`,
      ),
    };
  }

  const confirmUrl = buildVerifyUrl(emailData, emailData.token_hash, action);

  if (action === "signup") {
    return {
      subject,
      html: htmlWrap(
        "Confirm your email",
        `<p>Thanks for signing up. Tap the button below to confirm your email and finish creating your account.</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Confirm email</a></p>
<p style="font-size:13px;color:#64748b">Or paste this link: ${confirmUrl}</p>`,
      ),
    };
  }

  if (action === "recovery") {
    return {
      subject,
      html: htmlWrap(
        "Reset your password",
        `<p>We received a request to reset the password for <strong>${user.email}</strong>.</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Reset password</a></p>`,
      ),
    };
  }

  if (action === "magiclink") {
    return {
      subject: "Your jobround.ai sign-in code",
      html: htmlWrap(
        "Your sign-in code",
        `<p>Enter this 6-digit code to sign in:</p>
<p style="font-size:22px;font-weight:600;letter-spacing:0.12em">${emailData.token}</p>
<p style="margin-top:16px">Or use this one-time link:</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Sign in</a></p>`,
      ),
    };
  }

  if (action === "invite") {
    return {
      subject,
      html: htmlWrap(
        "Accept your invitation",
        `<p>You have been invited to create a jobround.ai account.</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Accept invitation</a></p>`,
      ),
    };
  }

  if (action === "email_change") {
    return {
      subject,
      html: htmlWrap(
        "Confirm email change",
        `<p>Confirm this email change for your account.</p>
<p><a href="${confirmUrl}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:10px;font-weight:600">Confirm change</a></p>`,
      ),
    };
  }

  return {
    subject,
    html: htmlWrap("jobround.ai", `<p><a href="${confirmUrl}">Continue</a></p>`),
  };
}

async function sendWithResend(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get("RESEND_API_KEY")?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured on the edge function");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [to],
      subject,
      html,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Resend HTTP ${response.status}`;
    throw new Error(message);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const secret = readHookSecret();
  if (!secret) {
    console.log(JSON.stringify({ event: "send_email_unconfigured", reason: "missing_hook_secret" }));
    return json(500, { error: "hook_secret_missing" });
  }

  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers);
  let user: HookUser;
  let emailData: HookEmailData;

  try {
    const wh = new Webhook(secret);
    const verified = wh.verify(rawBody, headers) as { user: HookUser; email_data: HookEmailData };
    user = verified.user;
    emailData = verified.email_data;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid_hook";
    console.log(JSON.stringify({ event: "send_email_verify_failed", message }));
    return json(401, { error: "invalid_hook_signature" });
  }

  const action = emailData.email_action_type;
  const primary = messageForAction(action, user, emailData);

  try {
    if (!primary) {
      throw new Error(`unsupported_email_action:${action}`);
    }
    await sendWithResend(user.email, primary.subject, primary.html);

    // Secure email change: optional second mail to the new address.
    if (
      action === "email_change" &&
      user.new_email &&
      emailData.token_new &&
      emailData.token_hash_new
    ) {
      const secondaryData: HookEmailData = {
        ...emailData,
        token: emailData.token_new,
        token_hash: emailData.token_hash_new,
      };
      const secondary = messageForAction("email_change", { ...user, email: user.new_email }, secondaryData);
      if (secondary) {
        await sendWithResend(user.new_email, secondary.subject, secondary.html);
      }
    }

    console.log(JSON.stringify({ event: "send_email_ok", action, to: user.email }));
    return json(200, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "send_failed";
    console.log(JSON.stringify({ event: "send_email_failed", action, to: user.email, message }));
    return json(500, { error: message });
  }
});
