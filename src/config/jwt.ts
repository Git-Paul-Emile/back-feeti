import jwt from "jsonwebtoken";




const getAccessTokenSecret = (): string => {
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("ACCESS_TOKEN_SECRET manquant dans .env");
  return secret;
};

const getRefreshTokenSecret = (): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET;
  if (!secret) throw new Error("REFRESH_TOKEN_SECRET manquant dans .env");
  return secret;
};

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || "1d";
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || "7d";




export const generateToken = (payload: object): string => {
  return jwt.sign(payload, getAccessTokenSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  } as jwt.SignOptions);
};

export const verifyToken = (token: string) => {
  return jwt.verify(token, getAccessTokenSecret());
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, getRefreshTokenSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  } as jwt.SignOptions);
};

export const verifyRefreshToken = (token: string) => {
  return jwt.verify(token, getRefreshTokenSecret());
};
