import pool from "database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// visualizza chat
export const handleGetChat = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    if (paziente_id === undefined) {
        const [trattamenti] = await pool.query<RowDataPacket[]>(
            "SELECT trattamento_id FROM messaggi WHERE trattamento_id IN (SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND in_corso = 1);",
            [fisioterapistaId]
        );
        if (trattamenti.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const trattamentoIds = trattamenti.map(
                (trattamento) => trattamento.trattamento_id
            );
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT pazienti.id, pazienti.nome, pazienti.cognome FROM Pazienti JOIN trattamenti ON pazienti.id = trattamenti.paziente_id WHERE trattamenti.id IN (?)",
                [trattamentoIds]
            );
            if (rows.length === 0) {
                res.status(404)
                    .json({ message: "Nessun trattamento trovato" })
                    .send();
            } else {
                res.status(200).json(rows).send();
            }
        }
    } else {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamento.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const trattamentoId = trattamento[0].id;
            const [rows] = await pool.query<RowDataPacket[]>(
                "SELECT id, testo, data_invio, mittente FROM messaggi WHERE trattamento_id = ?;",
                [trattamentoId]
            );
            if (rows.length === 0) {
                res.status(404)
                    .json({ message: "Nessun messaggio trovato" })
                    .send();
            } else {
                res.status(200).json(rows).send();
            }
        }
    }
};
// invia messaggio
export const handleSendMessage = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const testo = req.body.testo;
    if (!testo) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamento.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const [result] = await pool.query<ResultSetHeader>(
                "INSERT INTO messaggi (trattamento_id, testo, mittente, data_invio) VALUES (?,?,?,?);",
                [trattamento[0].id, testo, "fisioterapista", new Date()]
            );
            if (result.affectedRows === 0) {
                res.status(500)
                    .json({ message: "Errore durante l'invio" })
                    .send();
            } else {
                res.status(200).json({ message: "Messaggio inviato" }).send();
            }
        }
    }
};
