import React from 'react';

export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-content">
        <div className="footer-brand">
          Rahim's Chicken <span>Premium Gourmet Cuts</span>
        </div>
        <div className="footer-links">
          <span>Fresh Daily</span>
          <span className="dot">•</span>
          <span>Farm Raised</span>
          <span className="dot">•</span>
          <span>Expertly Prepared</span>
        </div>
        <div className="footer-copyright">
          &copy; {new Date().getFullYear()} Rahim's Chicken. All Rights Reserved.
        </div>
      </div>
    </footer>
  );
}
