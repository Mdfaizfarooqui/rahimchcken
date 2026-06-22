import React from 'react';

export default function TrackView({ orders }) {
  if (orders.length === 0) {
    return (
      <div className="tracker-section" style={{ textAlign: 'center', padding: '5rem 1.5rem', color: 'var(--muted)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', color: 'var(--primary)', marginBottom: '0.5rem' }}>No orders placed yet</h2>
        <p>Your active orders and pickup tickets will appear here.</p>
      </div>
    );
  }

  const getStepClass = (orderStatus, step) => {
    // Steps: 1 = Placed (waiting), 2 = Preparing, 3 = Ready (done)
    if (orderStatus === 'cancelled') return 'timeline-step';

    if (step === 1) {
      return 'timeline-step completed'; // always completed once placed
    }
    if (step === 2) {
      if (orderStatus === 'preparing') return 'timeline-step active';
      if (orderStatus === 'done') return 'timeline-step completed';
      return 'timeline-step'; // waiting
    }
    if (step === 3) {
      if (orderStatus === 'done') return 'timeline-step active completed';
      return 'timeline-step'; // waiting/preparing
    }
    return 'timeline-step';
  };

  const getProgressPercentage = (status) => {
    if (status === 'waiting') return '15%';
    if (status === 'preparing') return '60%';
    if (status === 'done') return '100%';
    return '0%';
  };

  return (
    <div className="view tracker-section">
      <div className="section-title">Track Your Orders</div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        {orders.map(order => {
          const statusClass = `status-badge status-${order.status}`;
          const isLive = order.status === 'waiting' || order.status === 'preparing';

          return (
            <div className="order-card" key={order.id}>
              <div className="order-card-header">
                <div>
                  <div className="order-id">Ticket #{order.id}</div>
                  <div className="order-name">{order.customerName}</div>
                </div>
                <span className={statusClass}>
                  {order.status === 'done' ? 'Ready for pickup' : order.status}
                </span>
              </div>

              {/* Real-time Wait ETA Block */}
              {isLive && (
                <div className="eta-block">
                  <div className="eta-label">Estimated Wait Time</div>
                  <div className="eta-time">~{order.currentEta || order.etaMins} mins</div>
                  <div className="eta-pos">
                    Position #{order.currentPosition || order.pos} in the preparation queue
                  </div>
                </div>
              )}

              {/* Timeline Flow */}
              {order.status !== 'cancelled' && (
                <div className="timeline">
                  {/* Progress filler line */}
                  <div 
                    style={{ 
                      position: 'absolute', 
                      top: '15px', 
                      left: '10%', 
                      width: `calc(80% * ${order.status === 'waiting' ? 0 : order.status === 'preparing' ? 0.5 : 1})`,
                      height: '4px', 
                      background: order.status === 'done' ? 'var(--green)' : 'var(--primary)', 
                      zIndex: 1,
                      transition: 'width 0.6s ease'
                    }}
                  />
                  <div className={getStepClass(order.status, 1)}>
                    <div className="timeline-dot">1</div>
                    <div className="timeline-label">Placed</div>
                  </div>
                  <div className={getStepClass(order.status, 2)}>
                    <div className="timeline-dot">2</div>
                    <div className="timeline-label">Preparing</div>
                  </div>
                  <div className={getStepClass(order.status, 3)}>
                    <div className="timeline-dot">3</div>
                    <div className="timeline-label">Ready for Pickup</div>
                  </div>
                </div>
              )}

              {/* Status Alert Banners */}
              {order.status === 'done' && (
                <div className="notif-banner notif-success">
                  🎉 <strong>Your cuts are fresh & ready!</strong> Please present Ticket #{order.id} at the counter for pickup.
                </div>
              )}
              
              {order.status === 'cancelled' && (
                <div className="notif-banner notif-cancel">
                  ⚠️ <strong>Order Cancelled.</strong> This order was cancelled. Please inquire at the counter or place a new order.
                </div>
              )}

              <div className="order-items-list">
                {order.items.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{item.emoji} {item.name} × {item.qty}</span>
                    <span>₹{item.price}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-cream)', marginTop: '8px', paddingTop: '8px', fontWeight: '700', color: 'var(--primary)' }}>
                  <span>Total Paid</span>
                  <span>₹{order.total}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
