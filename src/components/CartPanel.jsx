import React from 'react';

export default function CartPanel({ isOpen, toggleCart, cart, changeQty, onCheckout, isLoggedIn, onRequireLogin }) {
  const cartEntries = Object.entries(cart).filter(([_, item]) => item.qty > 0);
  const totalItems = cartEntries.reduce((sum, [_, item]) => sum + item.qty, 0);
  const totalPrice = cartEntries.reduce((sum, [_, item]) => sum + (item.price * item.qty), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isLoggedIn) {
      onRequireLogin();
      return;
    }
    
    onCheckout(null, cartEntries.map(([productId, item]) => ({
      productId: parseInt(productId),
      qty: item.qty
    })));
  };

  return (
    <>
      <div className={`backdrop ${isOpen ? 'open' : ''}`} onClick={toggleCart}></div>
      <div className={`cart-panel ${isOpen ? 'open' : ''}`}>
        <div className="cart-header">
          <h2>Your Cart ({totalItems})</h2>
          <button className="close-cart" onClick={toggleCart}>✕</button>
        </div>
        
        <div className="cart-items">
          {cartEntries.length === 0 ? (
            <div className="empty-cart">
              Your cart is empty.<br />Add some premium cuts from the shop.
            </div>
          ) : (
            cartEntries.map(([id, item]) => (
              <div className="cart-item" key={id}>
                {item.img ? (
                  <img src={item.img} alt={item.name} className="cart-item-img" />
                ) : (
                  <span className="cart-item-emoji">{item.emoji}</span>
                )}
                <div className="cart-item-info">
                  <div className="cart-item-name">{item.name}</div>
                  <div className="cart-item-price">₹{item.price * item.qty}</div>
                </div>
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => changeQty(id, -1)}>−</button>
                  <span className="qty-num">{item.qty}</span>
                  <button className="qty-btn" onClick={() => changeQty(id, 1)}>+</button>
                </div>
              </div>
            ))
          )}
        </div>

        {cartEntries.length > 0 && (
          <form className="cart-footer" onSubmit={handleSubmit}>
            <div className="cart-total">
              <span>Total</span>
              <span>₹{totalPrice}</span>
            </div>
            
            {!isLoggedIn ? (
              <button className="checkout-btn" type="button" onClick={onRequireLogin}>
                Sign In to Place Order
              </button>
            ) : (
              <button className="checkout-btn" type="submit">
                Place Order →
              </button>
            )}
          </form>
        )}
      </div>
    </>
  );
}
