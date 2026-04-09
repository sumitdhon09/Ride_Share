import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

const RiderDashboard = () => {
  const { user } = useAuth();
  const [rideData, setRideData] = useState({
    pickup: '',
    dropoff: '',
    vehicleType: 'mini',
  });

  const vehicleTypes = [
    { id: 'bike', name: 'Bike', price: '₹12/km', icon: '🏍️' },
    { id: 'mini', name: 'Mini', price: '₹18/km', icon: '🚗' },
    { id: 'sedan', name: 'Sedan', price: '₹26/km', icon: '🚙' },
  ];

  const recentRides = [
    { id: 1, from: 'Downtown', to: 'Airport', date: '2024-01-15', fare: '₹250', status: 'completed' },
    { id: 2, from: 'Office', to: 'Home', date: '2024-01-14', fare: '₹120', status: 'completed' },
    { id: 3, from: 'Mall', to: 'Restaurant', date: '2024-01-13', fare: '₹80', status: 'completed' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.name}! 👋
        </h1>
        <p className="text-gray-600 mt-2">Where would you like to go today?</p>
      </motion.div>

      {/* Quick Book Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Quick Book</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Input
              label="Pickup Location"
              placeholder="Enter pickup location"
              value={rideData.pickup}
              onChange={(e) => setRideData({ ...rideData, pickup: e.target.value })}
            />
            <Input
              label="Drop-off Location"
              placeholder="Where to?"
              value={rideData.dropoff}
              onChange={(e) => setRideData({ ...rideData, dropoff: e.target.value })}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Vehicle
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {vehicleTypes.map((vehicle) => (
                <motion.div
                  key={vehicle.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    rideData.vehicleType === vehicle.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => setRideData({ ...rideData, vehicleType: vehicle.id })}
                >
                  <div className="text-center">
                    <div className="text-3xl mb-2">{vehicle.icon}</div>
                    <div className="font-medium text-gray-900">{vehicle.name}</div>
                    <div className="text-sm text-gray-600">{vehicle.price}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <Button className="w-full" size="lg">
            Book Ride
          </Button>
        </Card>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: 'Total Rides', value: '47', change: '+12%', icon: '🚗' },
          { title: 'Total Spent', value: '₹8,450', change: '+8%', icon: '💰' },
          { title: 'Saved Time', value: '24h', change: '+15%', icon: '⏰' },
        ].map((stat, index) => (
          <motion.div
            key={stat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 + index * 0.1 }}
          >
            <Card hover>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-green-600">{stat.change}</p>
                </div>
                <div className="text-3xl">{stat.icon}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Recent Rides */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Recent Rides</h2>
            <Button variant="outline" size="sm">
              View All
            </Button>
          </div>
          
          <div className="space-y-4">
            {recentRides.map((ride) => (
              <motion.div
                key={ride.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-blue-600">🚗</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {ride.from} → {ride.to}
                    </p>
                    <p className="text-sm text-gray-600">{ride.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{ride.fare}</p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    {ride.status}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>
    </div>
  );
};

export default RiderDashboard;
