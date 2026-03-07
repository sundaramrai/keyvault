import { Globe, CreditCard, StickyNote, User } from 'lucide-react';

export type Category = 'all' | 'login' | 'card' | 'note' | 'identity';

export const CATEGORY_ICONS: Record<string, any> = {
    login: Globe,
    card: CreditCard,
    note: StickyNote,
    identity: User,
};

export const IDLE_MS = 5 * 60 * 1000;

export const genOptions = { length: 20, uppercase: true, lowercase: true, numbers: true, symbols: true };

export const emptyForm = {
    name: '', category: 'login',
    username: '', password: '', url: '', notes: '',
    cardNumber: '', cardHolder: '', expiry: '', cvv: '',
    firstName: '', lastName: '', phone: '', address: '',
};

export type ItemForm = typeof emptyForm;
