import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config({ path: "../.env" });

// inizializzazione access token secrete
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRETE;
if (!accessTokenSecret) {
    throw new Error("ACCESS_TOKEN_SECRET environment variable is not set");
}
// inizializzazione refresh token secrete
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRETE;
if (!refreshTokenSecret) {
    throw new Error("REFRESH_TOKEN_SECRET environment variable is not set");
}

// register
export const handleRegister = async (req: Request, res: Response) => {
    // Estrae i dati dal corpo della richiesta
    const { nome, cognome, email, password } = req.body;
    if (!nome || !cognome || !email || !password) {
        return res.status(400).json({
            message: "nome, cognome, email e password sono obbligatori",
        });
    }

    // Controlla se esiste già un fisioterapista con la stessa email
    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Fisioterapisti WHERE email = ?",
        [email]
    );

    // Se l'email è già registrata, invia un errore di conflitto (409)
    if (rows.length > 0) {
        return res.status(409).json({ message: "Email già registrata" });
    }

    try {
        // generiamo l'hash della password e inseriamo il nuovo fisioterapista nel db
        const hashedPassword = await bcrypt.hash(password, 10);
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Fisioterapisti (nome, cognome, email, password) VALUES (?, ?, ?, ?)",
            [nome, cognome, email, hashedPassword]
        );
        if (result.affectedRows === 0) {
            res.status(500).json({
                message: "Errore nel server durante la registrazione",
            });
        } else {
            res.sendStatus(201);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({
            message: "Errore nel server durante la registrazione",
        });
    }
};
// login
export const handleLogin = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email e password sono obbligatori",
            });
        }

        // Cerca il fisioterapista nel database tramite email
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT * FROM Fisioterapisti WHERE email = ?",
            [email]
        );

        // Se l'utente non viene trovato, restituisce un errore di non autorizzato (401)
        if (rows.length === 0) {
            return res.status(401).json({ message: "Utente non trovato" });
        }

        // Confronta la password fornita con l'hash salvato nel database
        const match = await bcrypt.compare(password, rows[0].password);
        if (!match) {
            return res.status(401).json({ message: "Password errata" });
        }

        // Se le credenziali sono corrette, crea l'access token e il refresh token
        const accessToken = jwt.sign({ id: rows[0].id }, accessTokenSecret, {
            expiresIn: "15m",
        });
        const refreshToken = jwt.sign({ id: rows[0].id }, refreshTokenSecret, {
            expiresIn: "1d",
        });
        // Salva il nuovo refresh token nel database per l'utente corrente
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Fisioterapisti SET refreshToken = ? WHERE email = ?",
            [refreshToken, rows[0].email]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({
                message: "Errore interno del server durante il login.",
            });
        }

        // Imposta il refresh token in un cookie HTTP-Only
        res.cookie("jwt", refreshToken, {
            httpOnly: true,
            sameSite: false,
            secure: false,
            maxAge: 24 * 60 * 60 * 1000,
        });

        // Invia l'access token come risposta JSON
        return res.status(200).json({ accessToken });
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ message: "Errore interno del server durante il login." }); // Gestione errori generici
    }
};

// refresh token
export const handleRefreshToken = async (req: Request, res: Response) => {
    try {
        // Controlla la presenza del cookie 'jwt'
        const cookies = req.cookies;
        if (!cookies?.jwt) {
            return res
                .status(401)
                .json({ message: "Refresh token non presente." });
        }

        const refreshToken = cookies.jwt;

        // Cerca il fisioterapista associato al refresh token nel database
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, email FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );

        if (rows.length === 0) {
            // Se il token non è nel DB, è stato invalidato o è falso
            return res.status(403).json({
                message: "Refresh token non valido o utente non trovato.",
            });
        }

        const fisioterapista = rows[0];

        // Verifica la firma e la scadenza del JWT. Usiamo una Promise per integrare la callback con async/await.
        const decodedToken: any = await new Promise((resolve, reject) => {
            jwt.verify(
                refreshToken,
                refreshTokenSecret,
                (err: jwt.VerifyErrors | null, decoded: any) => {
                    if (err) {
                        return reject(new Error("Token non valido o scaduto."));
                    }
                    resolve(decoded);
                }
            );
        });

        // Controlla che il token decodificato corrisponda all'utente trovato nel DB
        if (!decodedToken || fisioterapista.id !== decodedToken.id) {
            return res.status(403).json({
                message: "Token non valido o utente non corrispondente.",
            });
        }

        // Se tutto è valido, genera un nuovo access token
        const accessToken = jwt.sign(
            { id: decodedToken.id },
            accessTokenSecret,
            { expiresIn: "15m" }
        );
        return res.status(200).json({ accessToken });
    } catch (err) {
        console.error(err);
        if (
            err instanceof Error &&
            err.message === "Token non valido o scaduto."
        ) {
            return res.status(403).json({ message: err.message });
        }
        return res.status(500).json({
            message: "Errore interno del server durante il refresh del token.",
        });
    }
};

// logout
export const handleLogout = async (req: Request, res: Response) => {
    try {
        // Controlla la presenza del cookie 'jwt'
        const cookies = req.cookies;
        if (!cookies?.jwt) {
            // Nessun JWT cookie, non c'è nulla da fare. Rispondiamo con 204 No Content.
            return res.sendStatus(204);
        }

        const refreshToken = cookies.jwt;

        // Cancella il cookie immediatamente, indipendentemente dalle operazioni sul DB, per il logout lato client.
        res.clearCookie("jwt", {
            httpOnly: true,
            sameSite: false,
            secure: false, // In produzione dovrebbe essere 'true' se sameSite: 'none'
        });

        // Cerca il fisioterapista associato al refresh token
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT email FROM Fisioterapisti WHERE refreshToken = ?",
            [refreshToken]
        );

        if (rows.length === 0) {
            // Refresh token non trovato nel DB, ma il cookie è stato cancellato. Consideriamo l'utente disconnesso.
            return res.sendStatus(204);
        }

        // Rimuove (nullifica) il refresh token dal database per invalidarlo
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Fisioterapisti SET refreshToken = NULL WHERE email = ?",
            [rows[0].email]
        );

        if (result.affectedRows === 0) {
            console.warn(
                `Fallito il nullify del refresh token per email: ${rows[0].email}`
            );
            // Nonostante l'errore nel DB, il cookie è stato cancellato, quindi il client è disconnesso.
            // Possiamo comunque rispondere 204.
        }

        return res.sendStatus(204); // Cookie cancellato e tentativo di aggiornamento DB completato.
    } catch (err) {
        console.error(err);
        return res
            .status(500)
            .json({ message: "Errore interno del server durante il logout." });
    }
};

export const handleChangePassword = async (req: Request, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body;

        // L'ID del fisioterapista viene estratto dal payload del JWT (inserito dal middleware authenticateJWT)
        if (!req.body.jwtPayload) {
            return res
                .status(401)
                .json({ message: "Autenticazione richiesta." });
        }
        const fisioterapistaId = req.body.jwtPayload.id;

        // Validazione dei parametri
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                message: "Le password sono obbligatorie",
            });
        }

        // Recupera la password attuale dal DB per confrontarla
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT password FROM Fisioterapisti WHERE id = ?",
            [fisioterapistaId]
        );
        if (rows.length === 0) {
            return res
                .status(404)
                .json({ message: "Fisioterapista non trovato." });
        }

        // Confronta la vecchia password fornita con quella salvata
        const match = await bcrypt.compare(oldPassword, rows[0].password);
        if (!match) {
            return res
                .status(401)
                .json({ message: "Password vecchia errata." });
        }

        // Se la vecchia password è corretta, esegue l'hash della nuova e aggiorna il DB
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const [result] = await pool.query<ResultSetHeader>(
            "UPDATE Fisioterapisti SET password = ? WHERE id = ?",
            [hashedPassword, fisioterapistaId]
        );

        if (result.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server durante la modifica della password.",
            });
        }

        return res.status(200).json({
            message: "Password modificata con successo.",
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica della password.",
        });
    }
};
