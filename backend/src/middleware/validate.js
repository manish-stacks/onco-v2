const { fail } = require('../utils/response');

/**
 * A lightweight validator — no heavy library.
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
        errors[field] = rules.message || `${field} is required`;
        continue;
      }
      if (isEmpty) continue; // optional aur khaali — skip

      if (rules.type === 'int' || rules.type === 'number') {
        const num = Number(value);
        if (Number.isNaN(num) || (rules.type === 'int' && !Number.isInteger(num))) {
          errors[field] = rules.message || `${field} must be a number`;
          continue;
        }
        if (rules.min !== undefined && num < rules.min) {
          errors[field] = rules.message || `${field} must be at least ${rules.min}`;
          continue;
        }
        if (rules.max !== undefined && num > rules.max) {
          errors[field] = rules.message || `${field} can be at most ${rules.max}`;
          continue;
        }
      }

      if (rules.type === 'array') {
        if (!Array.isArray(value)) {
          errors[field] = rules.message || `${field} must be an array`;
          continue;
        }
        if (rules.minItems && value.length < rules.minItems) {
          errors[field] = rules.message || `${field} needs at least ${rules.minItems} item(s)`;
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
        errors[field] = rules.message || `${field} has an invalid format`;
        continue;
      }
      if (rules.minLength && String(value).length < rules.minLength) {
        errors[field] = rules.message || `${field} must be at least ${rules.minLength} characters`;
        continue;
      }
      if (rules.maxLength && String(value).length > rules.maxLength) {
        errors[field] = rules.message || `${field} can be at most ${rules.maxLength} characters`;
        continue;
      }
      if (rules.enum && !rules.enum.includes(value)) {
        errors[field] = rules.message || `${field} must be one of: ${rules.enum.join(', ')}`;
      }
    }

    if (Object.keys(errors).length) {
      return fail(res, 'Validation failed', 422, errors);
    }
    return next();
  };
}

module.exports = { validate, PATTERNS };
