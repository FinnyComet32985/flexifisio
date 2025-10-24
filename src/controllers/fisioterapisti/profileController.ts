import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export const handleGetProfile = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;

    const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT nome, cognome, email FROM fisioterapisti WHERE id = ?;",
        [fisioterapistaId]
    );

    if (rows.length === 0) {
        res.status(404).json({ message: "Fisioterapista non trovato" });
    } else {
        res.status(200).json(rows[0]);
    }
};

export const handleUpdateProfile = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const { nome, cognome, email } = req.body;

    if (!nome && !cognome && !email) {
        return res
            .status(400)
            .json({ message: "Nessun parametro da modificare" });
    }

    try {
        const fields: string[] = [];
        const values: any[] = [];

        if (nome) {
            fields.push("nome = ?");
            values.push(nome);
        }
        if (cognome) {
            fields.push("cognome = ?");
            values.push(cognome);
        }
        if (email) {
            fields.push("email = ?");
            values.push(email);
        }

        // Aggiungiamo id per la clausola WHERE
        values.push(fisioterapistaId);

        const query = `
        UPDATE fisioterapisti
        SET ${fields.join(", ")}
        WHERE id = ?;
    `;

        const [result] = await pool.query<ResultSetHeader>(query, values);

        if (result.affectedRows === 0) {
            return res
                .status(404)
                .json({ message: "Fisioterapista non trovato" });
        }

        res.status(200).json({ message: "Profilo modificato" });
    } catch (error) {
        const err = error as Error;
        res.status(500).json({
            message: "Errore durante la modifica. " + err.message,
        });
    }
};
