import { captureRejectionSymbol } from "events";
import pool from "../../database/connection";
import { Request, Response } from "express";
import { RowDataPacket, ResultSetHeader } from "mysql2";

// crea una scheda di allenamento
export const handleCreateTrainingCard = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const { nome, tipo_scheda } = req.body;
    let note = req.body.note;
    if (!note) {
        note = "";
    }
    if (
        !nome ||
        !tipo_scheda ||
        (tipo_scheda !== "Clinica" && tipo_scheda !== "Casa")
    ) {
        res.status(400).json({ message: "Parametri mancanti" }).send();
    } else {
        const [result] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id =? AND paziente_id =? AND in_corso=1;",
            [fisioterapistaId, paziente_id]
        );
        if (result.length === 0) {
            res.status(404)
                .json({ message: "Nessun trattamento trovato" })
                .send();
        } else {
            const [insert] = await pool.query<ResultSetHeader>(
                "INSERT INTO schedeallenamento (nome, tipo_scheda, note, trattamento_id) VALUES (?,?,?,?);",
                [nome, tipo_scheda, note, result[0].id]
            );
            if (insert.affectedRows === 0) {
                res.status(500)
                    .json({
                        message: "Errore durante la creazione della scheda",
                    })
                    .send();
            } else {
                res.status(200).json({ message: "Scheda creata" }).send();
            }
        }
    }
};
// get schede di allenamento
export const handleGetTrainingCards = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT id FROM trattamenti WHERE fisioterapista_id =? AND paziente_id =? AND in_corso=1;",
        [fisioterapistaId, paziente_id]
    );
    if (result.length === 0) {
        res.status(404).json({ message: "Nessun trattamento trovato" }).send();
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, tipo_scheda, note FROM schedeallenamento WHERE trattamento_id =?;",
            [result[0].id]
        );
        res.status(200).json(rows).send();
    }
};
// delete scheda di allenamento
export const handleDeleteTrainingCard = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id;",
        []
    );

    if (result.length === 0) {
        res.status(500)
            .json({ error: "errore nella cancella della scheda" })
            .send();
    } else {
        let dati = result.find((dato) => dato.scheda_id === scheda_id);
        if (!dati) {
            res.status(404)
                .json({ message: "Scheda non trovata o non esistente" })
                .send();
        } else {
            if (dati.fisioterapista_id !== fisioterapistaId) {
                res.status(403)
                    .json({
                        message:
                            "Non si dispone dei permessi per cancellare questa scheda",
                    })
                    .send();
            } else if (dati.in_corso === 0) {
                res.status(400)
                    .json({ message: "Il trattamento non è in corso" })
                    .send();
            } else {
                const [deleteScheda] = await pool.query<ResultSetHeader>(
                    "DELETE FROM schedeallenamento WHERE id =?;",
                    [scheda_id]
                );
                if (deleteScheda.affectedRows === 0) {
                    res.status(404)
                        .json({ message: "Errore nella cancellazione" })
                        .send();
                } else {
                    res.status(200)
                        .json({ message: "Scheda eliminata" })
                        .send();
                }
            }
        }
    }
};
// update scheda di allenamento
export const handleUpdateTrainingCard = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const paziente_id = req.params.id;
    const schedaId = parseInt(req.params.schedaId);
    const { nome, tipo_scheda, note } = req.body;
};
