import * as invoiceService from "../services/invoiceService.js";

export async function create(request, response) {
  const invoice = await invoiceService.createDraft(request.user.id, request.body, request.ip);
  response.status(201).json({ invoice });
}

export async function addItem(request, response) {
  response.status(201).json({ invoice: await invoiceService.addItem(request.user.id, request.params.invoiceId, request.body, request.ip) });
}

export async function updateItem(request, response) {
  response.json({ invoice: await invoiceService.updateItem(request.user.id, request.params.invoiceId, request.params.itemId, request.body, request.ip) });
}

export async function removeItem(request, response) {
  response.json({ invoice: await invoiceService.removeItem(request.user.id, request.params.invoiceId, request.params.itemId, request.ip) });
}

export async function issue(request, response) {
  response.json({ invoice: await invoiceService.issue(request.user.id, request.params.invoiceId, request.ip) });
}
