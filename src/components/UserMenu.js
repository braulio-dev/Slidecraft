import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './UserMenu.css';

const UserMenu = ({ onOpenAdmin }) => {
  const { user, logout, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = () => {
    setIsOpen(false);
    logout();
  };

  const handleAdminClick = () => {
    setIsOpen(false);
    onOpenAdmin();
  };

  return (
    <div className="user-menu">
      <button
        className="user-menu-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="user-icon">
          {user?.username?.charAt(0).toUpperCase()}
        </span>
        <span className="user-name">{user?.username}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-menu-username">{user?.username}</div>
            <div className="user-menu-role">
              {user?.role === 'admin' ? 'Administrator' : 'Employee'}
            </div>
          </div>

          <div className="user-menu-divider"></div>

          {isAdmin() && (
            <button
              className="user-menu-item"
              onClick={handleAdminClick}
            >
              <span>Admin Panel</span>
            </button>
          )}

          <button
            className="user-menu-item logout"
            onClick={handleLogout}
          >
            <span>Logout</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default UserMenu;
