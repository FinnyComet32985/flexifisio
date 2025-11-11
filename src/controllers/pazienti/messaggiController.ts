import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 GET - Nome fisioterapista
 */
export async function getFisioterapista(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `
        SELECT f.nome, f.cognome
        FROM fisioterapisti f JOIN Trattamenti t 
        ON f.id = t.id 
        WHERE t.paziente_id = ?
      `,
      [id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Nome Fisioterapista", rows[0])
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

/**
 * 🔹 GET - Lista messaggi del paziente
 */
export async function listMessaggi(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT m.*, t.fisioterapista_id
       FROM Messaggi m
       JOIN Trattamenti t ON m.trattamento_id = t.id
       WHERE t.paziente_id = ?
       ORDER BY m.data_invio DESC`,
      [id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Lista messaggi", rows)
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

/**
 * 🔹 POST - Invia messaggio
 */
export async function createMessaggio(req: Request, res: Response) {
  try {
    const { id } = req.body;
    const { trattamento_id, testo } = req.body;

    if (!trattamento_id || !testo) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, "Campi obbligatori mancanti")
      );
    }

    const [check] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM Trattamenti WHERE id = ? AND paziente_id = ? AND in_corso = 1",
      [trattamento_id, id]
    );

    if (check.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, "Trattamento non valido o non in corso")
      );
    }

    await pool.query(
      `INSERT INTO Messaggi (testo, data_invio, trattamento_id, mittente)
       VALUES (?, NOW(), ?, 'Paziente')`,
      [testo, trattamento_id]
    );

    res.status(HttpStatus.CREATED.code).json(
      new ResponseModel(HttpStatus.CREATED.code, HttpStatus.CREATED.status, "Messaggio inviato")
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}
