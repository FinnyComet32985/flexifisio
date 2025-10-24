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
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        try {
            const [result] = await pool.query<ResultSetHeader>(
                "UPDATE fisioterapisti SET nome = ?, cognome = ?, email = ? WHERE id = ?;",
                [nome, cognome, email, fisioterapistaId]
            );

            if (result.affectedRows === 0) {
                res.status(500).json({ message: "Errore durante la modifica" });
            } else {
                res.status(200).json({ message: "Profilo modificato" });
            }
        } catch (error) {
            const err = error as Error;
            res.status(500).json({
                message: "Errore durante la modifica. " + err.message,
            });
        }
    }
};
