import { Router } from "express";

import * as authController from "../../controllers/pazienti/authController";

export const pazientiRouter = Router();

// gestione autenticazione fisioterapista
pazientiRouter.post("/register", authController.register);
pazientiRouter.post("/login", authController.login);
pazientiRouter.post("/refreshToken", authController.refreshToken);
/*
pazientiRouter.post("/logout", authController.logout);
*/