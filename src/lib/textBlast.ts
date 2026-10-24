import { getConfig, TwilioConfig } from "./config.js";
import { IAttendee } from "../models/Event.js";

/**
 * Text blasts (host -> all attendees over SMS) are rolled out gradually.
 * Only hosts whose verified phone number is on the allowlist may send one.
 * The allowlist comes from the TEXT_BLAST_ALLOWED_PHONES environment
 * variable (comma-separated E.164 numbers), or from
 * `text_blast_allowed_phones` in the `[twilio]` section of the config file.
 * With neither set, nobody can send text blasts.
 */
export const TEXT_BLAST_MAX_LENGTH = 640;

export function textBlastAllowedPhones(): string[] {
    const fromEnv = (process.env.TEXT_BLAST_ALLOWED_PHONES || "")
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
    if (fromEnv.length) {
        return fromEnv;
    }
    const twilioConfig = getConfig().twilio as TwilioConfig | undefined;
    const configured = twilioConfig?.text_blast_allowed_phones;
    return Array.isArray(configured) ? configured : [];
}

export function canSendTextBlast(phone?: string | null): boolean {
    if (!phone) {
        return false;
    }
    return textBlastAllowedPhones().includes(phone);
}

/**
 * Unique phone numbers of everyone currently attending the event.
 */
export function textBlastRecipients(event: { attendees?: IAttendee[] }): string[] {
    const phones = (event.attendees || [])
        .filter((a) => a.status === "attending" && a.phoneNumber)
        .map((a) => a.phoneNumber as string);
    return Array.from(new Set(phones));
}

export function formatTextBlast(
    event: { name: string; hostName?: string },
    message: string,
): string {
    const from = event.hostName ? `${event.hostName}, host of` : "the host of";
    return `Message from ${from} "${event.name}":\n\n${message}`;
}
