import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  cartStore,
  formatMXN,
  selectItemsCount,
  selectTotal,
  useCart,
} from './cartStore.js';
import './Cart.css';

const SHIPPING_THRESHOLD = 500;
const SHIPPING_FLAT = 89;

export default function CartIsland() {
  const cart = useCart();
  const reduceMotion = useReducedMotion();
  const count = selectItemsCount(cart);
  const subtotal = selectTotal(cart);
  const shipping = subtotal === 0 || subtotal >= SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  const prevCount = useRef(count);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    if (count > prevCount.current) {
      setPulseKey((k) => k + 1);
    }
    prevCount.current = count;
  }, [count]);

  useEffect(() => {
    if (!cart.isOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') cartStore.setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cart.isOpen]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.style.overflow = cart.isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [cart.isOpen]);

  return (
    <>
      <motion.button
        type="button"
        className="cart-fab"
        onClick={() => cartStore.setOpen(true)}
        aria-label={`Abrir carrito (${count} ${count === 1 ? 'producto' : 'productos'})`}
        initial={reduceMotion ? false : { scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        whileHover={reduceMotion ? undefined : { scale: 1.06 }}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      >
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path
            d="M5 7h14l-1.5 9.5a2 2 0 0 1-2 1.7H8.5a2 2 0 0 1-2-1.7L5 7z"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
          <path
            d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
        <AnimatePresence>
          {count > 0 && (
            <motion.span
              key="badge"
              className="cart-fab-badge"
              initial={reduceMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { scale: 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            >
              {count}
            </motion.span>
          )}
        </AnimatePresence>
        {!reduceMotion && pulseKey > 0 && (
          <motion.span
            key={pulseKey}
            className="cart-fab-ring"
            initial={{ scale: 0.8, opacity: 0.6 }}
            animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            aria-hidden="true"
          />
        )}
      </motion.button>

      <AnimatePresence>
        {cart.isOpen && (
          <>
            <motion.div
              key="backdrop"
              className="cart-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => cartStore.setOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="cart-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Carrito de compras"
              initial={reduceMotion ? { opacity: 0 } : { x: '110%' }}
              animate={reduceMotion ? { opacity: 1 } : { x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: '110%' }}
              transition={reduceMotion ? { duration: 0.2 } : { type: 'spring', stiffness: 320, damping: 36 }}
            >
              <CartHeader count={count} />
              <div className="cart-drawer-body">
                <CartView items={cart.items} subtotal={subtotal} shipping={shipping} total={total} />
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CartHeader({ count }) {
  return (
    <header className="cart-drawer-head">
      <div>
        <span className="cart-drawer-eyebrow">✦ The American Shop</span>
        <strong>{count > 0 ? `Tu antojo (${count})` : 'Tu antojo'}</strong>
      </div>
      <button
        type="button"
        className="cart-drawer-close"
        onClick={() => cartStore.setOpen(false)}
        aria-label="Cerrar carrito"
      >
        ×
      </button>
    </header>
  );
}

function CartView({ items, subtotal, shipping, total }) {
  const [showPayHint, setShowPayHint] = useState(false);

  useEffect(() => {
    if (items.length === 0) setShowPayHint(false);
  }, [items.length]);

  if (items.length === 0) {
    return (
      <div className="cart-empty">
        <div className="cart-empty-glow" aria-hidden="true" />
        <strong>Tu carrito está vacío</strong>
        <p>Agrega un antojo gringo para empezar tu pedido.</p>
        <button
          type="button"
          className="cart-empty-btn"
          onClick={() => cartStore.setOpen(false)}
        >
          Ver catálogo →
        </button>
      </div>
    );
  }

  return (
    <>
      <ul className="cart-items" aria-label="Productos en tu carrito">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.li
              key={item.name}
              className="cart-item"
              style={{ '--accent': item.accent }}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: 40, height: 0, paddingTop: 0, paddingBottom: 0, marginBottom: 0 }}
              transition={{ type: 'spring', stiffness: 460, damping: 36 }}
            >
              <div className="cart-item-media">
                <img src={item.image} alt={item.name} className={item.className ?? ''} loading="lazy" />
              </div>
              <div className="cart-item-body">
                <div className="cart-item-top">
                  <strong>{item.name}</strong>
                  <button
                    type="button"
                    className="cart-item-remove"
                    onClick={() => cartStore.removeItem(item.name)}
                    aria-label={`Quitar ${item.name}`}
                  >
                    ×
                  </button>
                </div>
                {item.category && <span className="cart-item-cat">{item.category}</span>}
                <div className="cart-item-bottom">
                  <div className="cart-qty" role="group" aria-label={`Cantidad de ${item.name}`}>
                    <button
                      type="button"
                      onClick={() => cartStore.updateQty(item.name, item.quantity - 1)}
                      aria-label="Disminuir cantidad"
                    >
                      −
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => cartStore.updateQty(item.name, item.quantity + 1)}
                      aria-label="Aumentar cantidad"
                    >
                      +
                    </button>
                  </div>
                  <span className="cart-item-price">{formatMXN(item.price * item.quantity)}</span>
                </div>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <strong>{formatMXN(subtotal)}</strong>
        </div>
        <div className="cart-summary-row">
          <span>Envío</span>
          <strong>
            {shipping === 0 ? (
              <em className="cart-summary-free">Gratis</em>
            ) : (
              formatMXN(shipping)
            )}
          </strong>
        </div>
        {subtotal > 0 && subtotal < SHIPPING_THRESHOLD && (
          <div className="cart-summary-hint">
            Te faltan {formatMXN(SHIPPING_THRESHOLD - subtotal)} para envío gratis.
            <div className="cart-summary-progress">
              <span style={{ width: `${Math.min(100, (subtotal / SHIPPING_THRESHOLD) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="cart-summary-row cart-summary-total">
          <span>Total</span>
          <strong>{formatMXN(total)}</strong>
        </div>
      </div>

      <AnimatePresence>
        {showPayHint && (
          <motion.div
            key="pay-hint"
            className="cart-pay-hint"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            role="status"
          >
            <span aria-hidden="true">🛠️</span>
            <div>
              <strong>Pasarela próximamente</strong>
              <p>Aquí conectarás Stripe o MercadoPago para procesar el pago real.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="cart-drawer-actions">
        <button
          type="button"
          className="cart-secondary-btn"
          onClick={() => cartStore.clear()}
        >
          Vaciar
        </button>
        <button
          type="button"
          className="cart-primary-btn"
          onClick={() => setShowPayHint((v) => !v)}
          aria-expanded={showPayHint}
        >
          Pagar {formatMXN(total)} →
        </button>
      </div>
    </>
  );
}

