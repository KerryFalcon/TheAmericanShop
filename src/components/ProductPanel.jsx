import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useMemo, useState } from 'react';
import './ProductPanel.css';

const products = [
  { name: 'Doritos USA', category: 'Chips', image: '/doritos.webp', accent: '#ff2fb3', note: 'Crunch intenso' },
  { name: "Cheetos Flamin' Hot", category: 'Hot', image: "/Cheetos Crunchy Flamin' Hot_1.png", accent: '#ff4d2f', note: 'Picante favorito' },
  { name: 'Mountain Dew', category: 'Bebidas', image: '/Mountain-Dew.webp', accent: '#00d8ff', note: 'Importada' },
  { name: 'Nerds Rainbow', category: 'Dulces', image: '/nerds_rainbow.webp', accent: '#ff7ad6', note: 'Color y azucar' },
  { name: "Cap'n Crunch", category: 'Cereal', image: '/captaincrunch.png', accent: '#f9f871', note: 'Caja clasica' },
  { name: 'Twix', category: 'Chocolate', image: '/twix.webp', accent: '#d7a06b', note: 'Caramelo' },
  { name: 'Brisk', category: 'Bebidas', image: '/brisk.png', accent: '#42d3ff', note: 'Tea frio' },
  { name: "Lay's BBQ", category: 'Chips', image: '/laysbbq.png', accent: '#ffd54a', note: 'Sabor BBQ' },
  { name: 'Butterfinger', category: 'Chocolate', image: '/butterfinger.png', accent: '#ff9d3d', note: 'Crocante' },
  { name: 'Cheez-It', category: 'Snack', image: '/cheezeits.png', accent: '#ffb35c', note: 'Salado' },
];

const filters = ['Todos', 'Chips', 'Bebidas', 'Dulces', 'Chocolate', 'Cereal'];

export default function ProductPanel() {
  const [activeFilter, setActiveFilter] = useState('Todos');
  const reduceMotion = useReducedMotion();

  const visibleProducts = useMemo(() => {
    if (activeFilter === 'Todos') return products;
    return products.filter((product) => product.category === activeFilter);
  }, [activeFilter]);

  const transition = reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 };

  return (
    <section className="products-panel" id="gallery">
      <div className="products-inner">
        <motion.header
          className="products-header"
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.45 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div>
            <span className="eyebrow">Productos</span>
            <h2>Antojos americanos</h2>
          </div>
          <p className="intro">Snacks, dulces, bebidas y cereales importados con una vitrina mas clara, viva y facil de explorar.</p>
        </motion.header>

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
              <span>{filter}</span>
            </button>
          ))}
        </div>

        <motion.div className="tas-product-wall" layout aria-label="Productos disponibles">
          <AnimatePresence mode="popLayout">
            {visibleProducts.map((product, index) => (
              <motion.article
                className="tas-product-card"
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
                <div className="tas-product-media">
                  <motion.img
                    className="tas-product-img"
                    src={product.image}
                    alt={product.name}
                    loading="lazy"
                    whileHover={reduceMotion ? undefined : { rotate: 0, scale: 1.08 }}
                    transition={transition}
                  />
                </div>
                <div className="tas-product-copy">
                  <span>{product.category}</span>
                  <strong>{product.name}</strong>
                  <small>{product.note}</small>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>
    </section>
  );
}
