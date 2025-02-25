import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();
const secretKey = process.env.Access_token_secrete ?? "default-secret-key";
export const authenticateJWT = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Token mancante o non valido" });
        return;
    }

    const token = authHeader.split(" ")[1];

    try {
        jwt.verify(token, secretKey, {
            ignoreExpiration: false,
        }) as JwtPayload;

        req.body.jwtPayload = token;
        req.body.jwtPayload = { id: (jwt.decode(token) as JwtPayload).id };
        next();
    } catch (error: Error | any) {
        if (error.name === "TokenExpiredError") {
            res.status(401).json({ error: "Token scaduto" });
            return;
        }
        res.status(403).json({ error: "Token non valido" });
    }
};
