import { useSyncExternalStore } from 'react';

const STORAGE_KEY = 'tas_cart_v1';
const MAX_QTY = 99;

const listeners = new Set();

const parsePrice = (label) => {
  if (typeof label === 'number') return label;
  const cleaned = String(label ?? '').replace(/[^0-9.]/g, '');
  return Number(cleaned) || 0;
};

const initialState = () => ({
  items: [],
  isOpen: false,
  lastAddedAt: 0,
});

let state = initialState();
let hydrated = false;

const persist = () => {
  if (typeof window === 'undefined') return;
  try {
    const { items } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items }));
  } catch {
    /* ignore quota errors */
  }
};

const hydrate = () => {
  if (hydrated || typeof window === 'undefined') return;
  hydrated = true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items)) {
        state = { ...state, items: parsed.items };
      }
    }
  } catch {
    /* ignore parse errors */
  }
};

const emit = () => {
  state = { ...state };
  persist();
  listeners.forEach((listener) => listener(state));
};

export const cartStore = {
  getState: () => state,

  subscribe(listener) {
    hydrate();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  addItem(product, qty = 1) {
    hydrate();
    const existing = state.items.find((item) => item.name === product.name);
    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + qty);
    } else {
      state.items = [
        ...state.items,
        {
          name: product.name,
          image: product.image,
          accent: product.accent,
          price: parsePrice(product.price),
          priceLabel: product.price,
          quantity: Math.max(1, Math.min(MAX_QTY, qty)),
          className: product.className ?? '',
          category: product.category ?? '',
        },
      ];
    }
    state.lastAddedAt = Date.now();
    state.isOpen = true;
    emit();
  },

  removeItem(name) {
    state.items = state.items.filter((item) => item.name !== name);
    emit();
  },

  updateQty(name, qty) {
    if (qty <= 0) {
      this.removeItem(name);
      return;
    }
    state.items = state.items.map((item) =>
      item.name === name
        ? { ...item, quantity: Math.min(MAX_QTY, qty) }
        : item
    );
    emit();
  },

  clear() {
    state.items = [];
    emit();
  },

  setOpen(open) {
    state.isOpen = Boolean(open);
    emit();
  },
};

export function useCart() {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getState,
    cartStore.getState,
  );
}

export const selectItemsCount = (s) =>
  s.items.reduce((sum, item) => sum + item.quantity, 0);

export const selectTotal = (s) =>
  s.items.reduce((sum, item) => sum + item.price * item.quantity, 0);

export const formatMXN = (amount) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
