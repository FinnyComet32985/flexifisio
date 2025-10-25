import pool from "../../database/connection";
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
        immagine,
    } = req.body;

    if (
        !nome ||
        !descrizione ||
        !descrizione_svolgimento ||
        !consigli_svolgimento
    ) {
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Esercizi (nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video, fisioterapista_id) VALUES (?,?,?,?,?,?,?);",
            [
                nome,
                descrizione,
                descrizione_svolgimento,
                consigli_svolgimento,
                immagine,
                video,
                fisioterapistaId,
            ]
        );

        if (result.affectedRows === 0) {
            res.status(500).json({
                message: "Errore durante la registrazione",
            });
        } else {
            res.status(200).json({ message: "Allenamento creato" });
        }
    }
};
// ricerca esercizi
export const handleGetExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video  FROM Esercizi WHERE fisioterapista_id = ?;",
            [fisioterapistaId]
        );

        if (rows.length === 0) {
            res.status(404).json({ message: "Nessun allenamento trovato" });
        } else {
            res.status(200).json(rows);
        }
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (rows.length === 0) {
            res.status(404).json({ message: "Nessun allenamento trovato" });
        } else {
            res.status(200).json(rows);
        }
    }
};

export const handleUpdateExercise = async (req: Request, res: Response) => {
    const fisioterapista_id = req.body.jwtPayload.id;
    const id = req.params.id;
    const {
        nome,
        descrizione,
        descrizione_svolgimento,
        consigli_svolgimento,
        immagine,
        video,
        fisioterapistaId,
    } = req.body;

    if (!id) {
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        if (
            !nome &&
            !descrizione &&
            !descrizione_svolgimento &&
            !consigli_svolgimento &&
            !immagine &&
            !video
        ) {
            res.status(400).json({ message: "Nessun parametro da modificare" });
        } else {
            try {
                const fields: string[] = [];
                const values: any[] = [];

                if (nome) {
                    fields.push("nome = ?");
                    values.push(nome);
                }
                if (descrizione) {
                    fields.push("descrizione = ?");
                    values.push(descrizione);
                }
                if (descrizione_svolgimento) {
                    fields.push("descrizione_svolgimento = ?");
                    values.push(descrizione_svolgimento);
                }
                if (consigli_svolgimento) {
                    fields.push("consigli_svolgimento = ?");
                    values.push(consigli_svolgimento);
                }
                if (immagine) {
                    fields.push("immagine = ?");
                    values.push(immagine);
                }
                if (video) {
                    fields.push("video = ?");
                    values.push(video);
                }

                values.push(id);
                values.push(fisioterapistaId);

                const query = `
                UPDATE Esercizi
                SET ${fields.join(", ")}
                WHERE id = ? AND fisioterapista_id = ?;
                `;

                const [result] = await pool.query<ResultSetHeader>(
                    query,
                    values
                );

                if (result.affectedRows === 0) {
                    return res
                        .status(404)
                        .json({ message: "Allenamento non trovato" });
                }

                res.status(200).json({ message: "Allenamento modificato" });
            } catch (error) {
                const err = error as Error;
                res.status(500).json({
                    message: "Errore durante la modifica. " + err.message,
                });
            }
        }
    }
};

// cancella esercizio
export const handleDeleteExercises = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const id = req.params.id;

    if (!id) {
        res.status(400).json({ message: "Parametri mancanti" });
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
            res.status(200).json({ message: "Allenamento cancellato" });
        }
    }
};
