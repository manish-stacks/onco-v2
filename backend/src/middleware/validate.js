const { fail } = require('../utils/response');

/**
 * Halka-phulka validator — koi bhaari library nahi.
 *
 *   validate({
 *     customer_name: { required: true, maxLength: 100 },
 *     mobile:        { required: true, pattern: /^[6-9]\d{9}$/, message: 'Valid 10-digit mobile do' },
 *     unit_quantity: { type: 'int', min: 1 },
 *     email_id:      { type: 'email' },
 *   })
 */
const PATTERNS = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  mobile: /^[6-9]\d{9}$/,
  pincode: /^\d{6}$/,
};

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source] || {};
    const errors = {};

    for (const [field, rules] of Object.entries(schema)) {
      const value = data[field];
      const isEmpty = value === undefined || value === null || value === '';

      if (rules.required && isEmpty) {
        errors[field] = rules.message || `${field} zaroori hai`;
        continue;
      }
      if (isEmpty) continue; // optional aur khaali — skip

      if (rules.type === 'int' || rules.type === 'number') {
        const num = Number(value);
        if (Number.isNaN(num) || (rules.type === 'int' && !Number.isInteger(num))) {
          errors[field] = rules.message || `${field} number hona chahiye`;
          continue;
        }
        if (rules.min !== undefined && num < rules.min) {
          errors[field] = rules.message || `${field} minimum ${rules.min} hona chahiye`;
          continue;
        }
        if (rules.max !== undefined && num > rules.max) {
          errors[field] = rules.message || `${field} maximum ${rules.max} ho sakta hai`;
          continue;
        }
      }

      if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          errors[field] = rules.message || `${field} array hona chahiye`;
          continue;
        }
        if (rules.minItems && value.length < rules.minItems) {
          errors[field] = rules.message || `${field} me kam se kam ${rules.minItems} item chahiye`;
          continue;
        }
      }

      if (rules.type === 'email' && !PATTERNS.email.test(String(value))) {
        errors[field] = rules.message || 'Valid email do';
        continue;
      }
      if (rules.type === 'mobile' && !PATTERNS.mobile.test(String(value).replace(/\D/g, '').slice(-10))) {
        errors[field] = rules.message || 'Valid 10-digit mobile number do';
        continue;
      }
      if (rules.type === 'pincode' && !PATTERNS.pincode.test(String(value))) {
        errors[field] = rules.message || 'Valid 6-digit pincode do';
        continue;
      }

      if (rules.pattern && !rules.pattern.test(String(value))) {
        errors[field] = rules.message || `${field} ka format galat hai`;
        continue;
      }
      if (rules.minLength && String(value).length < rules.minLength) {
        errors[field] = rules.message || `${field} kam se kam ${rules.minLength} characters ka ho`;
        continue;
      }
      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors[field] = rules.message || `${field} zyada se zyada ${rules.maxLength} characters ka ho`;
        continue;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors[field] = rules.message || `${field} in me se ek hona chahiye: ${rules.enum.join(', ')}`;
      }
    }

    if (Object.keys(errors).length) {
      return fail(res, 'Validation failed', 422, errors);
    }
    return next();
  };
}

module.exports = { validate, PATTERNS };
