/**
 * lib/types.ts — Shared domain types used across lib/ and components/.
 *
 * Keeping these here (rather than in components/dashboard/types.ts) avoids
 * circular imports: lib/store.ts can import from lib/types.ts without pulling
 * in any React component dependency.
 */

export interface DecryptedPayload {
    // Login
    username?: string;
    password?: string;
    url?: string;
    // Card
    cardNumber?: string;
    cardHolder?: string;
    expiry?: string;
    cvv?: string;
    // Identity
    firstName?: string;
    lastName?: string;
    phone?: string;
    address?: string;
    // Shared
    notes?: string;
}

export interface VaultItem {
    id: string;
    name: string;
    category: string;
    /** Only present after fetching the detail endpoint */
    encrypted_data?: string;
    favicon_url?: string;
    is_favourite: boolean;
    created_at: string;
    updated_at: string;
    /** Populated client-side after decryption */
    decrypted?: DecryptedPayload;
}
