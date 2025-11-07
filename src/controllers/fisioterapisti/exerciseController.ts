import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// crea esercizio
export const handleCreateExercise = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const {
            nome,
            descrizione,
            descrizione_svolgimento,
            consigli_svolgimento,
            video,
            immagine,
        } = req.body;

        // Validazione dei parametri obbligatori
        if (
            !nome ||
            !descrizione ||
            !descrizione_svolgimento ||
            !consigli_svolgimento
        ) {
            return res.status(400).json({
                message:
                    "Parametri obbligatori mancanti (nome, descrizione, descrizione_svolgimento, consigli_svolgimento).",
            });
        }

        // Inserisce il nuovo esercizio nel database
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO Esercizi (nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video, fisioterapista_id) VALUES (?,?,?,?,?,?,?);",
            [
                nome,
                descrizione,
                descrizione_svolgimento,
                consigli_svolgimento,
                immagine || null,
                video || null,
                fisioterapistaId,
            ]
        );

        // Verifica se l'inserimento ha avuto successo
        if (result.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile creare l'esercizio.",
            });
        }

        return res.status(201).json({
            message: "Esercizio creato con successo.",
        });
    } catch (error) {
        console.error("Errore in handleCreateExercise:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la creazione dell'esercizio: " +
                err.message,
        });
    }
};

// ricerca esercizi
export const handleGetExercises = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const id = req.params.id;

        // Caso 1: Recupera tutti gli esercizi del fisioterapista
        if (!id) {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video FROM Esercizi WHERE fisioterapista_id = ?;",
                [fisioterapistaId]
            );

            if (rows.length === 0) {
                // La richiesta è valida, ma non ci sono esercizi da mostrare
                return res.status(204).send();
            }

            return res.status(200).json(rows);
        }
        // Caso 2: Recupera un esercizio specifico
        else {
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id, nome, descrizione, descrizione_svolgimento, consigli_svolgimento, immagine, video FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
                [fisioterapistaId, id]
            );

            if (rows.length === 0) {
                return res.status(404).json({
                    message:
                        "Esercizio non trovato o non appartenente a questo fisioterapista.",
                });
            }

            return res.status(200).json(rows[0]); // Restituisce l'oggetto singolo
        }
    } catch (error) {
        console.error("Errore in handleGetExercises:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero degli esercizi: " +
                err.message,
        });
    }
};

// aggiorna esercizio
export const handleUpdateExercise = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapista_id = req.body.jwtPayload.id;
        const id = req.params.id;
        const {
            nome,
            descrizione,
            descrizione_svolgimento,
            consigli_svolgimento,
            immagine,
            video,
        } = req.body;

        // Controllo: serve almeno un parametro da modificare
        if (
            !nome &&
            !descrizione &&
            !descrizione_svolgimento &&
            !consigli_svolgimento &&
            !immagine &&
            !video
        ) {
            return res
                .status(400)
                .json({ message: "Nessun parametro da modificare fornito." });
        }

        // Costruzione dinamica della query di aggiornamento
        const fields: string[] = [];
        const values: any[] = [];

        if (nome !== undefined) {
            fields.push("nome = ?");
            values.push(nome);
        }
        if (descrizione !== undefined) {
            fields.push("descrizione = ?");
            values.push(descrizione);
        }
        if (descrizione_svolgimento !== undefined) {
            fields.push("descrizione_svolgimento = ?");
            values.push(descrizione_svolgimento);
        }
        if (consigli_svolgimento !== undefined) {
            fields.push("consigli_svolgimento = ?");
            values.push(consigli_svolgimento);
        }
        if (immagine !== undefined) {
            fields.push("immagine = ?");
            values.push(immagine);
        }
        if (video !== undefined) {
            fields.push("video = ?");
            values.push(video);
        }

        values.push(id, fisioterapista_id);

        const query = `
                UPDATE Esercizi
                SET ${fields.join(", ")}
                WHERE id = ? AND fisioterapista_id = ?;
                `;

        const [result] = await pool.query<ResultSetHeader>(query, values);

        if (result.affectedRows === 0) {
            // Potrebbe essere che l'esercizio non esista o che i dati fossero già identici.
            // Un controllo preliminare potrebbe dare un messaggio più preciso, ma 404 è una buona approssimazione.
            return res.status(404).json({
                message: "Esercizio non trovato o nessuna modifica effettuata.",
            });
        }

        return res
            .status(200)
            .json({ message: "Esercizio modificato con successo." });
    } catch (error) {
        console.error("Errore in handleUpdateExercise:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica dell'esercizio: " +
                err.message,
        });
    }
};

// elimina esercizio
export const handleDeleteExercises = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const id = req.params.id;

        // Prima di eliminare, verifica se l'esercizio è utilizzato in qualche scheda di allenamento
        const [usageCheck] = await pool.query<RowDataPacket[]>(
            "SELECT scheda_id FROM SchedaEsercizi WHERE esercizio_id = ? LIMIT 1;",
            [id]
        );

        if (usageCheck.length > 0) {
            return res.status(409).json({
                message:
                    "Impossibile eliminare l'esercizio: è attualmente utilizzato in una o più schede di allenamento.",
            });
        }

        // Se non è utilizzato, procede con l'eliminazione
        // Elimina l'esercizio solo se l'ID e il fisioterapista_id corrispondono
        const [result] = await pool.query<ResultSetHeader>(
            "DELETE FROM Esercizi WHERE fisioterapista_id = ? AND id = ?;",
            [fisioterapistaId, id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message:
                    "Esercizio non trovato o non appartenente a questo fisioterapista.",
            });
        }

        return res
            .status(200)
            .json({ message: "Esercizio eliminato con successo." });
    } catch (error) {
        console.error("Errore in handleDeleteExercises:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante l'eliminazione dell'esercizio: " +
                err.message,
        });
    }
};
