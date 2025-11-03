import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// api per dati sondaggi
// api per i dati della sessione
export const handleGetTrainingSessions = async (
    req: Request,
    res: Response
) => {
    const { trainingCardId } = req.params;
    const fisioterapistaId = req.body.jwtPayload.id;

    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT trattamento_id from schedeallenamento where id=?;",
            [trainingCardId]
        );

        if (rows.length === 0) {
            return res
                .status(404)
                .json({ message: "Nessuna scheda di allenamento trovata" });
        } else {
            const [trattamento] = await pool.query<RowDataPacket[]>(
                "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND id = ? AND in_corso = 1;",
                [fisioterapistaId, rows[0].trattamento_id]
            );

            if (trattamento.length === 0) {
                return res
                    .status(404)
                    .json({ message: "Nessun trattamento trovato" });
            }

            const [sessions] = await pool.query<RowDataPacket[]>(
                "SELECT id, data_sessione FROM sessioniallenamento WHERE scheda_id = ?;",
                [trainingCardId]
            );

            return res.status(200).json(sessions);
        }
    } catch (error) {
        const err = error as Error;
        return res.status(500).json({ message: err.message });
    }
};

export const handleGetTrainingSession = async (req: Request, res: Response) => {
    const { sessionId } = req.params;
    const fisioterapistaId = req.body.jwtPayload.id;

    try {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT tt.id FROM sessioniallenamento ss JOIN schedeallenamento sa ON ss.scheda_id=sa.id JOIN trattamenti tt ON sa.trattamento_id=tt.id WHERE ss.id=? AND tt.fisioterapista_id = ? AND tt.in_corso = 1;",
            [sessionId, fisioterapistaId]
        );

        if (trattamento.length === 0) {
            return res
                .status(404)
                .json({ message: "Nessun trattamento trovato" });
        } else {
            // 1. Recupera i dati principali della sessione (data e sondaggio)
            const [sessionInfo] = await pool.query<RowDataPacket[]>(
                "SELECT data_sessione, sondaggio, scheda_id FROM sessioniallenamento WHERE id = ?;",
                [sessionId]
            );

            if (sessionInfo.length === 0) {
                return res
                    .status(404)
                    .json({ message: "Sessione non trovata" });
            }

            // 2. Recupera tutti gli esercizi della sessione con i dati effettivi e quelli assegnati
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

            // 3. Costruisci l'oggetto di risposta finale
            const response = {
                data_sessione: sessionInfo[0].data_sessione,
                sondaggio: sessionInfo[0].sondaggio,
                esercizi: esercizi,
            };

            return res.status(200).json(response);
        }
    } catch (error) {
        const err = error as Error;
        return res.status(500).json({ message: err.message });
    }
};

export const handleGetGraphDataByPatient = async (
    req: Request,
    res: Response
) => {
    const { pazienteId } = req.params;
    const fisioterapistaId = req.body.jwtPayload.id;

    try {
        // 1. Verify access to the patient's treatment
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND id = ? AND in_corso = 1;",
            [fisioterapistaId, pazienteId]
        );

        if (trattamento.length === 0) {
            return res
                .status(403)
                .json({ message: "Accesso non consentito a questo paziente." });
        }

        const trattamentoId = trattamento[0].id;

        // 2. Get all training cards for the treatment
        const [schede] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome FROM schedeallenamento WHERE trattamento_id = ?;",
            [trattamentoId]
        );

        if (schede.length === 0) {
            return res.status(200).json([]); // No cards, return empty array
        }

        // 3. For each card, get its sessions
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
        return res.status(500).json({ message: err.message });
    }
};

/*
SESSIONIALLENAMENTO
data_sessione, 
sondaggio


SESSIONEESERCIZI
ripetizioni_effettive, 
serie_effettive, 
note
ssE.sessione_id -> ssA.id

SCHEDEALLENAMENTO
nome as nome_scheda
ssA.scheda_id -> sa.id

SCHEDAESERCIZI
esercizio_id
ripetizioni
serie
ssA.scheda_id -> se.scheda_id

ESERCIZI
nome
se.esercizio_id -> esercizi.id



*/
