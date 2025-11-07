import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// crea una scheda di allenamento
export const handleCreateTrainingCard = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;
        const { nome, tipo_scheda, note } = req.body;

        // Validazione dei parametri di input
        if (
            !nome ||
            !tipo_scheda ||
            (tipo_scheda !== "Clinica" && tipo_scheda !== "Casa")
        ) {
            return res.status(400).json({
                message: "Parametri mancanti o non validi (nome, tipo_scheda).",
            });
        }

        // Cerca un trattamento (attivo o terminato) per il paziente e il fisioterapista
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamenti.length === 0) {
            return res.status(404).json({
                message: "Nessun trattamento trovato per questo paziente.",
            });
        }

        if (trattamenti[0].in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento per questo paziente è terminato, impossibile creare nuove schede.",
            });
        }

        const trattamentoId = trattamenti[0].id;

        // Inserisce la nuova scheda di allenamento nel database
        const [insert] = await pool.query<ResultSetHeader>(
            "INSERT INTO schedeallenamento (nome, tipo_scheda, note, trattamento_id) VALUES (?,?,?,?);",
            [nome, tipo_scheda, note || "", trattamentoId]
        );

        if (insert.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile creare la scheda.",
            });
        }

        return res.status(201).json({
            message: "Scheda creata con successo.",
            scheda_id: insert.insertId,
        });
    } catch (error) {
        console.error("Errore in handleCreateTrainingCard:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la creazione della scheda: " +
                err.message,
        });
    }
};

// get schede di allenamento
export const handleGetTrainingCards = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;

        // Cerca un trattamento (attivo o terminato) per il paziente e il fisioterapista
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamenti.length === 0) {
            return res.status(404).json({
                message: "Nessun trattamento trovato per questo paziente.",
            });
        }

        // Anche se il trattamento è terminato, il fisioterapista può comunque visualizzare le schede passate.
        // Non restituiamo 403 qui, a differenza della creazione.

        const trattamentoId = trattamenti[0].id;
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, tipo_scheda, note FROM schedeallenamento WHERE trattamento_id =?;",
            [trattamentoId]
        );

        if (rows.length === 0) {
            // La richiesta è valida, ma non ci sono schede da mostrare
            return res.status(204).send(); // No content
        }

        return res.status(200).json(rows);
    } catch (error) {
        console.error("Errore in handleGetTrainingCards:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero delle schede: " +
                err.message,
        });
    }
};

// get singola scheda di allenamento
export const handleGetFullTrainingCard = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);

        if (isNaN(scheda_id)) {
            return res.status(400).json({ message: "ID scheda non valido." });
        }

        // Query unica per ottenere i dettagli della scheda e tutti gli esercizi associati
        const [rows] = await pool.query<RowDataPacket[]>(
            `
            SELECT 
                s.id AS scheda_id,
                s.nome AS scheda_nome,
                s.tipo_scheda,
                s.note,
                t.fisioterapista_id,
                e.id AS esercizio_id,
                e.nome AS esercizio_nome,
                e.descrizione,
                e.descrizione_svolgimento,
                e.consigli_svolgimento,
                e.immagine,
                se.ripetizioni,
                se.serie
            FROM schedeallenamento s
            JOIN trattamenti t ON s.trattamento_id = t.id
            LEFT JOIN schedaesercizi se ON s.id = se.scheda_id
            LEFT JOIN esercizi e ON se.esercizio_id = e.id
            WHERE s.id = ? AND t.fisioterapista_id = ? AND t.in_corso = 1;
        `,
            [scheda_id, fisioterapistaId]
        );

        if (rows.length === 0) {
            // La scheda non esiste o il fisioterapista non ha i permessi (o il trattamento è terminato)
            return res.status(404).json({
                message: "Scheda non trovata o accesso non consentito.",
            });
        }

        // Raggruppa i risultati per creare un oggetto JSON strutturato e pulito
        const schedaCompleta = {
            id: rows[0].scheda_id,
            nome: rows[0].scheda_nome,
            tipo_scheda: rows[0].tipo_scheda,
            note: rows[0].note,
            esercizi: rows
                .filter((row) => row.esercizio_id !== null)
                .map((row) => ({
                    id: row.esercizio_id,
                    nome: row.esercizio_nome,
                    descrizione: row.descrizione,
                    descrizione_svolgimento: row.descrizione_svolgimento,
                    consigli_svolgimento: row.consigli_svolgimento,
                    immagine: row.immagine,
                    video: row.video,
                    ripetizioni: row.ripetizioni,
                    serie: row.serie,
                })),
        };

        return res.status(200).json(schedaCompleta);
    } catch (error) {
        console.error("Errore in handleGetFullTrainingCard:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero della scheda: " +
                err.message,
        });
    }
};

// delete scheda di allenamento
export const handleDeleteTrainingCard = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);

        if (isNaN(scheda_id)) {
            return res.status(400).json({ message: "ID scheda non valido." });
        }

        // Verifica che la scheda esista e che il fisioterapista abbia i permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             WHERE s.id = ?`,
            [scheda_id]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ message: "Scheda non trovata." });
        }

        const dati = checkResult[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per eliminare questa scheda.",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento non è in corso, impossibile eliminare la scheda.",
            });
        }

        // Esegue l'eliminazione
        const [deleteResult] = await pool.query<ResultSetHeader>(
            "DELETE FROM schedeallenamento WHERE id = ?;",
            [scheda_id]
        );

        if (deleteResult.affectedRows === 0) {
            // Questo caso è strano se il check precedente è passato, ma lo gestiamo
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile eliminare la scheda.",
            });
        }

        return res
            .status(200)
            .json({ message: "Scheda eliminata con successo." });
    } catch (error) {
        console.error("Errore in handleDeleteTrainingCard:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante l'eliminazione della scheda: " +
                err.message,
        });
    }
};

// update scheda di allenamento
export const handleUpdateTrainingCard = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);
        const { nome, tipo_scheda, note } = req.body;

        if (isNaN(scheda_id)) {
            return res.status(400).json({ message: "ID scheda non valido." });
        }

        // Controllo parametri: serve almeno un campo da modificare
        if (
            nome === undefined &&
            tipo_scheda === undefined &&
            note === undefined
        ) {
            return res
                .status(400)
                .json({ message: "Nessun parametro da modificare fornito." });
        }

        // Verifica esistenza e permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             WHERE s.id = ?`,
            [scheda_id]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ message: "Scheda non trovata." });
        }

        const dati = checkResult[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questa scheda.",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento non è in corso, impossibile modificare la scheda.",
            });
        }

        // Costruzione dinamica della query di aggiornamento
        const fields: string[] = [];
        const values: any[] = [];

        if (nome !== undefined) {
            fields.push("nome = ?");
            values.push(nome);
        }
        if (tipo_scheda !== undefined) {
            fields.push("tipo_scheda = ?");
            values.push(tipo_scheda);
        }
        if (note !== undefined) {
            fields.push("note = ?");
            values.push(note);
        }

        values.push(scheda_id);

        const updateQuery = `
            UPDATE schedeallenamento
            SET ${fields.join(", ")}
            WHERE id = ?;
        `;

        const [updateResult] = await pool.query<ResultSetHeader>(
            updateQuery,
            values
        );

        if (updateResult.affectedRows === 0) {
            return res.status(200).json({
                message:
                    "Nessuna modifica effettuata: i dati forniti sono identici a quelli esistenti.",
            });
        }

        return res
            .status(200)
            .json({ message: "Scheda modificata con successo." });
    } catch (err) {
        console.error("Errore in handleUpdateTrainingCard:", err);
        const error = err as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica della scheda: " +
                error.message,
        });
    }
};

// aggiungi esercizio
export const handleAddExerciseToTrainingCard = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);
        const { esercizio_id, ripetizioni, serie } = req.body;

        if (
            isNaN(scheda_id) ||
            !esercizio_id ||
            ripetizioni === undefined ||
            serie === undefined
        ) {
            return res.status(400).json({
                message:
                    "Parametri mancanti o non validi (esercizio_id, ripetizioni, serie).",
            });
        }

        // Verifica esistenza scheda e permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             WHERE s.id = ?`,
            [scheda_id]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ message: "Scheda non trovata." });
        }

        const dati = checkResult[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questa scheda.",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento non è in corso, impossibile aggiungere esercizi.",
            });
        }

        // Verifica che l'esercizio esista e appartenga al fisioterapista (o sia un esercizio "globale")
        const [checkEsercizio] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM esercizi WHERE id = ? AND fisioterapista_id = ?;",
            [esercizio_id, fisioterapistaId]
        );

        if (checkEsercizio.length === 0) {
            return res.status(404).json({
                message:
                    "Esercizio non trovato o non di proprietà di questo fisioterapista.",
            });
        }

        // Aggiunge l'esercizio alla scheda
        const [addResult] = await pool.query<ResultSetHeader>(
            "INSERT INTO schedaesercizi (scheda_id, esercizio_id, ripetizioni, serie) VALUES (?, ?, ?, ?);",
            [scheda_id, esercizio_id, ripetizioni, serie]
        );

        if (addResult.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile aggiungere l'esercizio.",
            });
        }

        return res
            .status(200)
            .json({ message: "Esercizio aggiunto con successo." });
    } catch (error) {
        console.error("Errore in handleAddExerciseToTrainingCard:", error);
        const err = error as Error;
        // Gestisce l'errore di chiave duplicata (esercizio già presente nella scheda)
        if (err.message.includes("Duplicate entry")) {
            return res.status(409).json({
                message: "Questo esercizio è già presente nella scheda.",
            });
        }
        return res.status(500).json({
            message:
                "Errore interno del server durante l'aggiunta dell'esercizio: " +
                err.message,
        });
    }
};

// Recupera tutti gli esercizi associati a una specifica scheda di allenamento.
export const handleGetExercisesFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);

        if (isNaN(scheda_id)) {
            return res.status(400).json({ message: "ID scheda non valido." });
        }

        // Verifica che la scheda esista e che il fisioterapista abbia i permessi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT s.id FROM schedeallenamento s JOIN trattamenti t ON s.trattamento_id = t.id WHERE s.id = ? AND t.fisioterapista_id = ?;`,
            [scheda_id, fisioterapistaId]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({
                message: "Scheda non trovata o accesso non consentito.",
            });
        }

        // Recupera tutti gli esercizi per la scheda
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT esercizi.nome, esercizi.descrizione, esercizi.descrizione_svolgimento, esercizi.consigli_svolgimento, esercizi.immagine, esercizi.video, schedaesercizi.ripetizioni, schedaesercizi.serie FROM esercizi JOIN schedaesercizi ON esercizi.id=schedaesercizi.esercizio_id WHERE schedaesercizi.scheda_id=?;",
            [scheda_id]
        );

        if (rows.length === 0) {
            return res.status(204).send(); // La scheda esiste ma è vuota
        }

        return res.status(200).json(rows);
    } catch (error) {
        console.error("Errore in handleGetExercisesFromTrainingCard:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero degli esercizi: " +
                err.message,
        });
    }
};

// Elimina un esercizio da una scheda di allenamento.
export const handleDeleteExerciseFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);
        const esercizio_id = parseInt(req.params.exerciseId);

        if (isNaN(scheda_id) || isNaN(esercizio_id)) {
            return res
                .status(400)
                .json({ message: "ID scheda o ID esercizio non validi." });
        }

        // Verifica esistenza scheda, permessi e stato trattamento
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             WHERE s.id = ?`,
            [scheda_id]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({ message: "Scheda non trovata." });
        }

        const dati = checkResult[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questa scheda.",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento non è in corso, impossibile eliminare esercizi.",
            });
        }

        // Esegue l'eliminazione dell'esercizio dalla scheda
        const [deleteResult] = await pool.query<ResultSetHeader>(
            "DELETE FROM schedaesercizi WHERE scheda_id = ? AND esercizio_id = ?;",
            [scheda_id, esercizio_id]
        );

        if (deleteResult.affectedRows === 0) {
            // L'esercizio non era nella scheda, ma non è un errore server
            return res
                .status(404)
                .json({ message: "Esercizio non trovato in questa scheda." });
        }

        return res
            .status(200)
            .json({ message: "Esercizio rimosso con successo." });
    } catch (error) {
        console.error("Errore in handleDeleteExerciseFromTrainingCard:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la rimozione dell'esercizio: " +
                err.message,
        });
    }
};

// Modifica le ripetizioni e/o le serie di un esercizio all'interno di una scheda.
export const handleUpdateExerciseFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const scheda_id = parseInt(req.params.id);
        const { esercizio_id, ripetizioni, serie } = req.body;

        // Validazione parametri
        if (isNaN(scheda_id) || !esercizio_id) {
            return res
                .status(400)
                .json({ message: "ID scheda o ID esercizio non validi." });
        }
        if (ripetizioni === undefined && serie === undefined) {
            return res.status(400).json({
                message: "Nessun parametro da modificare (ripetizioni, serie).",
            });
        }

        // Verifica esistenza, permessi e stato trattamento
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             JOIN schedaesercizi se ON s.id = se.scheda_id
             WHERE s.id = ? AND se.esercizio_id = ?`,
            [scheda_id, esercizio_id]
        );

        if (checkResult.length === 0) {
            return res
                .status(404)
                .json({ message: "Esercizio non trovato in questa scheda." });
        }

        const dati = checkResult[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questo esercizio.",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento non è in corso, impossibile modificare l'esercizio.",
            });
        }

        // Costruzione dinamica della query di aggiornamento
        const fields: string[] = [];
        const values: any[] = [];

        if (ripetizioni !== undefined) {
            fields.push("ripetizioni = ?");
            values.push(parseInt(ripetizioni));
        }
        if (serie !== undefined) {
            fields.push("serie = ?");
            values.push(parseInt(serie));
        }

        values.push(scheda_id, esercizio_id);

        const updateQuery = `
            UPDATE schedaesercizi
            SET ${fields.join(", ")}
            WHERE scheda_id = ? AND esercizio_id = ?;
        `;

        const [updateResult] = await pool.query<ResultSetHeader>(
            updateQuery,
            values
        );

        if (updateResult.affectedRows === 0) {
            return res.status(200).json({
                message:
                    "Nessuna modifica effettuata: i dati forniti sono identici a quelli esistenti.",
            });
        }

        return res
            .status(200)
            .json({ message: "Esercizio modificato con successo." });
    } catch (err) {
        console.error("Errore in handleUpdateExerciseFromTrainingCard:", err);
        const error = err as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante la modifica dell'esercizio: " +
                error.message,
        });
    }
};
