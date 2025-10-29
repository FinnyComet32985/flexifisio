import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket } from "mysql2";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 GET - Schede allenamento del paziente
 */
export async function listSchede(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, t.fisioterapista_id
       FROM SchedeAllenamento s
       JOIN Trattamenti t ON s.trattamento_id = t.id
       WHERE t.paziente_id = ?`,
      [id]
    );

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Schede allenamento", rows)
    );
  } catch (err: any) {
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(HttpStatus.INTERNAL_SERVER_ERROR.code, HttpStatus.INTERNAL_SERVER_ERROR.status, err.message)
    );
  }
}

export async function getSchedaById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [schedaRows] = await pool.query<RowDataPacket[]>(
      `SELECT s.*, f.nome AS fisioterapista_nome, f.cognome AS fisioterapista_cognome
       FROM SchedeAllenamento s
       JOIN Trattamenti t ON s.trattamento_id = t.id
       JOIN Fisioterapisti f ON t.fisioterapista_id = f.id
       WHERE s.id = ?`,
      [id]
    );

    if (schedaRows.length === 0) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(
          new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Scheda non trovata")
        );
    }

    const [eserciziRows] = await pool.query<RowDataPacket[]>(
      `SELECT e.id, e.nome, e.descrizione, e.descrizione_svolgimento, e.consigli_svolgimento,
              e.immagine, e.video, se.serie, se.ripetizioni
       FROM SchedaEsercizi se
       JOIN Esercizi e ON se.esercizio_id = e.id
       WHERE se.scheda_id = ?`,
      [id]
    );

    const data = {
      ...schedaRows[0],
      esercizi: eserciziRows,
    };

    res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Dettaglio scheda di allenamento", data)
      );
  } catch (err: any) {
    res
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