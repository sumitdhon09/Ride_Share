import React from 'react';

const Input = ({
  label,
  type = 'text',
  name,
  value,
  onChange,
  error,
  placeholder,
  required = false,
  disabled = false,
  className = '',
  autoComplete,
  ...props
}) => {
  const baseClasses = 'block w-full px-3 py-2 border rounded-lg shadow-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm';
  const errorClasses = error ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300';
  const disabledClasses = disabled ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : '';

  const classes = `${baseClasses} ${errorClasses} ${disabledClasses} ${className}`;

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={name}
          className={`block text-sm font-medium ${error ? 'text-red-700' : 'text-gray-700'}`}
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <input
        type={type}
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={classes}
        autoComplete={autoComplete}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={error ? `${name}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${name}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
};

export { Input };
