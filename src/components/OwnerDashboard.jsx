import React, { useState, useEffect } from 'react';

export default function OwnerDashboard({ 
  products, 
  orders, 
  stats, 
  token, 
  onLogin, 
  onLogout, 
  onUpdateOrderStatus, 
  onSaveProduct, 
  onUploadImage, 
  onAddProduct 
}) {
  const [pin, setPin] = useState('');
  const [loginError, setLoginError] = useState('');
  const [activeTab, setActiveTab] = useState('queue'); // queue, cms, add-product
  
  // CMS state values
  const [cmsState, setCmsState] = useState({});
  // Add Product state values
  const [newProdName, setNewProdName] = useState('');
  const [newProdEmoji, setNewProdEmoji] = useState('🐔');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('');

  useEffect(() => {
    // Populate CMS inputs when products load
    const initialCMS = {};
    products.forEach(p => {
      initialCMS[p.id] = { name: p.name, desc: p.desc, price: p.price, emoji: p.emoji };
    });
    setCmsState(initialCMS);
  }, [products]);

  const handleLoginSubmit = (e) => {
    e.preventDefault();
    if (!pin) return;
    onLogin(pin, (err) => {
      if (err) setLoginError(err);
      else {
        setPin('');
        setLoginError('');
      }
    });
  };

  const handleCMSChange = (productId, field, value) => {
    setCmsState(prev => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: value
      }
    }));
  };

  const handleSaveCMS = (productId) => {
    const data = cmsState[productId];
    if (!data.name || !data.price) return;
    onSaveProduct(productId, {
      name: data.name,
      desc: data.desc,
      price: parseInt(data.price),
      emoji: data.emoji
    });
  };

  const handleFileChange = (productId, fileInput) => {
    const file = fileInput.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    onUploadImage(productId, formData);
  };

  const handleAddProductSubmit = (e) => {
    e.preventDefault();
    if (!newProdName || !newProdPrice) return;
    onAddProduct({
      name: newProdName,
      emoji: newProdEmoji,
      desc: newProdDesc,
      price: parseInt(newProdPrice)
    }, (success) => {
      if (success) {
        setNewProdName('');
        setNewProdEmoji('🐔');
        setNewProdDesc('');
        setNewProdPrice('');
        setActiveTab('cms');
      }
    });
  };

  if (!token) {
    return (
      <div className="view">
        <form className="owner-login" onSubmit={handleLoginSubmit}>
          <h2>Owner Panel</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>
            Enter your owner PIN to manage orders and cuts.
          </p>
          <input
            className="cms-input"
            type="password"
            placeholder="Enter PIN (try: 1234)"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            style={{ marginBottom: '10px', textAlign: 'center', fontSize: '16px' }}
          />
          {loginError && <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: '5px 0' }}>{loginError}</p>}
          <button className="login-btn" type="submit">Unlock Dashboard</button>
        </form>
      </div>
    );
  }

  // Filter active and history orders
  const activeOrders = orders.filter(o => o.status === 'waiting' || o.status === 'preparing');
  const pastOrders = orders.filter(o => o.status === 'done' || o.status === 'cancelled');

  return (
    <div className="view owner-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)', fontSize: '2rem' }}>
          Shop Operations
        </h1>
        <button className="nav-btn" style={{ color: 'var(--primary)', borderColor: 'var(--border-cream)', background: 'transparent' }} onClick={onLogout}>
          Logout
        </button>
      </div>

      {/* Metric Stats Cards */}
      <div className="stat-row">
        <div className="stat-box">
          <div className="stat-num">{stats.waiting || 0}</div>
          <div className="stat-lbl">Orders in Queue</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{stats.done || 0}</div>
          <div className="stat-lbl">Completed Today</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">{stats.cancelled || 0}</div>
          <div className="stat-lbl">Cancelled Today</div>
        </div>
        <div className="stat-box">
          <div className="stat-num">
            ₹{orders.filter(o => o.status === 'done').reduce((sum, o) => sum + o.total, 0)}
          </div>
          <div className="stat-lbl">Revenue Today</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button 
          className={`tab ${activeTab === 'queue' ? 'active' : ''}`} 
          onClick={() => setActiveTab('queue')}
        >
          Live Queue ({activeOrders.length})
        </button>
        <button 
          className={`tab ${activeTab === 'cms' ? 'active' : ''}`} 
          onClick={() => setActiveTab('cms')}
        >
          Manage Menu ({products.length})
        </button>
        <button 
          className={`tab ${activeTab === 'add-product' ? 'active' : ''}`} 
          onClick={() => setActiveTab('add-product')}
        >
          + Add New Cut
        </button>
      </div>

      {/* TAB CONTENT: LIVE QUEUE */}
      {activeTab === 'queue' && (
        <div className="tab-content active">
          {activeOrders.length === 0 ? (
            <div className="empty-queue">
              No active orders right now. The queue is fully clear! 🎉
            </div>
          ) : (
            <table className="queue-table">
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Wait</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeOrders.map((order, idx) => (
                  <tr key={order.id}>
                    <td data-label="Pos"><strong>#{idx + 1}</strong></td>
                    <td data-label="Customer">
                      <strong>{order.customerName}</strong>
                      <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px' }}>Ticket #{order.id}</div>
                    </td>
                    <td data-label="Items">
                      {order.items.map((i, k) => (
                        <div key={k} style={{ fontSize: '13px' }}>
                          {i.emoji} {i.name} ×{i.qty}
                        </div>
                      ))}
                    </td>
                    <td data-label="Total"><strong>₹{order.total}</strong></td>
                    <td data-label="Wait">~{order.etaMins} mins</td>
                    <td data-label="Actions">
                      {order.status === 'waiting' && (
                        <button className="btn-status-action prepare" onClick={() => onUpdateOrderStatus(order.id, 'preparing')}>
                          ⚡ Prepare
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button className="btn-status-action complete" onClick={() => onUpdateOrderStatus(order.id, 'done')}>
                          ✓ Ready
                        </button>
                      )}
                      <button className="btn-status-action cancel" onClick={() => onUpdateOrderStatus(order.id, 'cancelled')}>
                        ✕ Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Past Orders History */}
          {pastOrders.length > 0 && (
            <div style={{ marginTop: '3rem' }}>
              <div className="section-title" style={{ fontSize: '1.4rem', border: 'none', marginBottom: '1rem' }}>
                Completed/Cancelled History ({pastOrders.length})
              </div>
              <table className="queue-table" style={{ opacity: 0.8 }}>
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Customer</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {pastOrders.map(order => (
                    <tr key={order.id}>
                      <td data-label="Ticket">#{order.id}</td>
                      <td data-label="Customer"><strong>{order.customerName}</strong></td>
                      <td data-label="Items">
                        {order.items.map((i, k) => (
                          <span key={k} style={{ marginRight: '8px', fontSize: '12px' }}>
                            {i.emoji} {i.name} ({i.qty})
                          </span>
                        ))}
                      </td>
                      <td data-label="Total">₹{order.total}</td>
                      <td data-label="Status">
                        <span className={`status-badge status-${order.status}`} style={{ padding: '2px 10px', fontSize: '11px' }}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MANAGE MENU */}
      {activeTab === 'cms' && (
        <div className="tab-content active">
          <div className="cms-grid">
            {products.map(p => {
              const state = cmsState[p.id] || { name: p.name, desc: p.desc, price: p.price, emoji: p.emoji };
              return (
                <div className="cms-card" key={p.id}>
                  {p.img ? (
                    <img src={p.img} alt={p.name} className="cms-img-preview" />
                  ) : (
                    <div className="cms-img-preview">{state.emoji || '🐔'}</div>
                  )}

                  {/* Image upload widget */}
                  <div className="img-upload-area" onClick={() => document.getElementById(`file-upload-${p.id}`).click()}>
                    <input
                      type="file"
                      id={`file-upload-${p.id}`}
                      accept="image/*"
                      onChange={(e) => handleFileChange(p.id, e.target)}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: '600' }}>
                      📷 Change photo
                    </span>
                    <div className="upload-hint">Upload JPG or PNG</div>
                  </div>

                  <div className="cms-field">
                    <label className="cms-label">Item Emoji</label>
                    <input
                      className="cms-input"
                      value={state.emoji}
                      onChange={(e) => handleCMSChange(p.id, 'emoji', e.target.value)}
                    />
                  </div>

                  <div className="cms-field">
                    <label className="cms-label">Item Name</label>
                    <input
                      className="cms-input"
                      value={state.name}
                      onChange={(e) => handleCMSChange(p.id, 'name', e.target.value)}
                    />
                  </div>

                  <div className="cms-field">
                    <label className="cms-label">Description</label>
                    <input
                      className="cms-input"
                      value={state.desc}
                      onChange={(e) => handleCMSChange(p.id, 'desc', e.target.value)}
                    />
                  </div>

                  <div className="cms-field">
                    <label className="cms-label">Price (₹)</label>
                    <input
                      className="cms-input"
                      type="number"
                      value={state.price}
                      onChange={(e) => handleCMSChange(p.id, 'price', e.target.value)}
                    />
                  </div>

                  <button className="save-btn" onClick={() => handleSaveCMS(p.id)}>
                    Save Changes
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: ADD NEW CUT */}
      {activeTab === 'add-product' && (
        <div className="tab-content active" style={{ maxWidth: '500px', margin: '0 auto' }}>
          <form className="cms-card" onSubmit={handleAddProductSubmit}>
            <div className="cms-field">
              <label className="cms-label">Emoji</label>
              <input
                className="cms-input"
                placeholder="e.g. 🐔"
                value={newProdEmoji}
                onChange={(e) => setNewProdEmoji(e.target.value)}
              />
            </div>
            <div className="cms-field">
              <label className="cms-label">Item Name</label>
              <input
                className="cms-input"
                placeholder="e.g. Boneless Thighs"
                value={newProdName}
                onChange={(e) => setNewProdName(e.target.value)}
                required
              />
            </div>
            <div className="cms-field">
              <label className="cms-label">Description</label>
              <input
                className="cms-input"
                placeholder="e.g. Juicy boneless leg fillets, skinless"
                value={newProdDesc}
                onChange={(e) => setNewProdDesc(e.target.value)}
              />
            </div>
            <div className="cms-field">
              <label className="cms-label">Price (₹)</label>
              <input
                className="cms-input"
                type="number"
                placeholder="e.g. 290"
                value={newProdPrice}
                onChange={(e) => setNewProdPrice(e.target.value)}
                required
              />
            </div>
            <button className="save-btn" type="submit" style={{ marginTop: '1rem' }}>
              Create Product Listing
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
