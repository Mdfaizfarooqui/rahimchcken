import React, { useState, useEffect } from 'react';
import ShopView from './components/ShopView';
import CartPanel from './components/CartPanel';
import TrackView from './components/TrackView';
import OwnerDashboard from './components/OwnerDashboard';
import UserAuth from './components/UserAuth';
import Footer from './components/Footer';

export default function App() {
  const [activeView, setActiveView] = useState('shop'); // shop, track, owner, auth
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cart, setCart] = useState({});
  const [cartOpen, setCartOpen] = useState(false);
  const [queueCount, setQueueCount] = useState(0);
  
  // Customer User state
  const [userToken, setUserToken] = useState(() => localStorage.getItem('fc_user_token') || '');
  const [username, setUsername] = useState(() => localStorage.getItem('fc_username') || '');
  const [myOrders, setMyOrders] = useState([]);
  
  // Owner dashboard state
  const [ownerToken, setOwnerToken] = useState(() => localStorage.getItem('fc_owner_token') || '');
  const [ownerOrders, setOwnerOrders] = useState([]);
  const [ownerStats, setOwnerStats] = useState({ waiting: 0, done: 0, cancelled: 0 });
  
  // Toast state
  const [toast, setToast] = useState({ show: false, message: '' });

  // ─── Toast helper ──────────────────────────────────────────────────────────
  const showToast = (message) => {
    setToast({ show: true, message });
    setTimeout(() => {
      setToast({ show: false, message: '' });
    }, 2500);
  };

  // ─── Fetch APIs ────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoadingProducts(false);
    }
  };

  const fetchQueueCount = async () => {
    try {
      const res = await fetch('/api/queue/stats');
      if (res.ok) {
        const data = await res.json();
        setQueueCount(data.waiting || 0);
        if (ownerToken) {
          setOwnerStats(data);
        }
      }
    } catch (err) {
      console.error('Error fetching queue count:', err);
    }
  };

  const fetchMyOrders = async () => {
    if (!userToken) return;
    try {
      const res = await fetch('/api/orders/user/all', {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyOrders(data);
      } else if (res.status === 401) {
        handleUserLogout();
      }
    } catch (err) {
      console.error('Error fetching my orders:', err);
    }
  };

  const fetchOwnerData = async () => {
    if (!ownerToken) return;
    try {
      const statsRes = await fetch('/api/queue/stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setOwnerStats(statsData);
      }
      
      const ordersRes = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${ownerToken}` }
      });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setOwnerOrders(ordersData);
      } else if (ordersRes.status === 401) {
        ownerLogout();
        showToast('Session expired. Please log in again.');
      }
    } catch (err) {
      console.error('Error fetching owner data:', err);
    }
  };

  // ─── Initial Load & SSE Sync ────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts();
    fetchQueueCount();
  }, []);

  useEffect(() => {
    if (activeView === 'track') {
      fetchMyOrders();
    }
  }, [activeView, userToken]);

  useEffect(() => {
    if (ownerToken) {
      fetchOwnerData();
    }
  }, [ownerToken, activeView]);

  useEffect(() => {
    const sse = new EventSource('/api/events');
    
    sse.onmessage = (event) => {};

    sse.addEventListener('order_update', (event) => {
      try {
        const data = JSON.parse(event.data);
        fetchQueueCount();
        
        if (ownerToken) {
          fetchOwnerData();
        }
        
        if (userToken && activeView === 'track') {
          fetchMyOrders();
          
          if (data.action === 'status_changed') {
            if (data.status === 'done') showToast(`🎉 Order ${data.orderId} is ready for pickup!`);
            else if (data.status === 'preparing') showToast(`⚡ Order ${data.orderId} is being prepared.`);
            else if (data.status === 'cancelled') showToast(`⚠️ Order ${data.orderId} was cancelled.`);
          }
        }
      } catch (err) {}
    });

    return () => sse.close();
  }, [userToken, ownerToken, activeView]);

  // ─── Customer Auth ────────────────────────────────────────────────────────
  const handleUserAuth = (data) => {
    setUserToken(data.token);
    setUsername(data.username);
    localStorage.setItem('fc_user_token', data.token);
    localStorage.setItem('fc_username', data.username);
    showToast(`Welcome, ${data.username}!`);
    setActiveView('shop');
  };

  const handleUserLogout = () => {
    setUserToken('');
    setUsername('');
    localStorage.removeItem('fc_user_token');
    localStorage.removeItem('fc_username');
    setMyOrders([]);
    if (activeView === 'track') setActiveView('shop');
    showToast('Logged out successfully');
  };

  // ─── Shopping Cart Operations ───────────────────────────────────────────────
  const addToCart = (product) => {
    setCart(prev => {
      const current = prev[product.id] || { ...product, qty: 0 };
      return {
        ...prev,
        [product.id]: { ...current, qty: current.qty + 1 }
      };
    });
    showToast(`Added ${product.name} to cart`);
  };

  const changeQty = (productId, delta) => {
    setCart(prev => {
      const current = prev[productId];
      if (!current) return prev;
      const nextQty = Math.max(0, current.qty + delta);
      if (nextQty === 0) {
        const updated = { ...prev };
        delete updated[productId];
        return updated;
      }
      return { ...prev, [productId]: { ...current, qty: nextQty } };
    });
  };

  const placeOrder = async (_, items) => {
    if (!userToken) {
      setCartOpen(false);
      setActiveView('auth');
      showToast('Please login to place an order.');
      return;
    }

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ items })
      });
      if (res.ok) {
        const newOrder = await res.json();
        setCart({});
        setCartOpen(false);
        setActiveView('track');
        showToast(`Order placed successfully! Ticket #${newOrder.id}`);
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to place order.');
        if (res.status === 401) handleUserLogout();
      }
    } catch (err) {
      showToast('Connection error. Could not place order.');
    }
  };

  // ─── Owner Operations ──────────────────────────────────────────────────────
  const ownerLogin = async (pin, callback) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      if (res.ok) {
        const data = await res.json();
        setOwnerToken(data.token);
        localStorage.setItem('fc_owner_token', data.token);
        callback(null);
        showToast('Dashboard unlocked');
      } else {
        const data = await res.json();
        callback(data.error || 'Incorrect PIN');
      }
    } catch (err) {
      callback('Server connection error');
    }
  };

  const ownerLogout = () => {
    setOwnerToken('');
    localStorage.removeItem('fc_owner_token');
    setOwnerOrders([]);
    showToast('Logged out of owner panel');
  };

  const updateOrderStatus = async (orderId, status) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`
        },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        showToast(`Order status updated to: ${status}`);
        fetchOwnerData();
        fetchQueueCount();
      } else {
        const err = await res.json();
        showToast(err.error || 'Failed to update order status');
      }
    } catch (err) {
      console.error('Error updating order:', err);
    }
  };

  const saveProduct = async (productId, prodData) => {
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`
        },
        body: JSON.stringify(prodData)
      });
      if (res.ok) {
        showToast('Product updated successfully!');
        fetchProducts();
      } else {
        showToast('Failed to update product details');
      }
    } catch (err) {}
  };

  const uploadImage = async (productId, formData) => {
    try {
      const res = await fetch(`/api/products/${productId}/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ownerToken}` },
        body: formData
      });
      if (res.ok) {
        showToast('Image uploaded successfully!');
        fetchProducts();
      } else {
        showToast('Failed to upload image.');
      }
    } catch (err) {}
  };

  const addProduct = async (prodData, callback) => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ownerToken}`
        },
        body: JSON.stringify(prodData)
      });
      if (res.ok) {
        showToast('New cut added to menu!');
        fetchProducts();
        callback(true);
      } else {
        showToast('Failed to add new menu cut.');
        callback(false);
      }
    } catch (err) {
      callback(false);
    }
  };

  // ─── Render View Dispatcher ────────────────────────────────────────────────
  const renderActiveView = () => {
    switch (activeView) {
      case 'shop':
        return (
          <ShopView
            products={products}
            loading={loadingProducts}
            addToCart={addToCart}
            queueCount={queueCount}
          />
        );
      case 'track':
        return <TrackView orders={myOrders} />;
      case 'auth':
        return <UserAuth onUserAuth={handleUserAuth} />;
      case 'owner':
        return (
          <OwnerDashboard
            products={products}
            orders={ownerOrders}
            stats={ownerStats}
            token={ownerToken}
            onLogin={ownerLogin}
            onLogout={ownerLogout}
            onUpdateOrderStatus={updateOrderStatus}
            onSaveProduct={saveProduct}
            onUploadImage={uploadImage}
            onAddProduct={addProduct}
          />
        );
      default:
        return null;
    }
  };

  const cartItemsCount = Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  return (
    <div>
      <nav>
        <div className="nav-brand" onClick={() => setActiveView('shop')} style={{ cursor: 'pointer' }}>
          Rahim's Chicken <span>Premium Raw Cuts</span>
        </div>
        <div className="nav-actions">
          <button 
            className={`nav-btn ${activeView === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveView('shop')}
          >
            Shop
          </button>
          
          {userToken ? (
            <>
              <button 
                className={`nav-btn ${activeView === 'track' ? 'active' : ''}`}
                onClick={() => setActiveView('track')}
              >
                My Orders
              </button>
              <button className="nav-btn" onClick={handleUserLogout}>
                Logout ({username})
              </button>
            </>
          ) : (
            <button 
              className={`nav-btn ${activeView === 'auth' ? 'active' : ''}`}
              onClick={() => setActiveView('auth')}
            >
              Sign In
            </button>
          )}

          <button 
            className={`nav-btn ${activeView === 'owner' ? 'active' : ''}`}
            onClick={() => setActiveView('owner')}
          >
            Owner
          </button>
          <button className="nav-btn" onClick={() => setCartOpen(true)}>
            🛒 Cart <span className="cart-count">{cartItemsCount}</span>
          </button>
        </div>
      </nav>

      {renderActiveView()}

      <Footer />

      <CartPanel
        isOpen={cartOpen}
        toggleCart={() => setCartOpen(!cartOpen)}
        cart={cart}
        changeQty={changeQty}
        onCheckout={placeOrder}
        isLoggedIn={!!userToken}
        onRequireLogin={() => {
          setCartOpen(false);
          setActiveView('auth');
        }}
      />

      <div className={`toast ${toast.show ? 'show' : ''}`}>
        {toast.message}
      </div>
    </div>
  );
}
