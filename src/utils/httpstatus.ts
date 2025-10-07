type HttpStatusEntry = {
    code: number;
    status: string;
};

const HttpStatus = {
    // 2xx Risposte di Successo - L'azione è stata ricevuta, compresa e accettata con successo.
    OK: { code: 200, status: 'OK' }, // Risposta standard per le richieste HTTP riuscite.
    CREATED: { code: 201, status: 'CREATED' }, // La richiesta è stata soddisfatta e una nuova risorsa è stata creata come risultato (tipicamente dopo una richiesta POST).
    ACCEPTED: { code: 202, status: 'ACCEPTED' }, // La richiesta è stata accettata per l'elaborazione, ma l'elaborazione non è ancora completa (è asincrona).
    NO_CONTENT: { code: 204, status: 'NO_CONTENT' }, // Il server ha elaborato la richiesta con successo ma non sta restituendo alcun contenuto (es. per un'operazione DELETE o PUT andata a buon fine).

    // 4xx Risposte di Errore del Cliente - Il client sembra aver commesso un errore.
    BAD_REQUEST: { code: 400, status: 'BAD_REQUEST' }, // Il server non può o non vuole elaborare la richiesta a causa di un errore apparente del client (es. sintassi della richiesta malformata).
    UNAUTHORIZED: { code: 401, status: 'UNAUTHORIZED' }, // L'autenticazione è richiesta e non è stata fornita o è fallita. L'utente deve effettuare il login.
    FORBIDDEN: { code: 403, status: 'ACCESS_FORBIDDEN' }, // Il client non ha i diritti di accesso al contenuto; a differenza di 401, l'autenticazione non cambierebbe nulla (mancano i permessi).
    NOT_FOUND: { code: 404, status: 'NOT_FOUND' }, // Il server non è riuscito a trovare la risorsa richiesta (l'URI non è riconosciuto).
    METHOD_NOT_ALLOWED: { code: 405, status: 'METHOD_NOT_ALLOWED' }, // Il metodo di richiesta (es. POST, GET, PUT) non è supportato per la risorsa richiesta.
    CONFLICT: { code: 409, status: 'CONFLICT' }, // La richiesta non può essere completata a causa di un conflitto con lo stato attuale della risorsa (es. si cerca di creare un utente già esistente).
    UNPROCESSABLE_ENTITY: { code: 422, status: 'UNPROCESSABLE_ENTITY' }, // Il server ha compreso la richiesta, ma non è in grado di elaborare le istruzioni in essa contenute (spesso usato per errori di validazione semantica).

    // 5xx Risposte di Errore del Server - Il server non è riuscito a soddisfare una richiesta.
    INTERNAL_SERVER_ERROR: { code: 500, status: 'INTERNAL_SERVER_ERRROR' }, // Un messaggio di errore generico, dato quando il server ha incontrato una condizione imprevista.
    NOT_IMPLEMENTED: { code: 501, status: 'NOT_IMPLEMENTED' }, // Il server non supporta la funzionalità richiesta per soddisfare la richiesta (es. un metodo che il server non implementa).
    BAD_GATEWAY: { code: 502, status: 'BAD_GATEWAY' }, // Il server, agendo come gateway o proxy, ha ricevuto una risposta non valida dal server a monte.
    SERVICE_UNAVAILABLE: { code: 503, status: 'SERVICE_UNAVAILABLE' }, // Il server non è pronto per gestire la richiesta (es. in manutenzione o sovraccarico).
    GATEWAY_TIMEOUT: { code: 504, status: 'GATEWAY_TIMEOUT' } // Il server, agendo come gateway o proxy, non ha ricevuto una risposta tempestiva dal server a monte.
} as const;

export type HttpStatusType = typeof HttpStatus;
export type HttpStatusKey = keyof HttpStatusType;
export type HttpStatusValue = HttpStatusEntry;

export default HttpStatus;