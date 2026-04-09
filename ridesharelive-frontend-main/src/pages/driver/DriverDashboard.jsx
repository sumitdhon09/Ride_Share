import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

const DriverDashboard = () => {
  const { user } = useAuth();
  const [isOnline, setIsOnline] = useState(true);

  const availableRides = [
    { id: 1, from: 'Downtown', to: 'Airport', fare: '₹350', distance: '12 km', time: '25 min' },
    { id: 2, from: 'Office Complex', to: 'Residential Area', fare: '₹180', distance: '8 km', time: '15 min' },
    { id: 3, from: 'Shopping Mall', to: 'Train Station', fare: '₹120', distance: '5 km', time: '12 min' },
  ];

  const todayStats = {
    rides: 8,
    earnings: '₹2,450',
    hours: '6.5',
    rating: 4.8,
  };

  const weeklyEarnings = [
    { day: 'Mon', amount: 1800 },
    { day: 'Tue', amount: 2200 },
    { day: 'Wed', amount: 1950 },
    { day: 'Thu', amount: 2450 },
    { day: 'Fri', amount: 2800 },
    { day: 'Sat', amount: 3200 },
    { day: 'Sun', amount: 2450 },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex justify-between items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name}! 👋
          </h1>
          <p className="text-gray-600 mt-2">Ready to hit the road?</p>
        </div>
        
        <motion.div
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Button
            variant={isOnline ? 'success' : 'secondary'}
            size="lg"
            onClick={() => setIsOnline(!isOnline)}
            className="flex items-center space-x-2"
          >
            <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </Button>
        </motion.div>
      </motion.div>

      {/* Today's Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { title: 'Rides Today', value: todayStats.rides, icon: '🚗', color: 'blue' },
          { title: 'Earnings Today', value: todayStats.earnings, icon: '💰', color: 'green' },
          { title: 'Hours Online', value: todayStats.hours, icon: '⏰', color: 'purple' },
          { title: 'Rating', value: todayStats.rating, icon: '⭐', color: 'yellow' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
          >
            <Card hover>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Available Rides */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Available Rides</h2>
          
          <div className="space-y-4">
            {availableRides.map((ride) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-blue-600 text-xl">🚗</span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {ride.from} → {ride.to}
                      </p>
                      <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                        <span>📍 {ride.distance}</span>
                        <span>⏱️ {ride.time}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-gray-900">{ride.fare}</p>
                      <p className="text-sm text-gray-600">Estimated fare</p>
                    </div>
                    <Button>Accept</Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Weekly Earnings Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Weekly Earnings</h2>
          
          <div className="flex items-end justify-between h-48">
            {weeklyEarnings.map((day, index) => (
              <motion.div
                key={day.day}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                className="flex flex-col items-center flex-1"
              >
                <div className="w-full max-w-16 bg-gray-200 rounded-t-lg relative">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.amount / 3200) * 100}%` }}
                    transition={{ duration: 0.5, delay: 0.6 + index * 0.05 }}
                    className="bg-blue-600 rounded-t-lg w-full"
                  />
                </div>
                <p className="text-xs text-gray-600 mt-2">{day.day}</p>
                <p className="text-xs font-medium text-gray-900">₹{day.amount}</p>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default DriverDashboard;
