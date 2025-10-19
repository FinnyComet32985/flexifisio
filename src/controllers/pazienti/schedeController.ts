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
