import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from 'dotenv';
dotenv.config();

const ACCESS_SECRET = (process.env.ACCESS_TOKEN_SECRETE as any);
const REFRESH_SECRET = (process.env.REFRESH_TOKEN_SECRETE as any);

export function signAccess(payload: object): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: (process.env.ACCESS_TOKEN_EXPIRES || "15m" as any) });
}

export function signRefresh(payload: object): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: (process.env.REFRESH_TOKEN_EXPIRES || "7d" as any) });
}

export function verifyAccess(token: string): string | JwtPayload {
  return jwt.verify(token, ACCESS_SECRET);
}

export function verifyRefresh(token: string): string | JwtPayload {
  return jwt.verify(token, REFRESH_SECRET);
}
