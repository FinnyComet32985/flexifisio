import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 GET - Tutti i trattamenti del paziente
 */
export async function listTrattamenti(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, f.nome AS fisioterapista_nome, f.cognome AS fisioterapista_cognome
       FROM Trattamenti t
       JOIN Fisioterapisti f ON t.fisioterapista_id = f.id
       WHERE t.paziente_id = ?
       ORDER BY t.data_inizio DESC`,
      [id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Lista trattamenti", rows)
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
 * 🔹 GET - Dettaglio singolo trattamento
 */
export async function getTrattamento(req: Request, res: Response) {
  try {
    const { id } = req.body;
    const { trattamentoId } = req.params;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*, f.nome AS fisioterapista_nome, f.cognome AS fisioterapista_cognome
       FROM Trattamenti t
       JOIN Fisioterapisti f ON t.fisioterapista_id = f.id
       WHERE t.id = ? AND t.paziente_id = ?`,
      [trattamentoId, id]
    );

    if (rows.length === 0) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Trattamento non trovato")
      );
    }

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Dettaglio trattamento", rows[0])
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}
