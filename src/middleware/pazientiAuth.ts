import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import HttpStatus from "../utils/httpstatus";
import ResponseModel from "../utils/response";

interface JwtPayload {
  id: number;
  iat: number;
  exp: number;
}

export function pazientiAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Token di accesso mancante o non valido sono io",
          )
        );
      return;
    }

    const token = header.split(" ")[1];
    const secret = process.env.ACCESS_TOKEN_SECRETE || "";

    const decoded = jwt.verify(token, secret) as JwtPayload;
    (req as any).body = { id: decoded.id };

    next();
  } catch (err: any) {
    res
      .status(HttpStatus.UNAUTHORIZED.code)
      .json(
        new ResponseModel(
          HttpStatus.UNAUTHORIZED.code,
          HttpStatus.UNAUTHORIZED.status,
          "Accesso negato o token scaduto"
        )
      );
  }
}
