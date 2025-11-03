import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// visualizza chat
// visualizza chat
export const handleGetChat = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;

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
            return res
                .status(404)
                .json({ message: "Nessun paziente con messaggi" });
        }

        return res.status(200).json(rows);
    }

    const [trattamento] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
        [fisioterapistaId, paziente_id]
    );

    if (trattamento.length === 0) {
        return res.status(404).json({ message: "Nessun trattamento trovato" });
    }

    const trattamentoId = trattamento[0].id;

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT id, testo, data_invio, mittente FROM messaggi WHERE trattamento_id = ? ORDER BY data_invio ASC;",
        [trattamentoId]
    );

    if (rows.length === 0) {
        return res.status(404).json({ message: "Nessun messaggio trovato" });
    }

    return res.status(200).json(rows);
};

// invia messaggio
export const handleSendMessage = async (req: Request, res: Response) => {
    if (!req.body.jwtPayload) {
        return res.status(401).json({ message: "Autenticazione richiesta." });
    }
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const testo = req.body.testo;
    if (!testo) {
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        const [trattamento] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id = ? AND paziente_id = ? AND in_corso = 1;",
            [fisioterapistaId, paziente_id]
        );

        if (trattamento.length === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else {
            const [result] = await pool.query<ResultSetHeader>(
                "INSERT INTO messaggi (trattamento_id, testo, mittente, data_invio) VALUES (?,?,?,?);",
                [trattamento[0].id, testo, "fisioterapista", new Date()]
            );
            if (result.affectedRows === 0) {
                res.status(500).json({ message: "Errore durante l'invio" });
            } else {
                res.status(200).json({ message: "Messaggio inviato" });
            }
        }
    }
};
