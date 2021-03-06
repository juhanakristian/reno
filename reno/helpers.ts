// TODO: find a better name than "helpers"

import { AugmentedRequest, RouteHandler, AugmentedResponse } from "./router.ts";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type ProcessedRequest<TBody> = Pick<
  AugmentedRequest,
  Exclude<keyof AugmentedRequest, "body">
> & {
  body: TBody;
};

export type JsonRequest<TBody = {}> = ProcessedRequest<TBody>;
export type FormRequest = ProcessedRequest<URLSearchParams>;

// TODO: find a better way?!
const createProcessedRequest = <TBody>(
  { bodyStream, ...rest }: AugmentedRequest,
  body: TBody
) => ({
  ...rest,
  body,
  bodyStream
});

/* Maybe we'll need to write a
 * dedicated impl at some point */
const parseFormBody = (body: string) => new URLSearchParams(body);

export const withJsonBody = <TBody>(
  handler: RouteHandler<JsonRequest<TBody | unknown>>
) => async (req: AugmentedRequest) => {
  /* There are some instances in which an
   * empty body can have whitespace, so
   * we decode early and trim the resultant
   * string to determine the body's presence */
  const rawBody = await req.body();
  const bodyText = decoder.decode(rawBody).trim();

  if (!bodyText.length) {
    return handler(
      createProcessedRequest(
        req,
        {} as TBody // TODO: runtime safety! Use Map?!
      )
    );
  }

  const body = JSON.parse(bodyText) as TBody;

  return await handler(createProcessedRequest(req, body));
};

export const jsonResponse = <TResponseBody = {}>(
  body: TResponseBody,
  headers = {}
) => ({
  headers: new Headers({
    "Content-Type": "application/json",
    ...headers
  }),
  body: encoder.encode(JSON.stringify(body))
});

export const textResponse = (
  body: string,
  headers = {}
) => ({
  headers: new Headers({
    "Content-Type": "text/plain",
    ...headers
  }),
  body: encoder.encode(body)
});

export const streamResponse = (
  body: Deno.Reader,
  headers = {}
) => ({
  headers: new Headers(headers),
  body
});

export const withFormBody = (handler: RouteHandler<FormRequest>) => async (
  req: AugmentedRequest
) => {
  const rawBody = await req.body();
  const bodyText = decoder.decode(rawBody);
  const body = parseFormBody(bodyText);

  return await handler(createProcessedRequest(req, body));
};
