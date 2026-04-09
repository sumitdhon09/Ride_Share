import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { motion } from 'motion/react';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const riderMenuItems = [
    { path: '/rider/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/rides', label: 'Book Ride', icon: '🚗' },
    { path: '/ride-history', label: 'Ride History', icon: '📋' },
    { path: '/payments', label: 'Payments', icon: '💳' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  const driverMenuItems = [
    { path: '/driver/dashboard', label: 'Dashboard', icon: '🏠' },
    { path: '/driver/rides', label: 'Available Rides', icon: '🚗' },
    { path: '/driver/earnings', label: 'Earnings', icon: '💰' },
    { path: '/driver/schedule', label: 'Schedule', icon: '📅' },
    { path: '/profile', label: 'Profile', icon: '👤' },
  ];

  const menuItems = user?.role === 'DRIVER' ? driverMenuItems : riderMenuItems;

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="w-64 bg-white shadow-lg h-screen sticky top-0"
    >
      <div className="p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-6">
          {user?.role === 'DRIVER' ? 'Driver Portal' : 'Rider Portal'}
        </h2>
        
        <nav className="space-y-2">
          {menuItems.map((item, index) => (
            <motion.div
              key={item.path}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.1 + index * 0.05 }}
            >
              <Link
                to={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  isActive(item.path)
                    ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="font-medium">{item.label}</span>
              </Link>
            </motion.div>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-600 mb-3">Quick Stats</h3>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Status</span>
              <span className="text-sm font-medium text-green-600">Active</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Member Since</span>
              <span className="text-sm font-medium text-gray-900">2024</span>
            </div>
          </div>
        </div>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
