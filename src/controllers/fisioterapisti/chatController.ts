import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// get chat
export const handleGetChat = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;

        // Caso 1: Recupera l'elenco delle chat attive con l'ultimo messaggio per il fisioterapista
        if (paziente_id === undefined) {
            const [rows] = await pool.query<RowDataPacket[]>(
                `SELECT 
                p.id,
                p.nome,
                p.cognome,
                m.testo AS ultimo_testo,
                m.data_invio AS ultima_data_invio,
                m.mittente AS ultimo_mittente
                FROM Pazienti p
                JOIN trattamenti t ON p.id = t.paziente_id
                LEFT JOIN messaggi m ON m.id = (
                    SELECT id 
                    FROM messaggi 
                    WHERE trattamento_id = t.id 
                    ORDER BY data_invio DESC 
                    LIMIT 1
                )
                WHERE 
                    t.fisioterapista_id = ? 
                    AND t.in_corso = 1
                    AND m.data_invio IS NOT NULL
                ORDER BY ultima_data_invio DESC`,
                [fisioterapistaId]
            );

            if (rows.length === 0) {
                // Nessun paziente con messaggi, ma la richiesta è valida (lista vuota)
                return res
                    .status(204)
                    .json({ message: "Nessun paziente con messaggi trovato." });
            }

            return res.status(200).json(rows);
        }
        // Caso 2: Recupera la cronologia della chat per un paziente specifico
        else {
            // Verifica che esista un trattamento in corso tra il fisioterapista e il paziente
            const [trattamenti] = await pool.query<RowDataPacket[]>(
                "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
                [fisioterapistaId, paziente_id]
            );

            if (trattamenti.length === 0) {
                // Se non esiste alcun trattamento (né attivo né terminato)
                return res.status(404).json({
                    message: "Nessun trattamento trovato per questo paziente.",
                });
            }

            if (trattamenti[0].in_corso === 0) {
                return res.status(403).json({
                    message:
                        "Il trattamento per questo paziente è terminato, impossibile accedere alla chat.",
                });
            }

            const trattamentoId = trattamenti[0].id;

            // Recupera tutti i messaggi per il trattamento specifico
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id, testo, data_invio, mittente FROM messaggi WHERE trattamento_id = ? ORDER BY data_invio ASC;",
                [trattamentoId]
            );

            if (rows.length === 0) {
                // Nessun messaggio trovato per la chat, ma la chat esiste (lista vuota)
                return res.status(204).json({
                    message: "Nessun messaggio trovato per questa chat.",
                });
            }

            return res.status(200).json(rows);
        }
    } catch (error) {
        console.error("Errore in handleGetChat:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante il recupero della chat: " +
                err.message,
        });
    }
};

// send messagge
export const handleSendMessage = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }

    try {
        const fisioterapistaId = req.body.jwtPayload.id;
        const paziente_id = req.params.id;
        const testo = req.body.testo;

        // Validazione del parametro 'testo'
        if (!testo) {
            return res.status(400).json({
                message:
                    "Parametri mancanti: il testo del messaggio è obbligatorio.",
            });
        }

        // Verifica che esista un trattamento in corso tra il fisioterapista e il paziente
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT id, in_corso FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ?;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamenti.length === 0) {
            // Se non esiste alcun trattamento (né attivo né terminato)
            return res.status(404).json({
                message: "Nessun trattamento trovato per questo paziente.",
            });
        }

        if (trattamenti[0].in_corso === 0) {
            return res.status(403).json({
                message:
                    "Il trattamento per questo paziente è terminato, impossibile inviare messaggi.",
            });
        }

        // Inserisce il messaggio nel database
        const [result] = await pool.query<ResultSetHeader>(
            "INSERT INTO messaggi (trattamento_id, testo, mittente, data_invio) VALUES (?,?,?,?);",
            [trattamenti[0].id, testo, "fisioterapista", new Date()]
        );

        // Verifica se l'inserimento ha avuto successo
        if (result.affectedRows === 0) {
            return res.status(500).json({
                message:
                    "Errore interno del server: impossibile inviare il messaggio.",
            });
        }

        return res
            .status(200)
            .json({ message: "Messaggio inviato con successo." });
    } catch (error) {
        console.error("Errore in handleSendMessage:", error);
        const err = error as Error;
        return res.status(500).json({
            message:
                "Errore interno del server durante l'invio del messaggio: " +
                err.message,
        });
    }
};
