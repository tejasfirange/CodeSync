import { env } from '../config/env.js';
import { loginUser, registerUser } from '../services/auth.service.js';
import ApiResponse from '../utils/ApiResponse.js';
import asyncHandler from '../utils/asyncHandler.js';
import generateToken from '../utils/generateToken.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.isProduction || env.cookieSameSite === 'none',
  sameSite: env.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000
};

const sendAuthResponse = (res, statusCode, user, message) => {
  const token = generateToken(user._id);

  res.cookie(env.cookieName, token, cookieOptions);
  res.status(statusCode).json(
    new ApiResponse(statusCode, {
      user
    }, message)
  );
};

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  sendAuthResponse(res, 201, user, 'Registration successful');
});

export const login = asyncHandler(async (req, res) => {
  const user = await loginUser(req.body);
  sendAuthResponse(res, 200, user, 'Login successful');
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie(env.cookieName, cookieOptions);
  res.status(200).json(new ApiResponse(200, null, 'Logout successful'));
});

export const me = asyncHandler(async (req, res) => {
  res.status(200).json(new ApiResponse(200, { user: req.user }, 'Current user loaded'));
});
