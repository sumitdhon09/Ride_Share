const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const PHONE_PATTERN = /^[+]?[0-9\s\-()]{10,20}$/;

export function validateFullName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Full name is required.";
  }
  if (trimmed.length < 2) {
    return "Name must be at least 2 characters.";
  }
  return "";
}

export function validateEmail(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Email is required.";
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return "Enter a valid email address.";
  }
  return "";
}

export function validatePhone(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Phone number is required.";
  }
  if (!PHONE_PATTERN.test(trimmed)) {
    return "Enter a valid phone number (at least 10 digits).";
  }
  return "";
}

export function validatePassword(value, minLength = 8) {
  const password = String(value || "");
  if (!password) {
    return "Password is required.";
  }
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  return "";
}

export function validateConfirmPassword(password, confirmPassword) {
  if (!confirmPassword) {
    return "Please confirm your password.";
  }
  if (password !== confirmPassword) {
    return "Passwords do not match.";
  }
  return "";
}

export function validateOtp(value) {
  const digits = String(value || "").trim();
  if (!digits) {
    return "OTP is required.";
  }
  if (!/^\d{6}$/.test(digits)) {
    return "Enter the 6-digit OTP.";
  }
  return "";
}

export function validateLicenseNumber(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return "License number is required for drivers.";
    }
    return "";
}

export function validateVehicleNumber(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return "Vehicle number is required for drivers.";
    }
    return "";
}

export function validateVehicleModel(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
        return "Vehicle model is required for drivers.";
    }
    return "";
}
