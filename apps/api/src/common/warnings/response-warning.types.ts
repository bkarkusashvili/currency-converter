import { WarningCode } from './warning-code.enum';

// Something that degraded while a request was answered, reported on the answer
// rather than only in the log. The request succeeded — that is what separates a
// warning from the error envelope (§3): the client has a result, and this is
// what it should know about how it was produced.
export interface ResponseWarning {
  code: WarningCode;
  message: string;
}
