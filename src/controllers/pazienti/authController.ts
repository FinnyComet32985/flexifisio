import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";
import { signAccess, signRefresh, verifyRefresh } from "../../utils/jwt";
import { v4 as uuidv4 } from "uuid";

export async function registerEmail(req: Request, res: Response) {
  try {
    const {
      email
    } = req.body;

    if (
      !email
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

    const [existsAccount] = await pool.query<RowDataPacket[]>(
      "SELECT id, password FROM Pazienti WHERE email = ?",
      [email]
    );

    if (existsAccount.length === 0) {
      return res
        .status(HttpStatus.NOT_FOUND.code) // 404
        .json(
          new ResponseModel(
            HttpStatus.NOT_FOUND.code,
            HttpStatus.NOT_FOUND.status,
            "Email non trovata. Il fisioterapista deve pre-registrare l'email."
          )
        );
    }
    
    if (existsAccount[0].password) {
      return res
        .status(HttpStatus.OK.code) // 409
        .json(
          new ResponseModel(
            HttpStatus.CONFLICT.code,
            HttpStatus.CONFLICT.status,
            "Paziente già registrato. Utilizza la pagina di login."
          )
        );
    } else {
      return res
        .status(HttpStatus.ACCEPTED.code) // 202
        .json(
          new ResponseModel(
            HttpStatus.ACCEPTED.code,
            HttpStatus.ACCEPTED.status,
            "Email verificata. Procedi alla registrazione completa."
          )
        );
    }

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

export async function register(req: Request, res: Response) {
  try {
    const {
      email,
      password,
    } = req.body;

    if (
      !email ||
      !password
    ) {
      return res
        .status(HttpStatus.BAD_REQUEST.code)
        .json(
          new ResponseModel(
            HttpStatus.BAD_REQUEST.code,
            HttpStatus.BAD_REQUEST.status,
            "Campi obbligatori mancanti o non validi (Nome, Cognome, Email, Data di Nascita, Password, Genere)."
          )
        );
    }

    // 1. Verifica l'esistenza dell'account e lo stato della password
    const [existsAccount] = await pool.query<RowDataPacket[]>(
      "SELECT id, password FROM Pazienti WHERE email = ?",
      [email]
    );

    if (existsAccount.length === 0) {
      // Se l'email NON è stata trovata (non pre-registrata dal fisioterapista)
      return res
        .status(HttpStatus.NOT_FOUND.code) // 404
        .json(
          new ResponseModel(
            HttpStatus.NOT_FOUND.code,
            HttpStatus.NOT_FOUND.status,
            "Email non trovata. Contatta il fisioterapista per la pre-registrazione."
          )
        );
    }

    const pazienteId = existsAccount[0].id;
    
    if (existsAccount[0].password) {
      // Se ha una password impostata, la registrazione è già stata effettuata.
      return res
        .status(HttpStatus.CONFLICT.code) // 409
        .json(
          new ResponseModel(
            HttpStatus.CONFLICT.code,
            HttpStatus.CONFLICT.status,
            "Paziente già completamente registrato. Utilizza la pagina di login."
          )
        );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query<RowDataPacket[]>(
      "UPDATE Pazienti SET password = ? WHERE id = ?",
      [hashedPassword, pazienteId]
    );

    // 4. Risposta di successo
    return res
      .status(HttpStatus.CREATED.code)
      .json(
        new ResponseModel(
          HttpStatus.CREATED.code,
          HttpStatus.CREATED.status,
          "Registrazione completata e account attivato con successo"
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

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await pool.query(
      `INSERT INTO refresh_tokens (token_hash, id_user, user_type, expires_at)
       VALUES (?, ?, 'P', ?)`,
      [refreshToken, user.id, expiresAt]
    );

    // Imposta cookie sicuro con refresh token (stringa + chiave DB)
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/pazienti/auth/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
    });

    // Ritorna access token + refresh token JWT separato
    return res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Login effettuato con successo", {
          accessToken: accessToken,
          user: data[0]
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

export async function refreshToken(req: Request, res: Response) {
 try {
  const { refreshToken } = req.cookies;
  // Soglia: rigenera il refresh token se mancano meno di 2 giorni (48 ore) alla scadenza.
  const REFRESH_THRESHOLD_DAYS = 2; 

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

  // 1. Cerca il token nel DB e verifica che non sia revocato
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
      "Refresh token non valido o già revocato"
     )
    );
  }

  const tokenRow = rows[0];
  const tokenExpiresAt = new Date(tokenRow.expires_at);

  // 2. Verifica scadenza (hard)
  if (tokenExpiresAt < new Date()) {
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

  // 3. Decodifica JWT (per validazione firma)
  const decoded = verifyRefresh(req.cookies.refreshToken);
  if (!decoded) {
   return res
    .status(HttpStatus.UNAUTHORIZED.code)
    .json(
     new ResponseModel(
      HttpStatus.UNAUTHORIZED.code,
      HttpStatus.UNAUTHORIZED.status,
      "Token JWT non valido (firma)"
     )
    );
  }
    
    // ⭐ 4. Recupera i dati utente
    const [userDataRows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Pazienti WHERE id = ?",
        [tokenRow.id_user]
    );

    if (userDataRows.length === 0) {
        return res
            .status(HttpStatus.NOT_FOUND.code)
            .json(
                new ResponseModel(
                    HttpStatus.NOT_FOUND.code,
                    HttpStatus.NOT_FOUND.status,
                    "Utente non trovato"
                )
            );
    }
    const user = userDataRows[0];
    
  // --- LOGICA DI RIGENERAZIONE CONDIZIONALE ---
  
  // Calcola il tempo rimanente alla scadenza
  const msRemaining = tokenExpiresAt.getTime() - Date.now();
  const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
  
  // Determina se il refresh token deve essere rigenerato
  const shouldRegenerateRefreshToken = daysRemaining < REFRESH_THRESHOLD_DAYS;

  const payload = { id: user.id };
  const newAccessToken = signAccess(payload);
  let finalRefreshToken = refreshToken; 
  let responseMessage = "Access token rigenerato con successo";

  if (shouldRegenerateRefreshToken) {
   // Rigenera ANCHE il refresh token
   finalRefreshToken = signRefresh(payload);
   const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

   // Inserisci il nuovo token e revoca il vecchio
   await pool.query(
    "INSERT INTO refresh_tokens (token_hash, id_user, user_type, expires_at) VALUES (?, ?, 'P', ?)",
    [finalRefreshToken, user.id, newExpiresAt]
   );
   await pool.query("UPDATE refresh_tokens SET revoked = 1 WHERE id = ?", [tokenRow.id]);
   
   // Imposta il nuovo token nel cookie
   res.cookie("refreshToken", finalRefreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/pazienti/auth/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
   });

   responseMessage = "Access e Refresh token rigenerati con successo";
  }

    // ⭐ 5. Prepara i dati utente per la risposta (rimuovi password)
    const userResponseData = { ...user };
    delete userResponseData.password;

  // 6. Risposta finale: SOLO access token e dati utente (come il login)
  return res
   .status(HttpStatus.OK.code)
   .json(
    new ResponseModel(
      HttpStatus.OK.code,
      HttpStatus.OK.status,
      responseMessage,
      { 
        accessToken: newAccessToken, 
        user: userResponseData // Dati utente puliti
      } 
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
     "Errore interno del server durante il refresh."
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
      sameSite: "none",
      path: "/pazienti/auth/",
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
