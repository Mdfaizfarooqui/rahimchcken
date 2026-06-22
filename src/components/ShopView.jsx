import React from 'react';

export default function ShopView({ products, loading, addToCart, queueCount }) {
  return (
    <div className="view">
      <div className="hero">
        <h1>Rahim's Chicken<br /><em>Premium Gourmet Cuts</em></h1>
        <p>Order luxury, farm-raised raw chicken online. Expertly prepared for pickup.</p>
        <div className="queue-badge">
          <span className="queue-dot"></span>
          <span>Shop open · <strong>{queueCount}</strong> {queueCount === 1 ? 'order' : 'orders'} ahead in queue</span>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Today's Premium Cuts</div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
            Loading fresh cuts...
          </div>
        ) : (
          <div className="grid">
            {products.map(p => (
              <div className="card" key={p.id}>
                {p.img ? (
                  <img src={p.img} alt={p.name} className="card-img" />
                ) : (
                  <div className="card-img-placeholder">{p.emoji}</div>
                )}
                <div className="card-body">
                  <div className="card-name">{p.name}</div>
                  <div className="card-desc">{p.desc}</div>
                  <div className="card-footer">
                    <span className="price">₹{p.price}</span>
                    <button className="add-btn" onClick={() => addToCart(p)}>
                      Add to cart
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
