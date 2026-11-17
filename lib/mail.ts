import { mkdir, appendFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { dataDir } from "./db";
import { AppError } from "./errors";
export async function sendMail(to: string, subject: string, text: string) {
  if (process.env.SMTP_URL && process.env.MAIL_FROM) {
    await nodemailer
      .createTransport(process.env.SMTP_URL)
      .sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    return;
  }
  if (process.env.NODE_ENV === "production")
    throw new AppError(
      503,
      "Email delivery is not configured. Contact the platform administrator.",
      "EMAIL_NOT_CONFIGURED",
    );
  await mkdir(dataDir(), { recursive: true });
  await appendFile(
    path.join(dataDir(), "mail-outbox.jsonl"),
    JSON.stringify({ to, subject, text, at: new Date().toISOString() }) + "\n",
  );
}
