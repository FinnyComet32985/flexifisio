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
        res.status(400).json({ message: "Parametri mancanti" });
    } else {
        const [result] = await pool.query<RowDataPacket[]>(
            "SELECT id FROM trattamenti WHERE fisioterapista_id =? AND paziente_id =? AND in_corso=1;",
            [fisioterapistaId, paziente_id]
        );
        if (result.length === 0) {
            res.status(404).json({ message: "Nessun trattamento trovato" });
        } else {
            const [insert] = await pool.query<ResultSetHeader>(
                "INSERT INTO schedeallenamento (nome, tipo_scheda, note, trattamento_id) VALUES (?,?,?,?);",
                [nome, tipo_scheda, note, result[0].id]
            );
            if (insert.affectedRows === 0) {
                res.status(500).json({
                    message: "Errore durante la creazione della scheda",
                });
            } else {
                res.status(200).json({ message: "Scheda creata" });
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
        res.status(404).json({ message: "Nessun trattamento trovato" });
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT id, nome, tipo_scheda, note FROM schedeallenamento WHERE trattamento_id =?;",
            [result[0].id]
        );
        res.status(200).json(rows);
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
        res.status(500).json({ error: "errore nella cancella della scheda" });
    } else {
        let dati = result.find((dato) => dato.scheda_id === scheda_id);
        if (!dati) {
            res.status(404).json({
                message: "Scheda non trovata o non esistente",
            });
        } else {
            if (dati.fisioterapista_id !== fisioterapistaId) {
                res.status(403).json({
                    message:
                        "Non si dispone dei permessi per cancellare questa scheda",
                });
            } else if (dati.in_corso === 0) {
                res.status(400).json({
                    message: "Il trattamento non è in corso",
                });
            } else {
                const [deleteScheda] = await pool.query<ResultSetHeader>(
                    "DELETE FROM schedeallenamento WHERE id =?;",
                    [scheda_id]
                );
                if (deleteScheda.affectedRows === 0) {
                    res.status(404).json({
                        message: "Errore nella cancellazione",
                    });
                } else {
                    res.status(200).json({ message: "Scheda eliminata" });
                }
            }
        }
    }
};
// update scheda di allenamento
export const handleUpdateTrainingCard = async (req: Request, res: Response) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);
    const { nome, tipo_scheda, note } = req.body;

    // Controllo parametri: serve almeno un campo
    if (nome === undefined && tipo_scheda === undefined && note === undefined) {
        return res
            .status(400)
            .json({ message: "Nessun parametro da modificare" });
    }

    try {
        // Verifico che la scheda esista, sia collegata al trattamento del fisioterapista e in corso
        const [result] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             WHERE s.id = ?`,
            [scheda_id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                message: "Scheda non trovata",
            });
        }

        const dati = result[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questa scheda",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(400).json({
                message: "Il trattamento non è in corso",
            });
        }

        // Query dinamica per l’update
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
            return res
                .status(500)
                .json({ message: "Errore durante l'aggiornamento" });
        }

        return res.status(200).json({ message: "Scheda modificata" });
    } catch (err) {
        const error = err as Error;
        return res.status(500).json({
            message: "Errore durante la modifica: " + error.message,
        });
    }
};

// aggiungi esercizio
export const handleAddExerciseToTrainingCard = async (
    req: Request,
    res: Response
) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);
    const { esercizio_id, ripetizioni, serie } = req.body;

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id;",
        []
    );
    if (result.length === 0) {
        res.status(500).json({
            error: "Errore durante l'aggiunta dell'esercizio",
        });
    } else {
        let dati = result.find((dato) => dato.scheda_id === scheda_id);
        if (!dati) {
            res.status(404).json({
                message: "Scheda non trovata o non esistente",
            });
        } else {
            if (dati.fisioterapista_id !== fisioterapistaId) {
                res.status(403).json({
                    message:
                        "Non si dispone dei permessi per aggiungere un esercizio a questa scheda",
                });
            } else if (dati.in_corso === 0) {
                res.status(400).json({
                    message: "Il trattamento non è in corso",
                });
            } else {
                const [checkEsercizio] = await pool.query<RowDataPacket[]>(
                    "SELECT * FROM esercizi WHERE id =? AND fisioterapista_id=?;",
                    [esercizio_id, fisioterapistaId]
                );
                if (checkEsercizio.length === 0) {
                    res.status(404).json({
                        message: "Esercizio non trovato o non esistente",
                    });
                } else {
                    const [addEsercizio] = await pool.query<ResultSetHeader>(
                        "INSERT INTO schedaesercizi (scheda_id, esercizio_id, ripetizioni, serie) VALUES (?, ?, ?, ?);",
                        [scheda_id, esercizio_id, ripetizioni, serie]
                    );
                    if (addEsercizio.affectedRows === 0) {
                        res.status(404).json({
                            message: "Errore durante l'aggiunta dell'esercizio",
                        });
                    } else {
                        res.status(200).json({
                            message: "Esercizio aggiunto con successo",
                        });
                    }
                }
            }
        }
    }
};

export const handleGetExercisesFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);

    const [trattamenti_id] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id FROM trattamenti JOIN schedeallenamento ON schedeallenamento.trattamento_id=trattamenti.id WHERE trattamenti.fisioterapista_id=? AND trattamenti.in_corso=1 AND schedeallenamento.id=?;",
        [fisioterapistaId, scheda_id]
    );

    if (trattamenti_id.length === 0) {
        res.status(404).json({ message: "Nessun trattamento trovato" });
    } else {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT esercizi.nome, esercizi.descrizione, esercizi.descrizione_svolgimento, esercizi.consigli_svolgimento, esercizi.immagine, esercizi.video, schedaesercizi.ripetizioni, schedaesercizi.serie FROM esercizi JOIN schedaesercizi ON esercizi.id=schedaesercizi.esercizio_id WHERE schedaesercizi.scheda_id=?;",
            [scheda_id]
        );
        if (rows.length === 0) {
            res.status(404).json({ message: "Nessun esercizio trovato" });
        }
        res.status(200).json(rows);
    }
};
// elimina esercizio
export const handleDeleteExerciseFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);
    const esercizio_id = parseInt(req.params.exerciseId);

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id, schedaesercizi.esercizio_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id JOIN schedaesercizi ON schedeallenamento.id=schedaesercizi.scheda_id;",
        []
    );
    if (result.length === 0) {
        res.status(500).json({
            error: "Errore durante l'eliminazione dell'esercizio",
        });
    } else {
        let dati = result.filter((dato) => dato.scheda_id === scheda_id);
        if (!dati) {
            res.status(404).json({
                message: "Scheda non trovata o non esistente",
            });
        } else {
            const dato = dati.find(
                (dato) => dato.esercizio_id === esercizio_id
            );
            if (dato === undefined) {
                res.status(404).json({
                    message: "Esercizio non presente nella scheda",
                });
            } else {
                if (dato.fisioterapista_id !== fisioterapistaId) {
                    res.status(403).json({
                        message:
                            "Non si dispone dei permessi per aggiungere un esercizio a questa scheda",
                    });
                } else if (dato.in_corso === 0) {
                    res.status(400).json({
                        message: "Il trattamento non è in corso",
                    });
                } else {
                    const [deleteExercise] = await pool.query<ResultSetHeader>(
                        "DELETE FROM schedaesercizi WHERE scheda_id=? AND esercizio_id=?;",
                        [scheda_id, esercizio_id]
                    );
                    if (deleteExercise.affectedRows === 0) {
                        res.status(404).json({
                            message:
                                "Errore durante la rimozione dell'esercizio",
                        });
                    } else {
                        res.status(200).json({
                            message: "Esercizio rimosso con successo",
                        });
                    }
                }
            }
        }
    }
};
// modifica esercizio
export const handleUpdateExerciseFromTrainingCard = async (
    req: Request,
    res: Response
) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);
    const esercizio_id = parseInt(req.body.esercizio_id);

    const ripetizioni =
        req.body.ripetizioni !== undefined
            ? parseInt(req.body.ripetizioni)
            : undefined;
    const serie =
        req.body.serie !== undefined ? parseInt(req.body.serie) : undefined;

    // Serve almeno un campo da aggiornare
    if (ripetizioni === undefined && serie === undefined) {
        return res
            .status(400)
            .json({ message: "Nessun parametro da modificare" });
    }

    if (isNaN(esercizio_id) || isNaN(scheda_id)) {
        return res
            .status(400)
            .json({ message: "I dati forniti non sono validi" });
    }

    try {
        // Verifica esistenza e permesso
        const [result] = await pool.query<RowDataPacket[]>(
            `SELECT t.fisioterapista_id, t.in_corso
             FROM trattamenti t
             JOIN schedeallenamento s ON t.id = s.trattamento_id
             JOIN schedaesercizi se ON s.id = se.scheda_id
             WHERE s.id = ? AND se.esercizio_id = ?`,
            [scheda_id, esercizio_id]
        );

        if (result.length === 0) {
            return res.status(404).json({
                message: "Esercizio non presente in questa scheda",
            });
        }

        const dati = result[0];

        if (dati.fisioterapista_id !== fisioterapistaId) {
            return res.status(403).json({
                message:
                    "Non si dispone dei permessi per modificare questo esercizio",
            });
        }

        if (dati.in_corso === 0) {
            return res.status(400).json({
                message: "Il trattamento non è in corso",
            });
        }

        // Costruzione query dinamica
        const fields: string[] = [];
        const values: any[] = [];

        if (ripetizioni !== undefined) {
            fields.push("ripetizioni = ?");
            values.push(ripetizioni);
        }
        if (serie !== undefined) {
            fields.push("serie = ?");
            values.push(serie);
        }

        values.push(scheda_id, esercizio_id);

        const updateQuery = `
            UPDATE schedaesercizi
            SET ${fields.join(", ")}
            WHERE scheda_id = ? AND esercizio_id = ?;
        `;

        const [updateExercise] = await pool.query<ResultSetHeader>(
            updateQuery,
            values
        );

        if (updateExercise.affectedRows === 0) {
            return res.status(500).json({
                message: "Errore durante la modifica dell'esercizio",
            });
        }

        return res.status(200).json({
            message: "Esercizio modificato con successo",
        });
    } catch (err) {
        const error = err as Error;
        return res.status(500).json({
            message: "Errore durante la modifica. " + error.message,
        });
    }
};
