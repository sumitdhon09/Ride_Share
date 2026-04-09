import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Card } from '../components/ui/Card';

const Unauthorized = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <Card className="p-12 max-w-md">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Unauthorized
          </h2>
          <p className="text-gray-600 mb-8">
            You don't have permission to access this page. Please contact your administrator if you think this is a mistake.
          </p>
          <div className="space-y-4">
            <Link
              to="/"
              className="block w-full inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              Go to Dashboard
            </Link>
            <Link
              to="/login"
              className="block w-full inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Login with Different Account
            </Link>
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default Unauthorized;
