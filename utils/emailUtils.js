export const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return email;
  }

  return email.toLowerCase().trim();
};

export const areEmailsEquivalent = (email1, email2) => {
  return normalizeEmail(email1) === normalizeEmail(email2);
};

export const isValidEmailFormat = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};