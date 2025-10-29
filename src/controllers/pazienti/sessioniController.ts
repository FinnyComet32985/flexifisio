import { Request, Response } from "express";
import pool from "../../database/connection";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import HttpStatus from "../../utils/httpstatus";
import ResponseModel from "../../utils/response";

/**
 * 🔹 Crea una nuova sessione di allenamento
 */
export async function createSessione(req: Request, res: Response) {
  try {
    const { id, fisioterapista_id, scheda_id } = req.body;

    // 1️⃣ Crea la sessione
    const [result] = await pool.query<ResultSetHeader>(
      `INSERT INTO SessioniAllenamento (cliente_id, fisioterapista_id, scheda_id)
       VALUES (?, ?, ?)`,
      [id, fisioterapista_id, scheda_id]
    );

    const sessioneId = result.insertId;

    // 2️⃣ Copia gli esercizi dalla scheda
    const [esercizi] = await pool.query<RowDataPacket[]>(
      `SELECT esercizio_id, serie, ripetizioni
       FROM SchedaEsercizi
       WHERE scheda_id = ?`,
      [scheda_id]
    );

    for (const e of esercizi) {
      await pool.query(
        `INSERT INTO SessioneEsercizi (sessione_id, esercizio_id, serie_effettive, ripetizioni_effettive)
         VALUES (?, ?, ?, ?)`,
        [sessioneId, e.esercizio_id, e.serie, e.ripetizioni]
      );
    }

    res
      .status(HttpStatus.CREATED.code)
      .json(
        new ResponseModel(HttpStatus.CREATED.code, HttpStatus.CREATED.status, "Sessione creata con successo", {
          sessioneId,
        })
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

/**
 * 🔹 Elenco sessioni di un cliente
 */
export async function listSessioniByCliente(req: Request, res: Response) {
  try {
    const { id } = req.body;

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT sa.*, f.nome AS fisioterapista_nome, f.cognome AS fisioterapista_cognome
       FROM SessioniAllenamento sa
       JOIN Fisioterapisti f ON sa.fisioterapista_id = f.id
       WHERE sa.cliente_id = ?
       ORDER BY sa.data_sessione DESC`,
      [id]
    );

    res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Sessioni del cliente", rows)
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

/**
 * 🔹 Dettaglio di una sessione (con esercizi)
 */
export async function getSessioneById(req: Request, res: Response) {
  try {
    const { id } = req.params;

    const [sessioneRows] = await pool.query<RowDataPacket[]>(
      `SELECT * FROM SessioniAllenamento WHERE id = ?`,
      [id]
    );

    if (sessioneRows.length === 0) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(
          new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Sessione non trovata")
        );
    }

    const [eserciziRows] = await pool.query<RowDataPacket[]>(
      `SELECT se.*, e.nome, e.descrizione, e.immagine, e.video
       FROM SessioneEsercizi se
       JOIN Esercizi e ON se.esercizio_id = e.id
       WHERE se.sessione_id = ?`,
      [id]
    );

    const data = { ...sessioneRows[0], esercizi: eserciziRows };

    res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Dettaglio sessione", data)
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

/**
 * 🔹 Salva o aggiorna il sondaggio di fine sessione
 */
export async function saveSondaggio(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { sondaggio } = req.body; // JSON dal frontend

    await pool.query(
      `UPDATE SessioniAllenamento SET sondaggio = ? WHERE id = ?`,
      [JSON.stringify(sondaggio), id]
    );

    res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Sondaggio salvato con successo")
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

/**
 * 🔹 Aggiorna dati effettivi di un esercizio nella sessione
 */
export async function updateEsercizioSessione(req: Request, res: Response) {
  try {
    const { id } = req.params; // id della sessione
    const { esercizio_id, ripetizioni_effettive, serie_effettive, note } = req.body;

    const [result] = await pool.query<ResultSetHeader>(
      `UPDATE SessioneEsercizi
       SET ripetizioni_effettive = ?, serie_effettive = ?, note = ?
       WHERE sessione_id = ? AND esercizio_id = ?`,
      [ripetizioni_effettive, serie_effettive, note, id, esercizio_id]
    );

    if (result.affectedRows === 0) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(
          new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Esercizio non trovato nella sessione")
        );
    }

    res
      .status(HttpStatus.OK.code)
      .json(
        new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Esercizio aggiornato con successo")
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
