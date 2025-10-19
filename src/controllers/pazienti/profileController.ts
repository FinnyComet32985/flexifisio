import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import bcrypt from "bcryptjs";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 GET - Profilo paziente
 */
export async function getProfile(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT id, nome, cognome, email, data_nascita, genere, altezza, peso, diagnosi
       FROM Pazienti WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ResponseModel(
          HttpStatus.NOT_FOUND.code,
          HttpStatus.NOT_FOUND.status,
          "Paziente non trovato"
        )
      );
    }

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(
        HttpStatus.OK.code,
        HttpStatus.OK.status,
        "Profilo paziente",
        rows[0]
      )
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    );
  }
}

/**
 * 🔹 PUT - Aggiorna profilo paziente
 */
export async function updateProfile(req: Request, res: Response) {
  try {

    const { id } = req.body;

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

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT id FROM Pazienti WHERE id = ?",
      [id]
    );

    if (existing.length === 0) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ResponseModel(
          HttpStatus.NOT_FOUND.code,
          HttpStatus.NOT_FOUND.status,
          "Paziente non trovato"
        )
      );
    }

    const hashedPassword = password ? await bcrypt.hash(password, 10) : undefined;

    await pool.query(
      `UPDATE Pazienti
       SET nome = COALESCE(?, nome),
           cognome = COALESCE(?, cognome),
           email = COALESCE(?, email),
           data_nascita = COALESCE(?, data_nascita),
           password = COALESCE(?, password),
           genere = COALESCE(?, genere),
           altezza = COALESCE(?, altezza),
           peso = COALESCE(?, peso),
           diagnosi = COALESCE(?, diagnosi)
       WHERE id = ?`,
      [nome, cognome, email, data_nascita, hashedPassword, genere, altezza, peso, diagnosi, id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Profilo aggiornato con successo")
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    );
  }
}

/**
 * 🔹 DELETE - Elimina paziente
 */
export async function deleteAccount(req: Request, res: Response) {
  try {
    const { id } = req.body;

    await pool.query("DELETE FROM Pazienti WHERE id = ?", [id]);

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Account eliminato con successo")
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    );
  }
}
