import React from 'react';
import { motion } from 'motion/react';

const Card = ({
  children,
  className = '',
  padding = 'normal',
  shadow = 'medium',
  hover = false,
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-4',
    normal: 'p-6',
    lg: 'p-8',
    xl: 'p-10',
  };

  const shadowClasses = {
    none: '',
    small: 'shadow-sm',
    medium: 'shadow-md',
    large: 'shadow-lg',
    xl: 'shadow-xl',
  };

  const baseClasses = 'bg-white rounded-lg border border-gray-200';
  const classes = `${baseClasses} ${paddingClasses[padding]} ${shadowClasses[shadow]} ${className}`;

  const CardComponent = motion.div;

  return (
    <CardComponent
      className={classes}
      whileHover={hover ? { y: -2, boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)' } : {}}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      {...props}
    >
      {children}
    </CardComponent>
  );
};

export { Card };
