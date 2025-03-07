import pool from "database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRETE;
if (!refreshTokenSecret) {
    throw new Error("REFRESH_TOKEN_SECRET environment variable is not set");
}
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRETE;
if (!accessTokenSecret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
}

// register
export const handleRegister = async (req: Request, res: Response) => {
    const { nome, cognome, email, password } = req.body;
    if (!nome || !cognome || !email || !password) {
        res.sendStatus(400).json({
            message: "nome, cognome, email e password sono obbligatori",
        });
        res.send();
    }

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Fisioterapisti WHERE email = ?",
        [email]
    );

    if (rows.length > 0) {
        res.sendStatus(409).json({ message: "Email già registrata" });
        res.send();
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Fisioterapisti (nome, cognome, email, password) VALUES (?, ?, ?, ?)",
            [nome, cognome, email, hashedPassword]
        );
        if (result.affectedRows === 0) {
            res.sendStatus(500);
        }
        res.sendStatus(201);
    } catch (err) {
        console.error(err);
        res.sendStatus(500);
    }
};
// login
export const handleLogin = async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400)
            .json({
                message: "Email e password sono obbligatori",
            })
            .send();
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM Fisioterapisti WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            res.status(401).json({ message: "Utente non trovato" }).send();
        } else {
            const match = await bcrypt.compare(password, rows[0].password);
            if (match) {
                // create JWTs
                const accessToken = jwt.sign(
                    { id: rows[0].id },
                    accessTokenSecret,
                    { expiresIn: "15m" }
                );
                const refreshToken = jwt.sign(
                    { id: rows[0].id },
                    refreshTokenSecret,
                    { expiresIn: "1d" }
                );
                // Saving refreshToken with current user
                const [result] = await pool.query<ResultSetHeader>(
                    "UPDATE Fisioterapisti SET refreshToken = ? WHERE email = ?",
                    [refreshToken, rows[0].email]
                );
                if (result.affectedRows === 0) {
                    res.sendStatus(500);
                }
                res.cookie("jwt", refreshToken, {
                    httpOnly: true,
                    sameSite: false,
                    secure: true,
                    maxAge: 24 * 60 * 60 * 1000,
                });
                res.status(200).json({ accessToken }).send();
            } else {
                res.status(401).json({ message: "Password errata" }).send();
            }
        }
    }
};

// refresh token
export const handleRefreshToken = async (req: Request, res: Response) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        res.sendStatus(401);
    } else {
        const refreshToken = cookies.jwt;
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );

        if (rows.length === 0) {
            res.sendStatus(403);
        }
        // evaluate jwt
        jwt.verify(
            refreshToken,
            refreshTokenSecret,
            (err: jwt.VerifyErrors | null, decoded: any) => {
                if (err || rows[0].id !== decoded.id) {
                    res.sendStatus(403);
                }
                const accessToken = jwt.sign(
                    { id: decoded.id },
                    accessTokenSecret,
                    { expiresIn: "15m" }
                );
                res.json({ accessToken }).send();
            }
        );
    }
};

// logout
export const handleLogout = async (req: Request, res: Response) => {
    const cookies = req.cookies;
    if (!cookies?.jwt) {
        res.sendStatus(204);
    } else {
        const refreshToken = cookies.jwt;
        const [rows] = await pool.query<RowDataPacket[]>(
            " SELECT * FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );
        if (rows.length === 0) {
            res.clearCookie("jwt", {
                httpOnly: true,
                sameSite: false,
                secure: true,
            });
            res.sendStatus(204);
        }
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Fisioterapisti SET refreshToken = NULL WHERE email = ?",
            [rows[0].email]
        );
        if (result.affectedRows === 0) {
            res.sendStatus(500);
        }
        res.clearCookie("jwt", {
            httpOnly: true,
            sameSite: false,
            secure: true,
        });
        res.sendStatus(204);
    }
};
