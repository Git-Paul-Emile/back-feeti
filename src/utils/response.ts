/**
* Format standardisé pour les réponses JSON du serveur
* @param status "success" | "error" | "not_found" | "fail" | "unauthorized"
* @param message Message à afficher
* @param data Données optionnelles
*/
export function jsonResponse({
 status,
 message,
 data = null
}: {
 status: "success" | "error" | "not_found" | "fail" | "unauthorized";
 message: string;
 data?: any;
}) {
 return {
   status,
   message,
   data
 };
}
