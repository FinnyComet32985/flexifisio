import pool from "database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// crea esercizio
export const handleCreateExercise = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;

    const {
        nome,
        descrizione,
        descrizione_svolgimento,
        consigli_svolgimento,
        video,
    } = req.body;

    if (
        !nome ||
        !descrizione ||
        !descrizione_svolgimento ||
        !consigli_svolgimento
    ) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Esercizi (nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video, fisioterapista_id) VALUES (?,?,?,?,?,?);",
            [
                nome, //? deve essere univoco per fisioterapista
                descrizione,
                descrizione_svolgimento,
                consigli_svolgimento,
                video,
                fisioterapistaId,
            ]
        );

        if (result.affectedRows === 0) {
            res.status(500)
                .json({ message: "Errore durante la registrazione" })
                .send();
        } else {
            res.status(200).json({ message: "Allenamento creato" }).send();
        }
    }
};
// ricerca esercizi
export const handleGetExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video  FROM Esercizi WHERE fisioterapista_id = ?;",
            [fisioterapistaId]
        );

        if (rows.length === 0) {
            res.status(404)
                .json({ message: "Nessun allenamento trovato" })
                .send();
        } else {
            res.status(200).json(rows).send();
        }
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, video FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (rows.length === 0) {
            res.status(404)
                .json({ message: "Nessun allenamento trovato" })
                .send();
        } else {
            res.status(200).json(rows).send();
        }
    }
};
// cancella esercizio
export const handleDeleteExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [result] = await pool.query<ResultSetHeader>(
            "DELETE FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (result.affectedRows === 0) {
            res.status(500).json({
                message: "Errore durante la cancellazione",
            });
        } else {
            res.status(200).json({ message: "Allenamento cancellato" }).send();
        }
    }
};
