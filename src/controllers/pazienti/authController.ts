import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";
import { signAccess, signRefresh, verifyRefresh } from "../../utils/jwt";
import { v4 as uuidv4 } from "uuid";

/**
 * 🔹 REGISTER - Crea un nuovo paziente
 */
export async function register(req: Request, res: Response) {
  try {
    const {
      nome,
      cognome,
      email,
      data_nascita,
      password,
      genere,
      altezza,
      peso,
      diagnosi,
    } = req.body;

    // Validazioni base
    if (
      !nome ||
      !cognome ||
      !email ||
      !data_nascita ||
      !password ||
      !(genere === "M" || genere === "F" || genere === "Altro") ||
      !altezza ||
      !peso ||
      !diagnosi
    ) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ResponseModel(
            HttpStatus.BAD_REQUEST.code,
            HttpStatus.BAD_REQUEST.status,
            "Campi obbligatori mancanti o non validi"
          )
        );
    }

    // Verifica duplicato
    const [existsAccount] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM Pazienti WHERE email = ?",
      [email]
    );

    if (existsAccount.length > 0) {
      return res
        .status(HttpStatus.CONFLICT.code)
        .json(
          new ResponseModel(
            HttpStatus.CONFLICT.code,
            HttpStatus.CONFLICT.status,
            "Paziente già registrato"
          )
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO Pazienti (nome, cognome, email, password, data_nascita, genere, altezza, peso, diagnosi)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nome, cognome, email, hashedPassword, data_nascita, genere, altezza, peso, diagnosi]
    );

    return res
      .status(HttpStatus.CREATED.code)
      .json(
        new ResponseModel(
          HttpStatus.CREATED.code,
          HttpStatus.CREATED.status,
          "Account creato con successo"
        )
      );
  } catch (err: any) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ResponseModel(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          HttpStatus.INTERNAL_SERVER_ERROR.status,
          err.message
        )
      );
  }
}

/**
 * 🔹 LOGIN - Autentica il paziente
 */
export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ResponseModel(
            HttpStatus.BAD_REQUEST.code,
            HttpStatus.BAD_REQUEST.status,
            "Email e password sono obbligatorie"
          )
        );
    }

    const [data] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM Pazienti WHERE email = ?",
      [email]
    );

    if (data.length !== 1) {
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Credenziali non valide"
          )
        );
    }

    const user = data[0];
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Credenziali non valide"
          )
        );
    }

    // Revoca vecchi token
    await pool.query(
      `UPDATE refresh_tokens SET revoked = 1 WHERE id_user = ? AND user_type = 'P'`,
      [user.id]
    );

    // Genera nuovi token
    const payload = { id: user.id };
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);

    // Usa UUID per identificare il refresh token nel DB (veloce, indicizzabile)
    const refreshKey = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO refresh_tokens (token_hash, id_user, user_type, expires_at)
       VALUES (?, ?, 'P', ?)`,
      [refreshKey, user.id, expiresAt]
    );

    // Imposta cookie sicuro con refresh token (stringa + chiave DB)
    res.cookie("refreshToken", refreshKey, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/auth/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
    });

    // Ritorna access token + refresh token JWT separato
    return res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Login effettuato con successo", {
          accessToken,
          refreshToken,
        })
      );
  } catch (err: any) {
    console.error("Errore login paziente:", err);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ResponseModel(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          HttpStatus.INTERNAL_SERVER_ERROR.status,
          err.message
        )
      );
  }
}

/**
 * 🔹 REFRESH TOKEN - Rigenera access token
 */
export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ResponseModel(
            HttpStatus.BAD_REQUEST.code,
            HttpStatus.BAD_REQUEST.status,
            "refreshToken mancante"
          )
        );
    }

    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0",
      [refreshToken]
    );

    if (rows.length === 0) {
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Refresh token non valido"
          )
        );
    }

    const tokenRow = rows[0];

    if (new Date(tokenRow.expires_at) < new Date()) {
      await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", [tokenRow.id]);
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Refresh token scaduto"
          )
        );
    }

    // Decodifica JWT (solo per validazione firma, non DB)
    const decoded = verifyRefresh(req.cookies.refreshToken);
    if (!decoded) {
      return res
        .status(HttpStatus.UNAUTHORIZED.code)
        .json(
          new ResponseModel(
            HttpStatus.UNAUTHORIZED.code,
            HttpStatus.UNAUTHORIZED.status,
            "Token JWT non valido"
          )
        );
    }

    // Genera nuovi token
    const payload = { id: tokenRow.id_user };
    const newAccessToken = signAccess(payload);
    const newRefreshToken = signRefresh(payload);
    const newRefreshKey = uuidv4();
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      "INSERT INTO refresh_tokens (token_hash, id_user, user_type, expires_at) VALUES (?, ?, 'P', ?)",
      [newRefreshKey, tokenRow.id_user, newExpiresAt]
    );

    await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", [tokenRow.id]);

    res.cookie("refreshToken", newRefreshKey, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/auth/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(
          HttpStatus.OK.code,
          HttpStatus.OK.status,
          "Token rigenerato con successo",
          { accessToken: newAccessToken, refreshToken: newRefreshToken }
        )
      );
  } catch (err: any) {
    console.error("Errore refresh token:", err);
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ResponseModel(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          HttpStatus.INTERNAL_SERVER_ERROR.status,
          err.message
        )
      );
  }
}

/**
 * 🔹 LOGOUT - Revoca refresh token e cancella cookie
 */
export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ResponseModel(
            HttpStatus.BAD_REQUEST.code,
            HttpStatus.BAD_REQUEST.status,
            "refreshToken mancante"
          )
        );
    }

    await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?", [refreshToken]);

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/auth/",
    });

    return res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(
          HttpStatus.OK.code,
          HttpStatus.OK.status,
          "Logout effettuato con successo"
        )
      );
  } catch (err: any) {
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR.code)
      .json(
        new ResponseModel(
          HttpStatus.INTERNAL_SERVER_ERROR.code,
          HttpStatus.INTERNAL_SERVER_ERROR.status,
          err.message
        )
      );
  }
}
