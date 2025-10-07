import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";
import { signAccess, signRefresh, verifyRefresh } from "../../utils/jwt";

export async function register(req: Request, res: Response) {
  try {
    const { nome, cognome, email, data_nascita, password, genere, altezza, peso, diagnosi } = req.body;

    if(
        !nome ||
        !cognome ||
        !email ||
        !data_nascita ||
        !password ||
        !(genere == 'M' || genere == 'F' || genere == 'Altro') ||
        !altezza || 
        !peso ||
        !diagnosi
    ){
        return res.status(HttpStatus.BAD_REQUEST.code).json(
            new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, 'Bad Request')
        );
    }

    const [existsAccount] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Pazienti WHERE email = ?",
        [email]
    );

    if(existsAccount.length > 0){
        return res.status(HttpStatus.CONFLICT.code).json(
            new ResponseModel(HttpStatus.CONFLICT.code, HttpStatus.CONFLICT.status, 'Paziente Exsist')
        );
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const createPaziente = await pool.query(
        `INSERT INTO Pazienti (nome, cognome, email, password, data_nascita, genere, altezza, peso, diagnosi) 
        VALUE(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [nome, cognome, email, hashedPassword, data_nascita, genere, altezza, peso, diagnosi]
    );

    res.status(HttpStatus.CREATED.code).json(
        new ResponseModel(HttpStatus.CREATED.code, HttpStatus.CREATED.status, 'Account created successfully')
    );

  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if( !email || !password ){
        return res.status(HttpStatus.BAD_REQUEST.code).json(
            new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, 'Bad Request')
        );
    }

    
    const [ data ] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM Pazienti WHERE email = ?",
        [email]
    );
    
    if(data.length != 1){
        return res.status(HttpStatus.UNAUTHORIZED.code).json(
            new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, `Credenzials Not Valid`)
        );
    }
    
    const user = data[0];
    
    const isValidPassowrd = await  bcrypt.compare(password, user.password);
    
    if(!isValidPassowrd){
        return res.status(HttpStatus.UNAUTHORIZED.code).json(
            new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, 'Credenzials Not Valid')
        );
    }

    await pool.query(
        `UPDATE refresh_tokens SET revoked = 1 WHERE id_user = ? AND user_type = 'P'`,
        [user.id]
    )
    
    const payload = {
        id: user.id
    }
    
    const accessToken = signAccess(payload);
    const refreshToken = signRefresh(payload);
    
    await pool.query<RowDataPacket[]>(
        "INSERT INTO refresh_tokens(token_hash, id_user, user_type, expires_at) VALUES (?, ?, ?, ?)",
        [
            refreshToken,
            user.id,
            'P',
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ]
    );
    
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,       
      secure: true,         
      sameSite: "strict",   
      path: "/auth/" 
    });
    
    res.status(HttpStatus.OK.code).json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, 'Login successful', {accessToken: accessToken})
    );

  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

export async function refreshToken(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;
    
    if (!refreshToken) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, 'refreshToken is required')
      );
    }

    const [ data ] = await pool.query<RowDataPacket[]>(
        `SELECT * from refresh_tokens Where token_hash = ?`,
        [refreshToken]
    )

    if (data.length == 0){
        return res.status(HttpStatus.UNAUTHORIZED.code).json(
            new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, 'Refresh token is revoked')
        );
    }

    const token = data[0];

    const decoded = verifyRefresh(token.token_hash)

    if (!decoded || !(decoded as any).exp){
      return res.status(HttpStatus.UNAUTHORIZED.code).json(
        new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, 'Refresh token is expires')
      );
    }

    if (token.expiresAt && new Date(token.expiresAt) < new Date() && (decoded as any).exp < Math.floor(Date.now() / 1000)) {
        return res.status(HttpStatus.UNAUTHORIZED.code).json(
            new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, 'Refresh token is expires')
        );
    }

    if(token.user_type != 'P'){
        return res.status(HttpStatus.CONFLICT.code).json(
            new ResponseModel(HttpStatus.CONFLICT.code, HttpStatus.CONFLICT.status, 'Incoerenza tra token e user')
        );
    }

    const payload = { 
      id: token.id_user
    };
    // Genera nuovi token
    const newAccessToken = signAccess(payload);
    const newRefreshToken = signRefresh(payload);

    await pool.query<RowDataPacket[]>(
        "INSERT INTO refresh_tokens(token_hash, id_user, user_type, expires_at) VALUES (?, ?, ?, ?)",
        [
            newRefreshToken,
            token.id_user,
            'P',
            new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        ]
    );
    
    await pool.query<RowDataPacket[]>(
        "UPDATE refresh_tokens SET revoked = 1 WHERE id = ?",
        [
            token.id
        ]
    );
    
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,       
      secure: true,
      sameSite: "strict",   
      path: "/auth/"
    });

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, 'Token refreshed successfully', {accessToken: newAccessToken})
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

export async function logout(req: Request, res: Response) {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, 'refreshToken is required')
      );
    }

    await pool.query<RowDataPacket[]>(
      "UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?",
      [
        refreshToken
      ]
    );

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: true, 
      sameSite: 'strict',
      path: "/auth/"
    });

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, 'Logged out successfully')
    );
  } catch (err: any) {
    res.status(HttpStatus.BAD_REQUEST.code).json(
      new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, err.message)
    );
  }
}