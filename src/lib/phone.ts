import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

/**
 * The country code used when the user types a local (non-international)
 * number without a leading `+`. Overridable via `PHONE_DEFAULT_COUNTRY`.
 * Defaults to Nicaragua (the project is deployed to Corn Island, NI).
 */
function defaultCountry(): CountryCode {
    const raw = (process.env.PHONE_DEFAULT_COUNTRY || 'NI').toUpperCase();
    return raw as CountryCode;
}

/**
 * Normalize a free-form phone string to E.164 (e.g. `+50588886666`).
 * Returns `null` if the input cannot be parsed as a valid phone number.
 *
 * Accepts inputs like:
 *   - "+505 8888-6666"
 *   - "505 8888 6666"
 *   - "88886666"             (assumes default country)
 *   - "(505) 8888-6666"
 */
export function normalizePhone(
    input: string | null | undefined,
    country: CountryCode = defaultCountry(),
): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    if (!trimmed) return null;
    try {
        const parsed = parsePhoneNumberFromString(trimmed, country);
        if (!parsed || !parsed.isValid()) return null;
        return parsed.number; // E.164
    } catch {
        return null;
    }
}

/**
 * Return the set of admin phone numbers from the `ADMIN_PHONES` env var.
 * The env var is a comma-separated list; each entry is normalized to
 * E.164. Empty / invalid entries are silently dropped.
 */
export function adminPhoneSet(): Set<string> {
    const raw = process.env.ADMIN_PHONES || '';
    const out = new Set<string>();
    for (const entry of raw.split(',')) {
        const n = normalizePhone(entry);
        if (n) out.add(n);
    }
    return out;
}

/**
 * Format an E.164 number for display (e.g. in the login UI). Falls back
 * to the raw input if parsing fails.
 */
export function formatPhoneForDisplay(phone: string): string {
    try {
        const parsed = parsePhoneNumberFromString(phone);
        if (parsed) return parsed.formatInternational();
    } catch {
        // ignore
    }
    return phone;
}
