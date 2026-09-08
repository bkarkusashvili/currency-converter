// ISO 4217 alpha-3, upper case. The codes enter through DTO validation and
// leave through the same boundary, so a branded type would only add casts.
//
// Shared vocabulary rather than one module's: the rates, the conversion, the
// currencies list and a history record all speak in codes, and the ISO 4217
// table beside this file is read by the upstream mapper and the currencies
// projection alike. Owned by either of those modules it is a back edge into it.
export type CurrencyCode = string;
