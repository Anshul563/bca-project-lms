import { Router } from "express";

import { authenticate } from "../../middlewares/authenticate.js";
import * as certificateController from "./certificate.controller.js";

export const certificateRoutes = Router();

certificateRoutes.get("/my", authenticate, certificateController.listMyCertificates);
certificateRoutes.get("/:serial", certificateController.verifyCertificate);
