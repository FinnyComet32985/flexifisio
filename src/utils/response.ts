class Response<T = any> {
    timeStamp: string;
    statusCode: number;
    httpStatus: string;
    message: string;
    data?: T;

    constructor(
        statusCode: number,
        httpStatus: string,
        message: string,
        data?: T
    ) {
        this.timeStamp = new Date().toLocaleString();
        this.statusCode = statusCode;
        this.httpStatus = httpStatus;
        this.message = message;
        this.data = data;
    }
}

export default Response;

/*
Questo file serve per fare delle risposte preimpostate a livello strutturale
Esempio:

import HttpStatus from "utils/httpstatus";
import ResponseModel from "utils/response";

res.status(HttpStatus.CREATED.code).json(
    new ResponseModel(HttpStatus.CREATED.code, HttpStatus.CREATED.status, 'Paziente created successfully')
);

res.status(HttpStatus.OK.code).json(
    new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, 'Lista prenotazioni prese con successo', { pazienti: results })
);

res.status(HttpStatus.OK.code).json(
    new ResponseModel(HttpStatus.OK.code, HttpStatus.OK.status, 'Azione eseguita con successo') <- esempio senza dati
);

res.status(HttpStatus.UNAUTHORIZED.code).json(
    new ResponseModel(HttpStatus.UNAUTHORIZED.code, HttpStatus.UNAUTHORIZED.status, 'Token non valido non sei autorizzato')
);

res.status("Codice di risposta che utilizzerà il frontend").json(
    new ResponseModel(
        "Codice da far apparire nel json di risposta",
        "Messaggio di codice",
        "Messaggio personalizzato",
        "Dati che possono servire in generale. non obbligatorio"
    )
);

risultato: 
{
    timestamp:
}
*/