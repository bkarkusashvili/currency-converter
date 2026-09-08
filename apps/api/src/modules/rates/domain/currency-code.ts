// ISO 4217 alpha-3, upper case. The codes enter through DTO validation and
// leave through the same boundary, so a branded type would only add casts.
export type CurrencyCode = string;
