import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Card } from '../components/ui/Card';

const NotFound = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <Card className="p-12 max-w-md">
          <div className="text-6xl mb-4">🚗</div>
          <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Page Not Found
          </h2>
          <p className="text-gray-600 mb-8">
            Oops! The page you're looking for seems to have taken a different route.
          </p>
          <Link
            to="/"
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            Go Home
          </Link>
        </Card>
      </motion.div>
    </div>
  );
};

export default NotFound;
