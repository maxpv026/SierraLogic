import nodemailer from "nodemailer";

const transport = nodemailer.createTransport({
  host:   process.env.EMAIL_SERVER_HOST,
  port:   Number(process.env.EMAIL_SERVER_PORT ?? 587),
  secure: false,
  auth: {
    user: process.env.EMAIL_SERVER_USER,
    pass: process.env.EMAIL_SERVER_PASSWORD,
  },
});

export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  await transport.sendMail({
    from:    process.env.EMAIL_FROM ?? "noreply@sierralogic.ai",
    to,
    subject: "Your SierraLogic verification code",
    text:    `Your 6-digit verification code is: ${code}\n\nIt expires in 15 minutes. Do not share it.`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:420px;margin:auto;padding:32px;color:#0f172a">
        <h2 style="margin:0 0 8px;font-size:20px;font-weight:700">Verify your email</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:14px">
          Enter this code in SierraLogic to complete your registration.
        </p>
        <div style="background:#f1f5f9;border-radius:12px;padding:28px 24px;text-align:center">
          <span style="font-size:40px;font-weight:800;letter-spacing:14px;font-family:monospace;color:#312e81">
            ${code}
          </span>
        </div>
        <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">
          This code expires in <strong>15 minutes</strong>. If you did not create an account, ignore this email.
        </p>
      </div>
    `,
  });
}
