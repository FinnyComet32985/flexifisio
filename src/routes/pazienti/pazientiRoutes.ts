import { Router } from "express";

// Controllers
import * as authController from "../../controllers/pazienti/authController";
import * as profileController from "../../controllers/pazienti/profileController";
import * as trattamentiController from "../../controllers/pazienti/trattamentiController";
import * as appuntamentiController from "../../controllers/pazienti/appuntamentiController";
import * as messaggiController from "../../controllers/pazienti/messaggiController";
import * as schedeController from "../../controllers/pazienti/schedeController";
import * as sessioniController from "../../controllers/pazienti/sessioniController";

// Middleware
import { pazientiAuth } from "../../middleware/pazientiAuth";

export const pazientiRouter = Router();

/* =======================================================
   AUTH ROUTES (PUBBLICHE)
   ======================================================= */
pazientiRouter.post("/auth/check-email", authController.registerEmail);
pazientiRouter.post("/auth/register", authController.register);
pazientiRouter.post("/auth/login", authController.login);
pazientiRouter.post("/auth/refreshToken", authController.refreshToken);
pazientiRouter.post("/auth/logout", authController.logout);

/* =======================================================
   PROFILO (PROTETTO)
   ======================================================= */
pazientiRouter.get("/profile", pazientiAuth, profileController.getProfile);
pazientiRouter.put("/profile", pazientiAuth, profileController.updateProfile);
pazientiRouter.delete("/profile", pazientiAuth, profileController.deleteAccount);

/* =======================================================
   TRATTAMENTI (PROTETTO)
   ======================================================= */
pazientiRouter.get("/trattamenti/", pazientiAuth, trattamentiController.listTrattamenti);
pazientiRouter.get("/trattamenti/:trattamentoId", pazientiAuth, trattamentiController.getTrattamento);

/* =======================================================
   APPUNTAMENTI (PROTETTO)
   ======================================================= */
pazientiRouter.get("/appuntamenti", pazientiAuth, appuntamentiController.listAppuntamenti);
pazientiRouter.post("/creaAppuntamento", pazientiAuth, appuntamentiController.createAppuntamento);

/* =======================================================
   MESSAGGI (PROTETTO)
   ======================================================= */
pazientiRouter.get("/fisioterapista", pazientiAuth, messaggiController.getFisioterapista);
pazientiRouter.get("/messaggi", pazientiAuth, messaggiController.listMessaggi);
pazientiRouter.post("/creaMessaggi", pazientiAuth, messaggiController.createMessaggio);

/* =======================================================
   SCHEDE ALLENAMENTO (PROTETTO)
   ======================================================= */
pazientiRouter.get("/schede", pazientiAuth, schedeController.listSchede);
pazientiRouter.get("/schede/:id_s", pazientiAuth, schedeController.getSchedaById);

pazientiRouter.post("/sessioni/", pazientiAuth, sessioniController.createSessione);
pazientiRouter.get("/sessioni/lista", pazientiAuth, sessioniController.listSessioniByCliente);
pazientiRouter.get("/sessioni/:id", pazientiAuth, sessioniController.getSessioneById);
pazientiRouter.put("/sessioni/:id/sondaggio", pazientiAuth, sessioniController.saveSondaggio);
pazientiRouter.put("/sessioni/:id/esercizio", pazientiAuth, sessioniController.updateEsercizioSessione);