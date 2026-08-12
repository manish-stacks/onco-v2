const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const customerModel = require('../../models/customer.model');
const smsService = require('../../services/sms.service');
const pushService = require('../../services/firebase.service');

const {
  ok,
  created,
  fail,
  asyncHandler,
} = require('../../utils/response');

const { genOtp } = require('../../utils/helpers');

/* =========================================================
   JWT TOKEN
========================================================= */

function signToken(customer, platform) {
  return jwt.sign(
    {
      customer_id: customer.customer_id,
      platform,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    }
  );
}

/* =========================================================
   AUTH COOKIE
========================================================= */

function setAuthCookie(res, token) {
  res.cookie('ohm_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/* =========================================================
   CLEAR AUTH COOKIE
========================================================= */

function clearAuthCookie(res) {
  const isProduction = process.env.NODE_ENV === 'production';

  res.clearCookie('ohm_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
  });
}

/* =========================================================
   POST /auth/register
========================================================= */

const register = asyncHandler(async (req, res) => {
  const {
    customer_name,
    password,
    email_id,
    mobile,
    address,
    city,
    state,
    country,
    pincode,
  } = req.body;

  /* -------------------------
     Validate mobile
  ------------------------- */

  const cleanMobile = String(mobile || '')
    .replace(/\D/g, '')
    .slice(-10);

  if (!cleanMobile || cleanMobile.length !== 10) {
    return fail(res, 'Valid mobile number chahiye', 422);
  }

  /* -------------------------
     Check mobile
  ------------------------- */

  if (await customerModel.findByMobile(cleanMobile)) {
    return fail(
      res,
      'Ye mobile number pehle se registered hai',
      409
    );
  }

  /* -------------------------
     Check email
  ------------------------- */

  if (
    email_id &&
    (await customerModel.findByEmail(email_id))
  ) {
    return fail(
      res,
      'Ye email pehle se registered hai',
      409
    );
  }

  /* -------------------------
     Password
  ------------------------- */

  const hashed = await bcrypt.hash(password, 10);

  /* -------------------------
     Create customer
  ------------------------- */

  const customerId = await customerModel.create({
    customer_name,
    password: hashed,
    email_id,
    mobile: cleanMobile,
    address,
    city,
    state,
    country,
    pincode,
    platform: req.platform,
  });

  /* -------------------------
     Fetch customer
  ------------------------- */

  const customer = await customerModel.findById(customerId);

  /* -------------------------
     Generate token
  ------------------------- */

  const token = signToken(
    customer,
    req.platform
  );

  /* -------------------------
     Save token in cookie
  ------------------------- */

  setAuthCookie(res, token);

  /* -------------------------
     Response
  ------------------------- */

  return created(
    res,
    {
      token,
      customer,
    },
    'Registration ho gaya'
  );
});

/* =========================================================
   POST /auth/login
   Password login
========================================================= */

const login = asyncHandler(async (req, res) => {
  const {
    mobile,
    password,
  } = req.body;

  /* -------------------------
     Clean mobile
  ------------------------- */

  const cleanMobile = String(mobile || '')
    .replace(/\D/g, '')
    .slice(-10);

  /* -------------------------
     Find customer
  ------------------------- */

  const customer =
    await customerModel.findByMobile(cleanMobile);

  if (!customer) {
    return fail(
      res,
      'Mobile ya password galat hai',
      401
    );
  }

  /* -------------------------
     Check password
  ------------------------- */

  const match = await bcrypt.compare(
    password,
    customer.password || ''
  );

  if (!match) {
    return fail(
      res,
      'Mobile ya password galat hai',
      401
    );
  }

  /* -------------------------
     Check status
  ------------------------- */

  if (customer.status !== 'Active') {
    return fail(
      res,
      'Account inactive hai, support se baat karo',
      403
    );
  }

  /* -------------------------
     Last login
  ------------------------- */

  await customerModel.updateLastLogin(
    customer.customer_id
  );

  /* -------------------------
     Register FCM token
  ------------------------- */

  if (req.body.fcm_token) {
    await pushService.registerToken({
      token: req.body.fcm_token,

      customerId: customer.customer_id,

      platform:
        req.body.platform ||
        (req.platform === 'app'
          ? 'android'
          : 'web'),

      deviceInfo:
        req.headers['user-agent'],
    });
  }

  /* -------------------------
     Remove sensitive fields
  ------------------------- */

  delete customer.password;
  delete customer.otp;

  /* -------------------------
     Generate JWT
  ------------------------- */

  const token = signToken(
    customer,
    req.platform
  );

  /* -------------------------
     Save JWT in cookie
  ------------------------- */

  setAuthCookie(res, token);

  /* -------------------------
     Response
  ------------------------- */

  return ok(
    res,
    {
      token,
      customer,
    },
    'Login ho gaya'
  );
});

/* =========================================================
   POST /auth/otp/request
   Login / Signup
========================================================= */

const requestOtp = asyncHandler(async (req, res) => {
  /* -------------------------
     Clean mobile
  ------------------------- */

  const cleanMobile = String(
    req.body.mobile || ''
  )
    .replace(/\D/g, '')
    .slice(-10);

  if (!cleanMobile || cleanMobile.length !== 10) {
    return fail(
      res,
      'Valid mobile number chahiye',
      422
    );
  }

  /* -------------------------
     Find customer
  ------------------------- */

  let customer =
    await customerModel.findByMobile(cleanMobile);

  let isNewUser = false;

  /* -------------------------
     Create account if needed
  ------------------------- */

  if (!customer) {
    if (req.body.allow_signup === false) {
      return fail(
        res,
        'Is number pe koi account nahi hai',
        404
      );
    }

    const customerId =
      await customerModel.create({
        customer_name:
          req.body.customer_name ||
          'Customer',

        password: null,

        mobile: cleanMobile,

        platform: req.platform,
      });

    customer = {
      customer_id: customerId,
    };

    isNewUser = true;
  }

  /* -------------------------
     Generate OTP
  ------------------------- */

  const otp = genOtp(6);

  const expiryMinutes = 10;

  /* -------------------------
     Save OTP
  ------------------------- */

  await customerModel.setOtp(
    customer.customer_id,
    otp,
    expiryMinutes
  );

  /* -------------------------
     Send OTP
  ------------------------- */

  await smsService.sendOtp(
    cleanMobile,
    otp,
    {
      customerId:
        customer.customer_id,

      purpose:
        isNewUser
          ? 'signup'
          : 'login',

      source: req.platform,

      ip: req.ip,

      expiresAt: new Date(
        Date.now() +
        expiryMinutes * 60000
      )
        .toISOString()
        .slice(0, 19)
        .replace('T', ' '),
    }
  );

  /* -------------------------
     Response
  ------------------------- */

  return ok(
    res,
    {
      customer_id:
        customer.customer_id,

      is_new_user:
        isNewUser,

      expires_in:
        expiryMinutes * 60,

      ...(smsService.isConfigured()
        ? {}
        : {
          dev_otp: otp,
        }),
    },
    'OTP bhej diya'
  );
});

/* =========================================================
   POST /auth/otp/verify
========================================================= */

const verifyOtp = asyncHandler(async (req, res) => {
  const {
    customer_id,
    otp,
    fcm_token,
    platform,
  } = req.body;

  /* -------------------------
     Verify OTP
  ------------------------- */

  const valid =
    await customerModel.verifyOtp(
      customer_id,
      otp
    );

  if (!valid) {
    return fail(
      res,
      'OTP galat hai ya expire ho gaya',
      401
    );
  }

  /* -------------------------
     Get customer
  ------------------------- */

  const customer =
    await customerModel.findById(
      customer_id
    );

  if (!customer) {
    return fail(
      res,
      'Account nahi mila',
      404
    );
  }

  /* -------------------------
     Check status
  ------------------------- */

  if (customer.status !== 'Active') {
    return fail(
      res,
      'Account inactive hai',
      403
    );
  }

  /* -------------------------
     Update login
  ------------------------- */

  await customerModel.updateLastLogin(
    customer_id
  );

  /* -------------------------
     Mark OTP used
  ------------------------- */

  await smsService.markOtpUsed(
    customer.mobile,
    otp
  );

  /* -------------------------
     Register FCM
  ------------------------- */

  if (fcm_token) {
    await pushService.registerToken({
      token: fcm_token,

      customerId: customer_id,

      platform:
        platform ||
        (req.platform === 'app'
          ? 'android'
          : 'web'),

      deviceInfo:
        req.headers['user-agent'],
    });
  }

  /* -------------------------
     Generate JWT
  ------------------------- */

  const token = signToken(
    customer,
    req.platform
  );

  /* -------------------------
     Save JWT cookie
  ------------------------- */

  setAuthCookie(res, token);

  /* -------------------------
     Response
  ------------------------- */

  return ok(
    res,
    {
      token,
      customer,
    },
    'Verify ho gaya'
  );
});

/* =========================================================
   POST /auth/password/reset
   OTP verify karke password reset
========================================================= */

const resetPassword = asyncHandler(
  async (req, res) => {
    const {
      customer_id,
      otp,
      new_password,
    } = req.body;

    /* -------------------------
       Verify OTP
    ------------------------- */

    const valid =
      await customerModel.verifyOtp(
        customer_id,
        otp
      );

    if (!valid) {
      return fail(
        res,
        'OTP galat hai ya expire ho gaya',
        401
      );
    }

    /* -------------------------
       Hash password
    ------------------------- */

    const hashedPassword =
      await bcrypt.hash(
        new_password,
        10
      );

    /* -------------------------
       Update password
    ------------------------- */

    await customerModel.updatePassword(
      customer_id,
      hashedPassword
    );

    return ok(
      res,
      null,
      'Password badal gaya'
    );
  }
);

/* =========================================================
   POST /auth/password/change
   Logged-in user
========================================================= */

const changePassword = asyncHandler(
  async (req, res) => {
    /* -------------------------
       Get current customer
    ------------------------- */

    const customer =
      await customerModel.findByMobile(
        (
          await customerModel.findById(
            req.customer.customer_id
          )
        ).mobile
      );

    if (!customer) {
      return fail(
        res,
        'Account nahi mila',
        404
      );
    }

    /* -------------------------
       Check old password
    ------------------------- */

    const match =
      await bcrypt.compare(
        req.body.old_password,
        customer.password || ''
      );

    if (!match) {
      return fail(
        res,
        'Purana password galat hai',
        401
      );
    }

    /* -------------------------
       New password
    ------------------------- */

    const hashedPassword =
      await bcrypt.hash(
        req.body.new_password,
        10
      );

    /* -------------------------
       Update password
    ------------------------- */

    await customerModel.updatePassword(
      req.customer.customer_id,
      hashedPassword
    );

    return ok(
      res,
      null,
      'Password badal gaya'
    );
  }
);

/* =========================================================
   GET /auth/me
========================================================= */

const me = asyncHandler(async (req, res) => {
  const customer =
    await customerModel.findById(
      req.customer.customer_id
    );

  if (!customer) {
    return fail(
      res,
      'Account nahi mila',
      404
    );
  }

  return ok(
    res,
    customer
  );
});

/* =========================================================
   PATCH /auth/me
========================================================= */

const updateProfile = asyncHandler(
  async (req, res) => {
    await customerModel.update(
      req.customer.customer_id,
      req.body
    );

    const customer =
      await customerModel.findById(
        req.customer.customer_id
      );

    return ok(
      res,
      customer,
      'Profile update ho gaya'
    );
  }
);

/* =========================================================
   POST /auth/device-token
   App start / FCM refresh
========================================================= */

const registerDevice = asyncHandler(
  async (req, res) => {
    const {
      fcm_token,
      platform,
      device_info,
    } = req.body;

    if (!fcm_token) {
      return fail(
        res,
        'fcm_token chahiye',
        422
      );
    }

    await pushService.registerToken({
      token: fcm_token,

      customerId:
        req.customer.customer_id,

      platform:
        platform || 'android',

      deviceInfo:
        device_info ||
        req.headers['user-agent'],
    });

    return ok(
      res,
      null,
      'Device register ho gaya'
    );
  }
);

/* =========================================================
   DELETE /auth/device-token
========================================================= */

const unregisterDevice = asyncHandler(
  async (req, res) => {
    if (!req.body.fcm_token) {
      return fail(
        res,
        'fcm_token chahiye',
        422
      );
    }

    await pushService.removeToken(
      req.body.fcm_token
    );

    return ok(
      res,
      null,
      'Device hata diya'
    );
  }
);

/* =========================================================
   POST /auth/logout
========================================================= */

const logout = asyncHandler(
  async (req, res) => {
    /* -------------------------
       Clear JWT cookie
    ------------------------- */

    clearAuthCookie(res);

    /* -------------------------
       Response
    ------------------------- */

    return ok(
      res,
      null,
      'Logout ho gaya'
    );
  }
);

/* =========================================================
   EXPORTS
========================================================= */

module.exports = {
  register,
  login,
  requestOtp,
  verifyOtp,
  resetPassword,
  changePassword,
  me,
  updateProfile,
  registerDevice,
  unregisterDevice,
  logout,
};