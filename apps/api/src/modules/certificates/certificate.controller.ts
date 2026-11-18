import { certificateSerialParamsSchema } from "@lms/shared";
import type { Request, Response } from "express";

import { asyncHandler } from "../../utils/asyncHandler.js";
import { sendSuccess } from "../../utils/apiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import * as certificateService from "./certificate.service.js";

export const listMyCertificates = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw ApiError.unauthorized();
  }
  const certificates = await certificateService.listMyCertificates(req.user.id);
  sendSuccess(res, certificates);
});

export const verifyCertificate = asyncHandler(async (req: Request, res: Response) => {
  const { serial } = certificateSerialParamsSchema.parse(req.params);
  const certificate = await certificateService.getCertificateBySerial(serial);
  sendSuccess(res, certificate);
});
