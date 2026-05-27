import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { cartStore } from '../cart/cartStore.js';
import './ProductPanel.css';

const products = [
  { name: 'Doritos USA', category: 'Chips', image: '/doritos.webp', accent: '#ff2fb3', note: 'Crunch intenso', price: '$48', badge: 'BESTSELLER', featured: true },
  { name: "Cheetos Flamin' Hot", category: 'Chips', image: '/cheetos-crunchy-flamin-hot.png', accent: '#ff4d2f', note: 'Picante favorito', price: '$52', badge: 'HOT', featured: true },
  { name: 'Mountain Dew', category: 'Bebidas', image: '/Mountain-Dew.webp', accent: '#00d8ff', note: 'Importada', className: 'is-mountain-dew', price: '$38', featured: true },
  { name: 'Nerds Rainbow', category: 'Dulces', image: '/nerds_rainbow.webp', accent: '#ff7ad6', note: 'Color y azucar', price: '$45', badge: 'NEW', featured: true },
  { name: "Cap'n Crunch", category: 'Cereal', image: '/captaincrunch.png', accent: '#f9f871', note: 'Caja clasica', price: '$185' },
  { name: 'Twix', category: 'Chocolate', image: '/twix.webp', accent: '#d7a06b', note: 'Caramelo', price: '$32' },
  { name: 'Brisk', category: 'Bebidas', image: '/brisk.png', accent: '#42d3ff', note: 'Tea frio', price: '$28' },
  { name: "Lay's BBQ", category: 'Chips', image: '/laysbbq.png', accent: '#ffd54a', note: 'Sabor BBQ', price: '$45', badge: 'BESTSELLER', featured: true },
  { name: 'Butterfinger', category: 'Chocolate', image: '/butterfinger.png', accent: '#ff9d3d', note: 'Crocante', price: '$35', featured: true },
  { name: 'Cheez-It', category: 'Chips', image: '/cheezeits.png', accent: '#ffb35c', note: 'Salado', price: '$58', badge: 'NEW', featured: true },
];

const filters = ['Todos', 'Chips', 'Bebidas', 'Dulces', 'Chocolate', 'Cereal'];

const stats = [
  { label: 'Productos', value: '200+' },
  { label: 'Drops', value: 'Cada lunes' },
  { label: 'Envíos', value: 'Todo México' },
];

const featuredProducts = products.filter((p) => p.featured);
const normalize = (str) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');

const SHOWCASE_INTERVAL = 4400;
const captionMap = {
  NEW: { text: 'Prueba el nuevo', icon: '✦', tone: 'new' },
  HOT: { text: '¡Hot sale!', icon: '🔥', tone: 'hot' },
  BESTSELLER: { text: 'Más vendido', icon: '★', tone: 'best' },
};
const defaultCaption = { text: 'Recién importado', icon: '✦', tone: 'default' };
const getCaption = (product) =>
  (product.badge && captionMap[product.badge]) || defaultCaption;

export default function ProductPanel() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [query, setQuery] = useState('');
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [isShowcasePaused, setIsShowcasePaused] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion || isShowcasePaused || featuredProducts.length <= 1) return;
    const id = setInterval(() => {
      setFeaturedIdx((i) => (i + 1) % featuredProducts.length);
    }, SHOWCASE_INTERVAL);
    return () => clearInterval(id);
  }, [reduceMotion, isShowcasePaused, featuredIdx]);

  const activeFeatured = featuredProducts[featuredIdx] ?? featuredProducts[0];
  const activeCaption = activeFeatured ? getCaption(activeFeatured) : defaultCaption;

  const visibleProducts = useMemo(() => {
    const q = normalize(query.trim());
    return products.filter((product) => {
      const inCategory = activeFilter === 'Todos' || product.category === activeFilter;
      if (!inCategory) return false;
      if (!q) return true;
      const hay = `${normalize(product.name)} ${normalize(product.category)} ${normalize(product.note || '')}`;
      return hay.includes(q);
    });
  }, [activeFilter, query]);

  const filterCounts = useMemo(() => {
    return filters.reduce((acc, f) => {
      acc[f] = f === 'Todos' ? products.length : products.filter((p) => p.category === f).length;
      return acc;
    }, {});
  }, []);

  const transition = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };

  return (
    <section className="products-panel" id="gallery">
      <div className="products-breath products-breath-pink" aria-hidden="true"></div>
      <div className="products-breath products-breath-blue" aria-hidden="true"></div>
      <div className="products-breath products-breath-yellow" aria-hidden="true"></div>
      <div className="products-inner">
        <motion.header
          className="products-header"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <span className="eyebrow">✦ Catálogo importado</span>
            <h2>Antojos americanos</h2>
          </div>
          <p className="intro">Snacks, dulces, bebidas y cereales importados con una vitrina mas clara, viva y facil de explorar.</p>
        </motion.header>

        <motion.div
          className="products-stats"
          initial={reduceMotion ? false : { opacity: 0, y: 14 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
        >
          {stats.map((stat) => (
            <div key={stat.label} className="products-stat">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </div>
          ))}
        </motion.div>

        {activeFeatured && (
          <motion.section
            className="products-showcase"
            aria-label="Producto destacado"
            aria-live="polite"
            style={{ '--accent': activeFeatured.accent }}
            onMouseEnter={() => setIsShowcasePaused(true)}
            onMouseLeave={() => setIsShowcasePaused(false)}
            onFocusCapture={() => setIsShowcasePaused(true)}
            onBlurCapture={() => setIsShowcasePaused(false)}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
          >
            <div className="products-showcase-stage">
              <motion.div
                className="products-showcase-glow"
                aria-hidden="true"
                key={`glow-${activeFeatured.name}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.65 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
              />

              <div className="products-showcase-media">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={`media-${activeFeatured.name}`}
                    src={activeFeatured.image}
                    alt={activeFeatured.name}
                    className={activeFeatured.className ?? ''}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78, rotate: -12, x: 48 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: activeFeatured.className === 'is-mountain-dew' ? 2 : -3, x: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.86, rotate: 10, x: -42 }}
                    transition={{ duration: reduceMotion ? 0 : 0.6, ease: [0.22, 1, 0.36, 1] }}
                    loading="eager"
                  />
                </AnimatePresence>
              </div>

              <div className="products-showcase-copy">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`copy-${activeFeatured.name}`}
                    className="products-showcase-copy-inner"
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
                    transition={{ duration: reduceMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.08 }}
                  >
                    <span className={`showcase-caption showcase-caption-${activeCaption.tone}`}>
                      <em aria-hidden="true">{activeCaption.icon}</em>
                      {activeCaption.text}
                    </span>
                    <h3>{activeFeatured.name}</h3>
                    <p>{activeFeatured.note}</p>
                    <div className="showcase-actions">
                      <span className="showcase-price">{activeFeatured.price}</span>
                      <button
                        type="button"
                        className="showcase-btn"
                        onClick={() => cartStore.addItem(activeFeatured)}
                        aria-label={`Agregar ${activeFeatured.name} al carrito`}
                      >
                        Agregar al carrito <span aria-hidden="true">+</span>
                      </button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="products-showcase-footer">
              <div className="products-showcase-dots" role="tablist" aria-label="Cambiar producto destacado">
                {featuredProducts.map((p, i) => (
                  <button
                    key={p.name}
                    type="button"
                    role="tab"
                    className="showcase-dot"
                    aria-selected={i === featuredIdx}
                    aria-label={`Ver ${p.name}`}
                    onClick={() => setFeaturedIdx(i)}
                    style={{ '--dot-accent': p.accent }}
                  >
                    <span className="showcase-dot-track" />
                    {i === featuredIdx && !reduceMotion && !isShowcasePaused && (
                      <motion.span
                        key={`progress-${featuredIdx}`}
                        className="showcase-dot-fill"
                        initial={{ width: '0%' }}
                        animate={{ width: '100%' }}
                        transition={{ duration: SHOWCASE_INTERVAL / 1000, ease: 'linear' }}
                      />
                    )}
                    {i === featuredIdx && (reduceMotion || isShowcasePaused) && (
                      <span className="showcase-dot-fill showcase-dot-fill-static" />
                    )}
                  </button>
                ))}
              </div>
              <span className="products-showcase-counter" aria-hidden="true">
                {String(featuredIdx + 1).padStart(2, '0')}
                <em>/</em>
                {String(featuredProducts.length).padStart(2, '0')}
              </span>
            </div>
          </motion.section>
        )}

        <div className="products-controls">
          <div className="products-search" role="search">
            <svg className="products-search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Busca tu antojo gringo..."
              aria-label="Buscar productos"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                className="products-search-clear"
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          <div className="products-toolbar" aria-label="Filtrar productos">
            {filters.map((filter) => (
              <button
                key={filter}
                className="filter-chip"
                type="button"
                aria-pressed={activeFilter === filter}
                onClick={() => setActiveFilter(filter)}
              >
                {activeFilter === filter && (
                  <motion.span className="filter-chip-bg" layoutId="activeProductFilter" transition={transition} />
                )}
                <span>
                  {filter}
                  <em className="filter-count">{filterCounts[filter]}</em>
                </span>
              </button>
            ))}
          </div>
        </div>

        {visibleProducts.length === 0 && (
          <motion.div
            className="products-empty"
            role="status"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <strong>No encontramos «{query}»</strong>
            <p>Prueba con otro nombre o limpia los filtros.</p>
            <button
              type="button"
              className="products-empty-btn"
              onClick={() => {
                setQuery('');
                setActiveFilter('Todos');
              }}
            >
              Limpiar búsqueda
            </button>
          </motion.div>
        )}

        <motion.div className="tas-product-wall" layout aria-label="Productos disponibles">
          <AnimatePresence mode="popLayout">
            {visibleProducts.map((product, index) => (
              <motion.article
                className={`tas-product-card ${product.className ?? ''}`}
                key={product.name}
                layout
                style={{ '--accent': product.accent }}
                initial={reduceMotion ? false : { opacity: 0, y: 22, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
                transition={{ ...transition, delay: reduceMotion ? 0 : index * 0.035 }}
                whileHover={reduceMotion ? undefined : { y: -8, rotate: -0.4 }}
                whileTap={reduceMotion ? undefined : { scale: 0.985 }}
              >
                <div className="tas-product-glow" aria-hidden="true" />
                {product.badge && (
                  <span className={`tas-product-badge tas-product-badge-${product.badge.toLowerCase()}`}>
                    {product.badge}
                  </span>
                )}
                <div className="tas-product-media">
                  <motion.img
                    className={`tas-product-img ${product.className ?? ''}`}
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    whileHover={reduceMotion ? undefined : { rotate: 0, scale: 1.08 }}
                    transition={transition}
                  />
                </div>
                <div className="tas-product-copy">
                  <span className="tas-product-cat">{product.category}</span>
                  <strong>{product.name}</strong>
                  <small>{product.note}</small>
                  <div className="tas-product-bottom">
                    <span className="tas-product-price">{product.price}</span>
                    <button
                      type="button"
                      className="tas-product-btn"
                      onClick={() => cartStore.addItem(product)}
                      aria-label={`Agregar ${product.name} al carrito`}
                    >
                      Agregar <span aria-hidden="true">+</span>
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>

      </div>
    </section>
  );
}
