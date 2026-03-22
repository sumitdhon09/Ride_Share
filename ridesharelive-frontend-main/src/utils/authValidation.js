const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

export function validateFullName(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "Full name is required.";
  }
  if (trimmed.length < 2) {
    return "Enter your full name.";
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
