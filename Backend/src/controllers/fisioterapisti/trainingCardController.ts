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
    const scheda_id = parseInt(req.params.id);
    const { nome, tipo_scheda, note } = req.body;

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id;",
        []
    );
    if (result.length === 0) {
        res.status(500)
            .json({ error: "errore nella modifica della scheda" })
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
                    "UPDATE schedeallenamento SET nome =?, tipo_scheda =?, note =? WHERE id =?;",
                    [nome, tipo_scheda, note, scheda_id]
                );
                if (deleteScheda.affectedRows === 0) {
                    res.status(404)
                        .json({ message: "Errore nella modifica" })
                        .send();
                } else {
                    res.status(200)
                        .json({ message: "Scheda modificata" })
                        .send();
                }
            }
        }
    }
};

// aggiungi esercizio
export const handleAddExerciseToTrainingCard = async (
    req: Request,
    res: Response
) => {
    const fisioterapistaId = req.body.jwtPayload.id;
    const scheda_id = parseInt(req.params.id);
    const { esercizio_id, ripetizioni } = req.body;

    const [result] = await pool.query<RowDataPacket[]>(
        "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id;",
        []
    );
    if (result.length === 0) {
        res.status(500)
            .json({ error: "Errore durante l'aggiunta dell'esercizio" })
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
                            "Non si dispone dei permessi per aggiungere un esercizio a questa scheda",
                    })
                    .send();
            } else if (dati.in_corso === 0) {
                res.status(400)
                    .json({ message: "Il trattamento non è in corso" })
                    .send();
            } else {
                const [checkEsercizio] = await pool.query<RowDataPacket[]>(
                    "SELECT * FROM esercizi WHERE id =? AND fisioterapista_id=?;",
                    [esercizio_id, fisioterapistaId]
                );
                if (checkEsercizio.length === 0) {
                    res.status(404)
                        .json({
                            message: "Esercizio non trovato o non esistente",
                        })
                        .send();
                } else {
                    const [addEsercizio] = await pool.query<ResultSetHeader>(
                        "INSERT INTO schedaesercizi (scheda_id, esercizio_id, ripetizioni) VALUES (?, ?, ?);",
                        [scheda_id, esercizio_id, ripetizioni]
                    );
                    if (addEsercizio.affectedRows === 0) {
                        res.status(404)
                            .json({
                                message:
                                    "Errore durante l'aggiunta dell'esercizio",
                            })
                            .send();
                    } else {
                        res.status(200)
                            .json({
                                message: "Esercizio aggiunto con successo",
                            })
                            .send();
                    }
                }
            }
        }
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
        res.status(500)
            .json({ error: "Errore durante l'eliminazione dell'esercizio" })
            .send();
    } else {
        let dati = result.filter((dato) => dato.scheda_id === scheda_id);
        if (!dati) {
            res.status(404)
                .json({ message: "Scheda non trovata o non esistente" })
                .send();
        } else {
            const dato = dati.find(
                (dato) => dato.esercizio_id === esercizio_id
            );
            if (dato === undefined) {
                res.status(404)
                    .json({ message: "Esercizio non presente nella scheda" })
                    .send();
            } else {
                if (dato.fisioterapista_id !== fisioterapistaId) {
                    res.status(403)
                        .json({
                            message:
                                "Non si dispone dei permessi per aggiungere un esercizio a questa scheda",
                        })
                        .send();
                } else if (dato.in_corso === 0) {
                    res.status(400)
                        .json({ message: "Il trattamento non è in corso" })
                        .send();
                } else {
                    const [deleteExercise] = await pool.query<ResultSetHeader>(
                        "DELETE FROM schedaesercizi WHERE scheda_id=? AND esercizio_id=?;",
                        [scheda_id, esercizio_id]
                    );
                    if (deleteExercise.affectedRows === 0) {
                        res.status(404)
                            .json({
                                message:
                                    "Errore durante la rimozione dell'esercizio",
                            })
                            .send();
                    } else {
                        res.status(200)
                            .json({
                                message: "Esercizio rimosso con successo",
                            })
                            .send();
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
    const ripetizioni = parseInt(req.body.ripetizioni);
    if (isNaN(esercizio_id) || isNaN(ripetizioni) || isNaN(scheda_id)) {
        res.status(400)
            .json({ message: "I dati forniti non sono validi" })
            .send();
    } else {
        const [result] = await pool.query<RowDataPacket[]>(
            "SELECT trattamenti.id as trattamenti_id, trattamenti.fisioterapista_id as fisioterapista_id, trattamenti.in_corso as in_corso, schedeallenamento.id as scheda_id, schedaesercizi.esercizio_id FROM trattamenti JOIN schedeallenamento ON trattamenti.id=schedeallenamento.trattamento_id JOIN schedaesercizi ON schedeallenamento.id=schedaesercizi.scheda_id;",
            []
        );
        if (result.length === 0) {
            res.status(500)
                .json({ error: "Errore durante la modifica dell'esercizio" })
                .send();
        } else {
            let dati = result.filter((dato) => dato.scheda_id === scheda_id);
            if (!dati) {
                res.status(404)
                    .json({ message: "Scheda non trovata o non esistente" })
                    .send();
            } else {
                const dato = dati.find(
                    (dato) => dato.esercizio_id === esercizio_id
                );
                if (dato === undefined) {
                    res.status(404)
                        .json({
                            message: "Esercizio non presente nella scheda",
                        })
                        .send();
                } else {
                    if (dato.fisioterapista_id !== fisioterapistaId) {
                        res.status(403)
                            .json({
                                message:
                                    "Non si dispone dei permessi per aggiungere un esercizio a questa scheda",
                            })
                            .send();
                    } else if (dato.in_corso === 0) {
                        res.status(400)
                            .json({ message: "Il trattamento non è in corso" })
                            .send();
                    } else {
                        const [updateExercise] =
                            await pool.query<ResultSetHeader>(
                                "UPDATE schedaesercizi SET ripetizioni=? WHERE scheda_id=? AND esercizio_id=?;",
                                [ripetizioni, scheda_id, esercizio_id]
                            );
                        if (updateExercise.affectedRows === 0) {
                            res.status(404)
                                .json({
                                    message:
                                        "Errore durante la modifica dell'esercizio",
                                })
                                .send();
                        } else {
                            res.status(200)
                                .json({
                                    message:
                                        "Esercizio modificato con successo",
                                })
                                .send();
                        }
                    }
                }
            }
        }
    }
};
