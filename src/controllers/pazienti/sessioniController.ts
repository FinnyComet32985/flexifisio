import { Request, Response } from "express"
import pool from "../../database/connection"
import { RowDataPacket, ResultSetHeader } from "mysql2"
import HttpStatus from "../../utils/httpstatus"
import ResponseModel from "../../utils/response"

export async function createSessione(req: Request, res: Response) {
  try {
    const { id, fisioterapista_id, scheda_id } = req.body

    // 1️⃣ Inserisci la sessione
    const [result] = await pool.query<ResultSetHeader>(
      `
      INSERT INTO SessioniAllenamento (paziente_id, fisioterapista_id, scheda_id)
      VALUES (?, ?, ?)
      `,
      [id, fisioterapista_id, scheda_id]
    )

    const sessioneId = result.insertId

    // 2️⃣ Copia gli esercizi della scheda nella sessione
    const [esercizi] = await pool.query<RowDataPacket[]>(
      `
      SELECT esercizio_id, serie, ripetizioni
      FROM SchedaEsercizi
      WHERE scheda_id = ?
      `,
      [scheda_id]
    )

    for (const e of esercizi) {
      await pool.query(
        `
        INSERT INTO SessioneEsercizi (sessione_id, esercizio_id, serie_effettive, ripetizioni_effettive)
        VALUES (?, ?, ?, ?)
        `,
        [sessioneId, e.esercizio_id, e.serie, e.ripetizioni]
      )
    }

    res.status(HttpStatus.CREATED.code).json(
      new ResponseModel(
        HttpStatus.CREATED.code,
        HttpStatus.CREATED.status,
        "Sessione di allenamento creata con successo",
        { sessioneId }
      )
    )
  } catch (err: any) {
    console.error(err)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    )
  }
}

export async function listSessioniByCliente(req: Request, res: Response) {
  try {
    const { id } = req.body

    const [rows] = await pool.query<RowDataPacket[]>(
      `
      SELECT 
        sa.id,
        sa.data_sessione,
        sa.scheda_id,
        s.nome AS nome_scheda,
        s.tipo_scheda,
        f.nome AS fisioterapista_nome,
        f.cognome AS fisioterapista_cognome
      FROM SessioniAllenamento sa
      JOIN Fisioterapisti f ON sa.fisioterapista_id = f.id
      JOIN SchedeAllenamento s ON sa.scheda_id = s.id
      WHERE sa.paziente_id = ?
      ORDER BY sa.data_sessione DESC
      `,
      [id]
    )

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Sessioni del paziente", rows)
    )
  } catch (err: any) {
    console.error(err)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    )
  }
}

/**
 * 🔹 Ottiene il dettaglio completo di una sessione
 * GET /api/sessioni/:id
 */
export async function getSessioneById(req: Request, res: Response) {
  try {
    const { id } = req.params

    const [sessioneRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT 
        sa.*, 
        s.nome AS nome_scheda,
        s.tipo_scheda,
        s.note AS note_scheda,
        f.nome AS fisioterapista_nome,
        f.cognome AS fisioterapista_cognome
      FROM SessioniAllenamento sa
      JOIN Fisioterapisti f ON sa.fisioterapista_id = f.id
      JOIN SchedeAllenamento s ON sa.scheda_id = s.id
      WHERE sa.id = ?
      `,
      [id]
    )

    if (sessioneRows.length === 0) {
      return res
        .status(HttpStatus.NOT_FOUND.code)
        .json(new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Sessione non trovata"))
    }

    const [eserciziRows] = await pool.query<RowDataPacket[]>(
      `
      SELECT 
        se.id AS sessione_esercizio_id,
        e.id AS esercizio_id,
        e.nome,
        e.descrizione,
        e.descrizione_svolgimento,
        e.consigli_svolgimento,
        e.immagine,
        e.video,
        se.serie_effettive,
        se.ripetizioni_effettive,
        se.note
      FROM SessioneEsercizi se
      JOIN Esercizi e ON se.esercizio_id = e.id
      WHERE se.sessione_id = ?
      `,
      [id]
    )

    const data = { ...sessioneRows[0], esercizi: eserciziRows }

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Dettaglio sessione", data)
    )
  } catch (err: any) {
    console.error(err)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    )
  }
}

/**
 * 🔹 Aggiorna i dati effettivi di un esercizio della sessione
 * PATCH /api/sessioni/:id/esercizi
 * BODY: { esercizio_id, ripetizioni_effettive, serie_effettive, note }
 */
export async function updateEsercizioSessione(req: Request, res: Response) {
  try {
    const { id } = req.params // id sessione
    const { esercizio_id, ripetizioni_effettive, serie_effettive, note } = req.body

    const [result] = await pool.query<ResultSetHeader>(
      `
      UPDATE SessioneEsercizi
      SET ripetizioni_effettive = ?, serie_effettive = ?, note = ?
      WHERE sessione_id = ? AND esercizio_id = ?
      `,
      [ripetizioni_effettive, serie_effettive, note, id, esercizio_id]
    )

    if (result.affectedRows === 0) {
      return res.status(HttpStatus.NOT_FOUND.code).json(
        new ResponseModel(HttpStatus.NOT_FOUND.code, HttpStatus.NOT_FOUND.status, "Esercizio non trovato nella sessione")
      )
    }

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Esercizio aggiornato correttamente")
    )
  } catch (err: any) {
    console.error(err)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    )
  }
}

/**
 * 🔹 Salva il sondaggio di fine sessione
 * PATCH /api/sessioni/:id/sondaggio
 * BODY: { sondaggio: {...} }
 */
export async function saveSondaggio(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { sondaggio } = req.body

    await pool.query(
      `
      UPDATE SessioniAllenamento
      SET sondaggio = ?
      WHERE id = ?
      `,
      [JSON.stringify(sondaggio), id]
    )

    res.status(HttpStatus.OK.code).json(
      new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, "Sondaggio salvato con successo")
    )
  } catch (err: any) {
    console.error(err)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR.code).json(
      new ResponseModel(
        HttpStatus.INTERNAL_SERVER_ERROR.code,
        HttpStatus.INTERNAL_SERVER_ERROR.status,
        err.message
      )
    )
  }
}
