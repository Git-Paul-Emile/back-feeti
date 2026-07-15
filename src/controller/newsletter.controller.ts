import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { newsletterRepository } from "../repositories/newsletter.repository.js";
import { subscribeNewsletterSchema } from "../validators/newsletter.validator.js";
import { jsonResponse } from "../utils/response.js";
import { controllerWrapper } from "../utils/ControllerWrapper.js";

// Inscription publique (formulaire du footer du site).
export const subscribeToNewsletter = controllerWrapper(async (req: Request, res: Response) => {
  const { email } = subscribeNewsletterSchema.parse(req.body);

  await newsletterRepository.subscribe(email, "footer");

  res.status(StatusCodes.OK).json(
    jsonResponse({ status: "success", message: "Inscription à la newsletter confirmée" })
  );
});

// Page HTML minimaliste affichée après un clic sur "Se désinscrire" depuis l'email.
function unsubscribePage(message: string): string {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
    <title>Féeti — Désinscription</title></head>
    <body style="margin:0;padding:0;background:#03033b;font-family:Arial, sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:80px 20px;">
        <table width="440" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;padding:40px;text-align:center;">
          <tr><td>
            <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#03033b;">Féeti</p>
            <p style="margin:0;font-size:16px;color:#374151;line-height:1.6;">${message}</p>
          </td></tr>
        </table>
      </td></tr></table>
    </body></html>`;
}

// Désinscription publique (lien "Se désinscrire" dans le footer de l'email hebdomadaire).
export const unsubscribeFromNewsletter = controllerWrapper(async (req: Request, res: Response) => {
  const token = String(req.params.token || "");
  const existing = await newsletterRepository.findByUnsubscribeToken(token);
  if (!existing) {
    res.status(StatusCodes.NOT_FOUND).send(unsubscribePage("Ce lien de désinscription n'est plus valide."));
    return;
  }

  await newsletterRepository.unsubscribeByToken(token);

  res.status(StatusCodes.OK).send(
    unsubscribePage(`Vous avez bien été désinscrit(e) de la newsletter Féeti (${existing.email}).`)
  );
});
