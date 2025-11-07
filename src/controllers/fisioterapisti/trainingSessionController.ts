import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// api per le sessioni di allenamento
export const handleGetTrainingSessions = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const { trainingCardId } = req.params;
        const fisioterapistaId = req.body.jwtPayload.id;

        if (isNaN(parseInt(trainingCardId))) {
            return res.status(400).json({ message: "ID scheda non valido." });
        }

        // Verifica che la scheda esista e che il fisioterapista abbia i permessi per accedervi
        const [checkResult] = await pool.query<RowDataPacket[]>(
            `SELECT s.id FROM schedeallenamento s
             JOIN trattamenti t ON s.trattamento_id = t.id
             WHERE s.id = ? AND t.fisioterapista_id = ?;`,
            [trainingCardId, fisioterapistaId]
        );

        if (checkResult.length === 0) {
            return res.status(404).json({
                message:
                    "Scheda di allenamento non trovata o accesso non consentito.",
            });
        }

        // Recupera tutte le sessioni per la scheda specificata
        const [sessions] = await pool.query<RowDataPacket[]>(
            "SELECT id, data_sessione FROM sessioniallenamento WHERE scheda_id = ? ORDER BY data_sessione DESC;",
            [trainingCardId]
        );

        if (sessions.length === 0) {
            // La scheda esiste ma non ha ancora sessioni registrate
            return res.status(204).send();
        }

        return res.status(200).json(sessions);
    } catch (error) {
        console.error("Errore in handleGetTrainingSessions:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero delle sessioni: " +
                err.message,
        });
    }
};

// api per la visualizzazione delle sessioni di allenamento
export const handleGetTrainingSession = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const { sessionId } = req.params;
        const fisioterapistaId = req.body.jwtPayload.id;

        if (isNaN(parseInt(sessionId))) {
            return res.status(400).json({ message: "ID sessione non valido." });
        }

        // Verifica che la sessione esista e che il fisioterapista abbia i permessi per accedervi
        const [sessionInfo] = await pool.query<RowDataPacket[]>(
            `SELECT ss.data_sessione, ss.sondaggio, ss.scheda_id
             FROM sessioniallenamento ss
             JOIN schedeallenamento sa ON ss.scheda_id = sa.id
             JOIN trattamenti t ON sa.trattamento_id = t.id
             WHERE ss.id = ? AND t.fisioterapista_id = ?;`,
            [sessionId, fisioterapistaId]
        );

        if (sessionInfo.length === 0) {
            return res.status(404).json({
                message: "Sessione non trovata o accesso non consentito.",
            });
        }

        // Recupera tutti gli esercizi della sessione con i dati effettivi e quelli assegnati
        const [esercizi] = await pool.query<RowDataPacket[]>(
            `SELECT 
                se.esercizio_id,
                e.nome AS nome_esercizio,
                se.ripetizioni_effettive,
                se.serie_effettive,
                se.note,
                sae.ripetizioni AS ripetizioni_assegnate,
                sae.serie AS serie_assegnate
            FROM sessioneesercizi se
            JOIN esercizi e ON se.esercizio_id = e.id
            JOIN schedaesercizi sae ON se.esercizio_id = sae.esercizio_id AND sae.scheda_id = ?
            WHERE se.sessione_id = ?;`,
            [sessionInfo[0].scheda_id, sessionId]
        );

        // Costruisce l'oggetto di risposta finale
        const response = {
            data_sessione: sessionInfo[0].data_sessione,
            sondaggio: sessionInfo[0].sondaggio,
            esercizi: esercizi,
        };

        return res.status(200).json(response);
    } catch (error) {
        console.error("Errore in handleGetTrainingSession:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero della sessione: " +
                err.message,
        });
    }
};

// recupera i dati per il grafico
export const handleGetGraphDataByPatient = async (
    req: Request,
    res: Response
) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const { pazienteId } = req.params;
        const fisioterapistaId = req.body.jwtPayload.id;

        if (isNaN(parseInt(pazienteId))) {
            return res.status(400).json({ message: "ID paziente non valido." });
        }

        // 1. Verifica che esista un trattamento (attivo o terminato) per il paziente e il fisioterapista
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, pazienteId]
        );

        if (trattamenti.length === 0) {
            return res.status(404).json({
                message: "Nessun trattamento trovato per questo paziente.",
            });
        }

        // Anche se il trattamento è terminato, permettiamo di visualizzare i dati storici.

        const trattamentoId = trattamenti[0].id;

        // 2. Recupera tutte le schede di allenamento per il trattamento
        const [schede] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome FROM schedeallenamento WHERE trattamento_id = ?;",
            [trattamentoId]
        );

        if (schede.length === 0) {
            // Nessuna scheda, quindi nessun dato da mostrare
            return res.status(204).send();
        }

        // 3. Per ogni scheda, recupera le relative sessioni
        const result = [];
        for (const scheda of schede) {
            const [sessioni] = await pool.query<RowDataPacket[]>(
                "SELECT id, data_sessione, sondaggio FROM sessioniallenamento WHERE scheda_id = ?;",
                [scheda.id]
            );

            result.push({
                id_scheda: scheda.id,
                nome_scheda: scheda.nome,
                sessioni: sessioni,
            });
        }

        return res.status(200).json(result);
    } catch (error) {
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero dei dati per i grafici: " +
                err.message,
        });
    }
};
