import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 GET - Lista appuntamenti
 */
export async function listAppuntamenti(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT a.*, t.fisioterapista_id
       FROM Appuntamenti a
       JOIN Trattamenti t ON a.trattamento_id = t.id
       WHERE t.paziente_id = ?
       ORDER BY a.data_appuntamento ASC, a.ora_appuntamento ASC`,
      [id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Lista appuntamenti", rows)
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

/**
 * 🔹 POST - Crea appuntamento
 */
export async function createAppuntamento(req: Request, res: Response) {
  try {
    const { id } = req.body;
    const { trattamento_id, data_appuntamento, ora_appuntamento } = req.body;

    if (!trattamento_id || !data_appuntamento || !ora_appuntamento) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, "Campi obbligatori mancanti")
      );
    }

    const [trattamento] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM Trattamenti WHERE id = ? AND paziente_id = ? AND in_corso = 1",
      [trattamento_id, id]
    );

    if (trattamento.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST.code).json(
        new ResponseModel(HttpStatus.BAD_REQUEST.code, HttpStatus.BAD_REQUEST.status, "Trattamento non valido o non in corso")
      );
    }

    await pool.query(
      `INSERT INTO Appuntamenti (data_appuntamento, ora_appuntamento, trattamento_id)
       VALUES (?, ?, ?)`,
      [data_appuntamento, ora_appuntamento, trattamento_id]
    );

    res.status(HttpStatus.CREATED.code).json(
      new ResponseModel(HttpStatus.CREATED.code, HttpStatus.CREATED.status, "Appuntamento creato con successo")
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}
